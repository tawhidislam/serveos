import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PLATFORM_ROOT_DOMAINS } from '@/lib/tenant-host';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { uploadWithProgress } from '@/lib/storage-upload';
import { supabase } from '@/integrations/supabase/client';

/** Payload for platform asset uploads with progress + cancel support. */
export interface PlatformUploadInput {
  file: File;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface PlatformSettings {
  id: string;
  custom_domain_cname_target: string;
  custom_domain_a_record_ip: string;
  logo_url: string | null;
  favicon_url: string | null;
  site_name: string;
  updated_at: string;
}

// Cloudflare for SaaS fallback origin restaurants CNAME their domains to.
const DEFAULT_TARGET = `customers.${PLATFORM_ROOT_DOMAINS[0] ?? 'serveos.net'}`;
const DEFAULT_A_RECORD_IP = '76.76.21.21';
const DEFAULT_SITE_NAME = 'ServeOS';
const PLATFORM_BUCKET = 'platform-assets';

/**
 * Extract the object path inside the `platform-assets` bucket from a public URL.
 * Returns null if the URL doesn't belong to this bucket (e.g. external/legacy URL),
 * so we never attempt to delete files we don't own.
 */
function extractPlatformAssetPath(publicUrl: string | null | undefined): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${PLATFORM_BUCKET}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  const path = publicUrl.slice(idx + marker.length).split('?')[0];
  return path || null;
}

/** Best-effort delete of a previous asset; never throws so the main flow keeps working. */
async function removePlatformAssetByUrl(publicUrl: string | null | undefined): Promise<void> {
  const path = extractPlatformAssetPath(publicUrl);
  if (!path) return;
  const { error } = await supabase.storage.from(PLATFORM_BUCKET).remove([path]);
  if (error) {
    console.warn('[platform-settings] failed to remove old asset', path, error.message);
  }
}

const PLATFORM_SETTINGS_KEY = ['platform-settings'] as const;

/**
 * Apply a partial patch to the cached platform-settings row so the UI
 * reflects the change instantly, before the background refetch completes.
 */
function patchPlatformSettingsCache(
  qc: ReturnType<typeof useQueryClient>,
  patch: Partial<PlatformSettings>,
) {
  qc.setQueryData<PlatformSettings | null>(PLATFORM_SETTINGS_KEY, prev => {
    if (!prev) return { ...patch } as PlatformSettings;
    return { ...prev, ...patch, updated_at: new Date().toISOString() };
  });
}

/** Public read of the single platform settings row (used by the custom-domain guide). */
export function usePlatformSettings() {
  return useQuery<PlatformSettings | null>({
    queryKey: PLATFORM_SETTINGS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) {
        console.warn('[platform-settings] read failed', error.message);
        return null;
      }
      return (data as PlatformSettings) ?? null;
    },
    // Branding rarely changes — cache aggressively for snappy nav/footer renders.
    staleTime: 30 * 60_000,
    gcTime: 60 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

/** Convenience: returns the configured CNAME target with a sensible fallback. */
export function useCustomDomainCnameTarget(): string {
  const { data } = usePlatformSettings();
  return data?.custom_domain_cname_target?.trim() || DEFAULT_TARGET;
}

/** Convenience: returns the configured A-record IP with a sensible fallback (Vercel). */
export function useCustomDomainARecordIp(): string {
  const { data } = usePlatformSettings();
  return data?.custom_domain_a_record_ip?.trim() || DEFAULT_A_RECORD_IP;
}

/** Public branding shown across the marketing site (logo + site name). */
export function usePlatformBranding(): { logoUrl: string | null; siteName: string; faviconUrl: string | null } {
  const { data } = usePlatformSettings();
  return {
    logoUrl: data?.logo_url?.trim() || null,
    siteName: data?.site_name?.trim() || DEFAULT_SITE_NAME,
    faviconUrl: data?.favicon_url?.trim() || null,
  };
}

/** Platform-admin only: upload a new favicon and persist its public URL. */
export function useUploadPlatformFavicon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress, signal }: PlatformUploadInput) => {
      const allowed = ['image/png', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
      if (!allowed.includes(file.type) && !file.name.toLowerCase().endsWith('.ico')) {
        throw new Error('Favicon must be PNG, ICO, or SVG.');
      }
      if (file.size > 512 * 1024) {
        throw new Error('Favicon must be 512KB or smaller.');
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `favicon-${Date.now()}.${ext}`;
      const { publicUrl } = await uploadWithProgress({
        bucket: PLATFORM_BUCKET,
        path,
        file: await compressImage(file, COMPRESS_PRESETS.avatar),
        contentType: file.type || 'image/png',
        onProgress,
        signal,
      });


      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id, favicon_url')
        .limit(1)
        .maybeSingle();

      const previousUrl = existing?.favicon_url ?? null;

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ favicon_url: publicUrl })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ favicon_url: publicUrl });
        if (error) throw error;
      }

      // Cleanup old favicon AFTER successful DB write so we don't orphan the new one.
      if (previousUrl && previousUrl !== publicUrl) {
        await removePlatformAssetByUrl(previousUrl);
      }
      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      patchPlatformSettingsCache(qc, { favicon_url: publicUrl });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

/** Platform-admin only: clear the custom favicon (revert to bundled default). */
export function useRemovePlatformFavicon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id, favicon_url')
        .limit(1)
        .maybeSingle();
      if (!existing?.id) return;
      const previousUrl = existing.favicon_url;
      const { error } = await supabase
        .from('platform_settings')
        .update({ favicon_url: null })
        .eq('id', existing.id);
      if (error) throw error;
      await removePlatformAssetByUrl(previousUrl);
    },
    onSuccess: () => {
      patchPlatformSettingsCache(qc, { favicon_url: null });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

/** Platform-admin only: upload a new logo file and persist its public URL. */
export function useUploadPlatformLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ file, onProgress, signal }: PlatformUploadInput) => {
      if (!file.type.startsWith('image/')) {
        throw new Error('Please choose an image file (PNG, JPG, SVG, or WebP).');
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new Error('Logo must be 2MB or smaller.');
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `logo-${Date.now()}.${ext}`;
      const { publicUrl } = await uploadWithProgress({
        bucket: PLATFORM_BUCKET,
        path,
        file: await compressImage(file, COMPRESS_PRESETS.avatar),
        contentType: file.type,
        onProgress,
        signal,
      });


      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id, logo_url')
        .limit(1)
        .maybeSingle();

      const previousUrl = existing?.logo_url ?? null;

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ logo_url: publicUrl })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ logo_url: publicUrl });
        if (error) throw error;
      }

      // Cleanup old logo AFTER successful DB write so we don't orphan the new one.
      if (previousUrl && previousUrl !== publicUrl) {
        await removePlatformAssetByUrl(previousUrl);
      }
      return publicUrl;
    },
    onSuccess: (publicUrl) => {
      patchPlatformSettingsCache(qc, { logo_url: publicUrl });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

/** Platform-admin only: clear the custom logo (revert to default icon). */
export function useRemovePlatformLogo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id, logo_url')
        .limit(1)
        .maybeSingle();
      if (!existing?.id) return;
      const previousUrl = existing.logo_url;
      const { error } = await supabase
        .from('platform_settings')
        .update({ logo_url: null })
        .eq('id', existing.id);
      if (error) throw error;
      await removePlatformAssetByUrl(previousUrl);
    },
    onSuccess: () => {
      patchPlatformSettingsCache(qc, { logo_url: null });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

/** Platform-admin only: update the SaaS site name (used in nav, footer, copyright). */
export function useUpdateSiteName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const name = value.trim();
      if (!name) throw new Error('Site name is required');
      if (name.length > 60) throw new Error('Site name must be 60 characters or less');

      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ site_name: name })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ site_name: name });
        if (error) throw error;
      }
      return name;
    },
    onSuccess: (name) => {
      patchPlatformSettingsCache(qc, { site_name: name });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}

/** Platform-admin only: update the CNAME target value. */
export function useUpdateCnameTarget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const target = value.trim().toLowerCase();
      if (!target) throw new Error('CNAME target is required');

      // Upsert single row (create if missing, update otherwise)
      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ custom_domain_cname_target: target })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ custom_domain_cname_target: target });
        if (error) throw error;
      }
      return target;
    },
    onSuccess: (target) => {
      patchPlatformSettingsCache(qc, { custom_domain_cname_target: target });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}
/** Platform-admin only: update the A-record IP shown for root-domain (apex) setup. */
export function useUpdateARecordIp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: string) => {
      const ip = value.trim();
      if (!ip) throw new Error('A-record IP is required');
      if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) {
        throw new Error('Enter a valid IPv4 address like 76.76.21.21');
      }

      const { data: existing } = await supabase
        .from('platform_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing?.id) {
        const { error } = await supabase
          .from('platform_settings')
          .update({ custom_domain_a_record_ip: ip })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('platform_settings')
          .insert({ custom_domain_a_record_ip: ip });
        if (error) throw error;
      }
      return ip;
    },
    onSuccess: (ip) => {
      patchPlatformSettingsCache(qc, { custom_domain_a_record_ip: ip });
      qc.invalidateQueries({ queryKey: PLATFORM_SETTINGS_KEY });
    },
  });
}
