import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getCurrentHostname, isPlatformHost } from '@/hooks/useCustomDomainRestaurant';
import { getSubdomainTenantSlug } from '@/lib/tenant-host';

/**
 * Resolves the active public restaurant id for the customer-facing menu.
 *
 * Priority:
 *   1. `active_restaurant_id` in sessionStorage (set by /r/:slug/menu redirect or custom-domain gate)
 *   2. Look up by `active_restaurant_slug` in sessionStorage
 *   3. Look up by current hostname against `restaurants.custom_domain` (verified)
 *   4. null (legacy / no tenant scope)
 */
export function useActiveRestaurantId() {
  const cachedId = typeof window !== 'undefined' ? sessionStorage.getItem('active_restaurant_id') : null;
  const cachedSlug = typeof window !== 'undefined' ? sessionStorage.getItem('active_restaurant_slug') : null;
  const hostname = getCurrentHostname();
  const platform = isPlatformHost(hostname);

  return useQuery<string | null>({
    queryKey: ['active-restaurant-id', cachedId, cachedSlug, hostname],
    queryFn: async () => {
      if (cachedId) return cachedId;
      if (cachedSlug) {
        const { data } = await supabase
          .from('restaurants')
          .select('id')
          .eq('slug', cachedSlug)
          .eq('is_active', true)
          .maybeSingle();
        if (data?.id) {
          sessionStorage.setItem('active_restaurant_id', data.id);
          return data.id;
        }
      }
      // Subdomain-based tenant: `<slug>.<platform-root>`
      const subSlug = getSubdomainTenantSlug(hostname);
      if (subSlug) {
        const { data } = await supabase
          .from('restaurants')
          .select('id, slug')
          .eq('slug', subSlug)
          .eq('is_active', true)
          .maybeSingle();
        if (data?.id) {
          sessionStorage.setItem('active_restaurant_id', data.id);
          sessionStorage.setItem('active_restaurant_slug', data.slug);
          return data.id;
        }
        return null;
      }

      // Final fallback: custom-domain match for anonymous visitors.
      if (!platform && hostname) {
        const candidates = hostname.startsWith('www.')
          ? [hostname, hostname.slice(4)]
          : [hostname, `www.${hostname}`];
        const { data } = await supabase
          .from('restaurants')
          .select('id, slug')
          .in('custom_domain', candidates)
          .eq('custom_domain_verified', true)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();
        if (data?.id) {
          sessionStorage.setItem('active_restaurant_id', data.id);
          sessionStorage.setItem('active_restaurant_slug', data.slug);
          return data.id;
        }
      }
      return null;
    },
    staleTime: 5 * 60_000,
  });
}
