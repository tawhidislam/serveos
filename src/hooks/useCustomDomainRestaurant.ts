import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Restaurant } from '@/hooks/useCurrentRestaurant';
import {
  getSubdomainTenantSlug,
  isPlatformRootOrReserved,
  matchPlatformRoot,
} from '@/lib/tenant-host';

/**
 * Hostnames that should NEVER be treated as a tenant custom domain.
 * (Lovable preview/published URLs, the SaaS marketing domain, local dev.)
 */
const PLATFORM_HOST_SUFFIXES = [
  '.lovable.app',
  '.lovable.dev',
  '.lovableproject.com',
  'localhost',
  '127.0.0.1',
];

const PLATFORM_EXACT_HOSTS = new Set<string>([
  'serve-joy.lovable.app',
]);

export function getCurrentHostname(): string | null {
  if (typeof window === 'undefined') return null;
  return window.location.hostname.toLowerCase();
}

/**
 * True when the current hostname is a Lovable/dev/marketing host or a
 * reserved subdomain on the configured platform root. Tenant subdomains
 * (e.g. `fryhubt.servejoy.com`) and verified custom domains return false.
 */
export function isPlatformHost(hostname: string | null): boolean {
  if (!hostname) return true;
  if (PLATFORM_EXACT_HOSTS.has(hostname)) return true;
  if (
    PLATFORM_HOST_SUFFIXES.some((suffix) =>
      suffix.startsWith('.') ? hostname.endsWith(suffix) : hostname === suffix,
    )
  ) {
    return true;
  }
  // On a configured platform root: only treat the bare root + reserved
  // subdomains as platform. Tenant subdomains fall through (not platform).
  if (matchPlatformRoot(hostname)) {
    return isPlatformRootOrReserved(hostname);
  }
  return false;
}

/**
 * Looks up the restaurant whose verified custom domain matches the current
 * hostname. Checks the new `restaurant_custom_domains` table first (supports
 * unlimited domains per tenant); falls back to the legacy `custom_domain`
 * column on `restaurants` for any rows not yet migrated.
 *
 * Returns null on any platform/dev hostname.
 */
export function useCustomDomainRestaurant() {
  const hostname = getCurrentHostname();
  const platform = isPlatformHost(hostname);

  return useQuery<Restaurant | null>({
    queryKey: ['custom-domain-restaurant', hostname],
    enabled: !platform && !!hostname,
    staleTime: 10 * 60_000,
    queryFn: async () => {
      if (!hostname) return null;

      // 0) Subdomain-based tenant: `<slug>.<platform-root>`
      const subSlug = getSubdomainTenantSlug(hostname);
      if (subSlug) {
        const { data: r } = await supabase
          .from('restaurants')
          .select('*')
          .eq('slug', subSlug)
          .eq('is_active', true)
          .maybeSingle();
        if (r) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('active_restaurant_id', r.id);
            sessionStorage.setItem('active_restaurant_slug', r.slug);
          }
          return r as Restaurant;
        }
        // Unknown subdomain on a platform root → not a custom domain either.
        return null;
      }

      // Try exact match, then strip leading "www."
      const candidates = hostname.startsWith('www.')
        ? [hostname, hostname.slice(4)]
        : [hostname, `www.${hostname}`];

      // 1) New multi-domain table
      const { data: match, error: matchErr } = await supabase
        .from('restaurant_custom_domains')
        .select('restaurant_id')
        .in('domain', candidates)
        .eq('verified', true)
        .limit(1)
        .maybeSingle();

      if (matchErr) {
        console.warn('[custom-domain] multi-domain lookup failed', matchErr.message);
      }

      if (match?.restaurant_id) {
        const { data: r } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', match.restaurant_id)
          .eq('is_active', true)
          .maybeSingle();
        if (r) {
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('active_restaurant_id', r.id);
            sessionStorage.setItem('active_restaurant_slug', r.slug);
          }
          return r as Restaurant;
        }
      }

      // 2) Legacy single-domain column fallback
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .in('custom_domain', candidates)
        .eq('custom_domain_verified', true)
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[custom-domain] legacy lookup failed', error.message);
        return null;
      }
      const r = (data as Restaurant) ?? null;

      // Prime sessionStorage so useActiveRestaurantId resolves for anonymous visitors.
      if (r && typeof window !== 'undefined') {
        sessionStorage.setItem('active_restaurant_id', r.id);
        sessionStorage.setItem('active_restaurant_slug', r.slug);
      }
      return r;
    },
  });
}
