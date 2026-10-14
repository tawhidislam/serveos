/**
 * usePublicUrls — fetches canonical public URLs from the backend so QR codes
 * always point at the right host (production / custom domain) regardless of
 * where the admin / demo page is being viewed from.
 *
 * Falls back to a `window.location.origin`-based result if the backend call
 * fails, so QR codes never silently break in development or on first paint.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PublicUrlsTable {
  id: string;
  label: string;
  capacity: number;
  status: string;
  url: string;
}

export interface PublicUrlsResponse {
  origin: string;
  restaurant: {
    id: string;
    slug: string;
    name: string;
    custom_domain: string | null;
    custom_domain_verified: boolean;
    site_origin: string;
    menu_url: string;
    menu_slug_path: string;
    order_history_url: string;
  };
  tables: PublicUrlsTable[];
  qr: {
    menu: string;
    tables: Record<string, string>;
  };
}

export interface UsePublicUrlsParams {
  restaurantId?: string;
  slug?: string;
  /** Fetch every table for the restaurant. */
  includeAllTables?: boolean;
  /** Limit table fetch to a specific list of ids. */
  tableIds?: string[];
  /** QR code pixel size (clamped 64–1024). */
  qrSize?: number;
  /** Disable query (e.g., while loading inputs). */
  enabled?: boolean;
}

function qrSrc(url: string, size: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(url)}`;
}

function buildClientFallback(
  params: UsePublicUrlsParams & { tables?: PublicUrlsTable[] },
): PublicUrlsResponse | null {
  if (typeof window === 'undefined') return null;
  if (!params.slug && !params.restaurantId) return null;
  const origin = window.location.origin;
  const slug = params.slug ?? '';
  const menuUrl = slug ? `${origin}/r/${slug}/menu` : origin;
  const orderUrl = slug ? `${origin}/r/${slug}/orders` : origin;
  const size = params.qrSize ?? 220;
  const qrTables: Record<string, string> = {};
  for (const t of params.tables ?? []) {
    qrTables[t.id] = qrSrc(t.url, size);
  }
  return {
    origin,
    restaurant: {
      id: params.restaurantId ?? '',
      slug,
      name: '',
      custom_domain: null,
      custom_domain_verified: false,
      site_origin: origin,
      menu_url: menuUrl,
      menu_slug_path: '/menu',
      order_history_url: orderUrl,
    },
    tables: params.tables ?? [],
    qr: { menu: qrSrc(menuUrl, size), tables: qrTables },
  };
}

export function usePublicUrls(params: UsePublicUrlsParams) {
  const enabled =
    (params.enabled ?? true) && Boolean(params.restaurantId || params.slug);

  return useQuery<PublicUrlsResponse | null>({
    queryKey: [
      'public-urls',
      params.restaurantId ?? null,
      params.slug ?? null,
      params.includeAllTables ?? false,
      params.tableIds ?? null,
      params.qrSize ?? 220,
    ],
    enabled,
    staleTime: 60_000,
    retry: 1,
    queryFn: async () => {
      const search = new URLSearchParams();
      if (params.restaurantId) search.set('restaurant_id', params.restaurantId);
      if (params.slug) search.set('slug', params.slug);
      if (params.includeAllTables) search.set('include_tables', 'true');
      if (params.tableIds && params.tableIds.length > 0) {
        search.set('table_ids', params.tableIds.join(','));
      }
      if (params.qrSize) search.set('qr_size', String(params.qrSize));

      const { data, error } = await supabase.functions.invoke<PublicUrlsResponse>(
        `public-urls?${search.toString()}`,
        { method: 'GET' },
      );

      if (error) {
        const fallback = buildClientFallback(params);
        if (fallback) return fallback;
        throw error;
      }

      return data ?? buildClientFallback(params);
    },
  });
}
