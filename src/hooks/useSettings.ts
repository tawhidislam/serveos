import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';

export interface RestaurantSettings {
  id: string;
  restaurant_name: string;
  logo_url: string | null;
  tax_percentage: number;
  currency: string;
  qr_ordering_enabled: boolean;
  primary_color: string;
  accent_color: string;
  tagline: string | null;
  qr_template: string;
  qr_color_overrides: Record<string, string>;
  homepage_template: string;
  order_page_template: string;
  /** QR ordering page branding (falls back to general restaurant branding). */
  order_page_logo_url: string | null;
  order_page_primary_color: string | null;
  order_page_header_text: string | null;
  order_page_subtext: string | null;

  restaurant_id?: string | null;
  delivery_enabled: boolean;
  pickup_enabled: boolean;
  delivery_fee: number;
  free_delivery_min: number | null;
  delivery_min_order: number;
  delivery_eta_minutes: number;
  pickup_eta_minutes: number;
  delivery_area_note: string | null;
  contact_phone: string | null;
  address: string | null;
}

const defaults: RestaurantSettings = {
  id: '',
  restaurant_name: 'My Restaurant',
  logo_url: null,
  tax_percentage: 10,
  currency: 'USD',
  qr_ordering_enabled: true,
  primary_color: '#e87c1e',
  accent_color: '#c8a855',
  tagline: null,
  qr_template: 'classic',
  qr_color_overrides: {},
  homepage_template: 'classic',
  order_page_template: 'classic',
  order_page_logo_url: null,
  order_page_primary_color: null,
  order_page_header_text: null,
  order_page_subtext: null,

  delivery_enabled: false,
  pickup_enabled: false,
  delivery_fee: 0,
  free_delivery_min: null,
  delivery_min_order: 0,
  delivery_eta_minutes: 45,
  pickup_eta_minutes: 20,
  delivery_area_note: null,
  contact_phone: null,
  address: null,
};

export function useSettings(restaurantOverride?: { id: string; name: string; logo_url: string | null; primary_color: string; accent_color: string; tagline: string | null } | null) {
  const { restaurant: resolved } = useResolvedRestaurant();
  const restaurant = restaurantOverride ?? resolved;

  return useQuery<RestaurantSettings>({
    queryKey: ['restaurant_settings', restaurant?.id ?? 'none'],
    queryFn: async () => {
      // No resolved tenant yet (loading, limbo account, or failed resolution).
      // Never run an unscoped query here: `restaurant_settings` has a public
      // SELECT policy, so `SELECT ... LIMIT 1` without a restaurant_id filter
      // would return an ARBITRARY tenant's settings (wrong currency, tax %,
      // branding, contact info). Return neutral defaults instead.
      if (!restaurant?.id) return defaults;

      const { data, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .limit(1)
        .maybeSingle();
      if (error || !data) {
        // Fall back to restaurant-level branding when no settings row exists.
        return {
          ...defaults,
          restaurant_name: restaurant.name,
          logo_url: restaurant.logo_url,
          primary_color: restaurant.primary_color,
          accent_color: restaurant.accent_color,
          tagline: restaurant.tagline,
          restaurant_id: restaurant.id,
        };
      }
      return data as unknown as RestaurantSettings;
    },
    enabled: !!restaurant?.id,
    staleTime: 5 * 60_000,
  });
}
