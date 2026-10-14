import type { ThemeTokens } from './usePlatformThemes';
import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useCustomDomainRestaurant } from '@/hooks/useCustomDomainRestaurant';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

export interface Restaurant {
  theme_id?: string | null;
  theme_overrides?: ThemeTokens | null;
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  logo_url: string | null;
  favicon_url: string | null;
  tagline: string | null;
  primary_color: string;
  accent_color: string;
  is_active: boolean;
  created_at: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  custom_domain_verified_at: string | null;
  phone: string | null;
  address: string | null;
  cuisine_type: string | null;
}

/**
 * Returns the active restaurant for the current view.
 *
 * Resolution order:
 *   1. If a platform admin is impersonating a tenant, return that tenant.
 *   2. Otherwise, return the restaurant the authenticated user belongs to via `restaurant_members`.
 *
 * All tenant-scoped pages should derive `restaurantId` from this hook so that
 * impersonation transparently rescopes every query.
 */
export function useCurrentRestaurant() {
  const { user } = useAuth();
  const { active: impersonation, stopImpersonation } = useImpersonation();
  const { isPlatformAdmin, loading: adminLoading } = usePlatformAdmin();
  // Only honor impersonation if the current user is actually a platform admin.
  // Otherwise a stale sessionStorage entry from a previous account would force
  // tenant queries to use a restaurant_id the user has no membership for,
  // which causes RLS failures (e.g. when inserting menu_items).
  const impersonatedId =
    impersonation && isPlatformAdmin && !adminLoading ? impersonation.restaurantId : null;

  // Auto-clear stale impersonation when the active user is not a platform admin.
  useEffect(() => {
    if (impersonation && !adminLoading && !isPlatformAdmin) {
      // stopImpersonation is async (it resyncs the query cache); we don't
      // await it here — the resync will trigger a re-render which restarts
      // this hook with a clean impersonation state.
      void stopImpersonation().catch(() => { /* noop */ });
    }
  }, [impersonation, adminLoading, isPlatformAdmin, stopImpersonation]);
  const { data: customDomainRestaurant } = useCustomDomainRestaurant();

  return useQuery<Restaurant | null>({
    queryKey: ['current-restaurant', user?.id, impersonatedId, customDomainRestaurant?.id ?? null],
    queryFn: async () => {
      // 1) Impersonation override
      if (impersonatedId) {
        const { data: restaurant } = await supabase
          .from('restaurants')
          .select('*')
          .eq('id', impersonatedId)
          .maybeSingle();
        return (restaurant as Restaurant) ?? null;
      }

      // 2) Authenticated user's own membership
      if (user) {
        const { data: member } = await supabase
          .from('restaurant_members')
          .select('restaurant_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (member) {
          const { data: restaurant } = await supabase
            .from('restaurants')
            .select('*')
            .eq('id', member.restaurant_id)
            .maybeSingle();
          if (restaurant) return restaurant as Restaurant;
        }
      }

      // 3) Anonymous visitor on a verified custom domain
      if (customDomainRestaurant) return customDomainRestaurant;

      return null;
    },
    enabled: !!user || !!impersonatedId || !!customDomainRestaurant,
    staleTime: 5 * 60_000,
  });
}

/** Fetches a restaurant by its public slug (used for /r/:slug routes). */
export function useRestaurantBySlug(slug: string | undefined) {
  return useQuery<Restaurant | null>({
    queryKey: ['restaurant-by-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .eq('is_active', true)
        .maybeSingle();
      return (data as Restaurant) ?? null;
    },
    enabled: !!slug,
    staleTime: 5 * 60_000,
  });
}
