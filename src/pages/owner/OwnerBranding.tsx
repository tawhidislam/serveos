import { useEffect, useRef, useState } from 'react';
import UploadProgress from '@/components/upload/UploadProgress';
import { uploadWithProgress } from '@/lib/storage-upload';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useFeatureAccess } from '@/hooks/usePlan';
import OwnerLayout from './OwnerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ExternalLink, BookOpen, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import CustomDomainCard from '@/components/platform/CustomDomainCard';
import RequestCustomDomainCard from '@/components/platform/RequestCustomDomainCard';
import CustomDomainSetupGuide from '@/components/platform/CustomDomainSetupGuide';

export default function OwnerBranding() {
  const qc = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const canCustomDomain = useFeatureAccess('customDomain');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [primary, setPrimary] = useState('#e87c1e');
  const [accent, setAccent] = useState('#c8a855');
  const [saving, setSaving] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [faviconProgress, setFaviconProgress] = useState(0);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [lastFaviconFile, setLastFaviconFile] = useState<File | null>(null);
  const faviconFileRef = useRef<HTMLInputElement | null>(null);

  const FAVICON_BUCKET = 'website-images';

  function extractStoragePath(publicUrl: string | null): string | null {
    if (!publicUrl) return null;
    const marker = `/storage/v1/object/public/${FAVICON_BUCKET}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return null;
    return publicUrl.slice(idx + marker.length).split('?')[0] || null;
  }

  const persistFavicon = async (newUrl: string | null) => {
    if (!restaurant) return;
    const { error } = await supabase
      .from('restaurants')
      .update({ favicon_url: newUrl })
      .eq('id', restaurant.id);
    if (error) throw error;
    setFaviconUrl(newUrl ?? '');
    qc.invalidateQueries({ queryKey: ['current-restaurant'] });
  };

  const handleFaviconFile = async (file: File | null | undefined) => {
    setLastFaviconFile(file ?? null);
    if (!file || !restaurant) return;
    const allowed = ['image/png', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'];
    const isIco = file.name.toLowerCase().endsWith('.ico');
    if (!allowed.includes(file.type) && !isIco) {
      toast.error('Favicon must be PNG, SVG, or ICO.');
      return;
    }
    if (file.size > 512 * 1024) {
      toast.error('Favicon must be 512KB or smaller.');
      return;
    }
    setFaviconError(null);
    setFaviconProgress(0);
    setUploadingFavicon(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `favicons/${restaurant.id}/favicon-${Date.now()}.${ext}`;
      const pub = await uploadWithProgress({
        bucket: FAVICON_BUCKET,
        path,
        file: await compressImage(file, COMPRESS_PRESETS.avatar),
        contentType: file.type || 'image/png',
        onProgress: setFaviconProgress,
      });

      const previousPath = extractStoragePath(faviconUrl || null);
      await persistFavicon(pub.publicUrl);
      if (previousPath && previousPath !== path) {
        await supabase.storage.from(FAVICON_BUCKET).remove([previousPath]).catch(() => {});
      }
      toast.success('Favicon updated');
      setFaviconError(null);
    } catch (err: any) {
      setFaviconError(err.message ?? 'Upload failed');
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploadingFavicon(false);
      if (faviconFileRef.current) faviconFileRef.current.value = '';
    }
  };

  const handleRemoveFavicon = async () => {
    if (!restaurant || !faviconUrl) return;
    if (!confirm('Remove the custom favicon?')) return;
    try {
      const previousPath = extractStoragePath(faviconUrl);
      await persistFavicon(null);
      if (previousPath) {
        await supabase.storage.from(FAVICON_BUCKET).remove([previousPath]).catch(() => {});
      }
      toast.success('Favicon removed');
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to remove');
    }
  };

  useEffect(() => {
    if (!restaurant) return;
    setName(restaurant.name);
    setSlug(restaurant.slug);
    setTagline(restaurant.tagline ?? '');
    setLogoUrl(restaurant.logo_url ?? '');
    setFaviconUrl(restaurant.favicon_url ?? '');
    setPrimary(restaurant.primary_color);
    setAccent(restaurant.accent_color);
  }, [restaurant]);

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: name.trim(),
          slug: slug.trim(),
          tagline: tagline.trim() || null,
          logo_url: logoUrl.trim() || null,
          favicon_url: faviconUrl.trim() || null,
          primary_color: primary,
          accent_color: accent,
        })
        .eq('id', restaurant.id);
      if (error) throw error;
      toast.success('Branding saved');
      qc.invalidateQueries({ queryKey: ['current-restaurant'] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (!restaurant) {
    return (
      <OwnerLayout>
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </OwnerLayout>
    );
  }

  const publicUrl = `${window.location.origin}/r/${slug || restaurant.slug}/menu`;

  return (
    <OwnerLayout>
      <div className="p-8 space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Branding & public URL</h1>
          <p className="text-sm text-muted-foreground mt-1">Customize how your restaurant appears to customers</p>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Identity</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="r-name">Restaurant name</Label>
              <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-tagline">Tagline</Label>
              <Textarea id="r-tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} rows={2} placeholder="A short description shown on your homepage" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-logo">Logo URL</Label>
              <Input id="r-logo" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-favicon">Favicon</Label>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden shrink-0">
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="Favicon preview" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground text-center px-1">None</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={faviconFileRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/x-icon,.ico"
                    className="hidden"
                    onChange={(e) => handleFaviconFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => faviconFileRef.current?.click()}
                    disabled={uploadingFavicon}
                  >
                    {uploadingFavicon ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />{faviconUrl ? 'Replace' : 'Upload'}</>
                    )}
                  </Button>
                  {faviconUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveFavicon}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />Remove
                    </Button>
                  )}
                </div>
              </div>
              <UploadProgress
                uploading={uploadingFavicon}
                progress={faviconProgress}
                error={faviconError}
                fileName={lastFaviconFile?.name}
                onRetry={() => lastFaviconFile && handleFaviconFile(lastFaviconFile)}
              />
              <p className="text-xs text-muted-foreground">PNG, SVG, or ICO. Square (32×32 or 64×64). Max 512KB. Saved instantly. Browsers may cache favicons — hard refresh to see changes.</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Public URL</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="r-slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">/r/</span>
                <Input id="r-slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} pattern="[a-z0-9-]+" />
              </div>
              <p className="text-xs text-muted-foreground">Lowercase letters, numbers, and hyphens only</p>
            </div>
            <div className="rounded-md bg-muted/50 p-3 flex items-center justify-between gap-2">
              <code className="text-xs break-all">{publicUrl}</code>
              <Button asChild variant="ghost" size="sm">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Custom domain: paid → live form, free → request flow */}
        {canCustomDomain ? (
          <CustomDomainCard
            restaurantId={restaurant.id}
            unlocked
          />
        ) : (
          <RequestCustomDomainCard restaurantId={restaurant.id} />
        )}

        {/* Setup guide — always visible so owners can prepare DNS in advance */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> DNS setup guide
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CustomDomainSetupGuide
              domain={restaurant.custom_domain}
              verified={restaurant.custom_domain_verified}
              compact
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Colors</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="r-primary">Primary</Label>
              <div className="flex gap-2">
                <input id="r-primary" type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-14 rounded border border-input bg-transparent" />
                <Input value={primary} onChange={(e) => setPrimary(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="r-accent">Accent</Label>
              <div className="flex gap-2">
                <input id="r-accent" type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-10 w-14 rounded border border-input bg-transparent" />
                <Input value={accent} onChange={(e) => setAccent(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
    </OwnerLayout>
  );
}
