import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import type { PlanLimits } from '@/lib/plans';

export type AddonBillingType = 'monthly' | 'one_time';
export type AddonRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';
export type AddonGrantStatus = 'active' | 'expired' | 'revoked';

export interface PlatformAddon {
  id: string;
  key: string;
  name: string;
  description: string | null;
  badge: string | null;
  billing_type: AddonBillingType;
  price_amount: number;
  currency: string;
  feature_key: keyof PlanLimits | null | string;
  icon: string | null;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  /** Quantity overrides applied additively when this add-on is active for a tenant. */
  extra_menu_items: number;
  extra_branches: number;
  extra_staff: number;
  /** When true, the matching plan limit becomes unlimited (overrides the additive boost). */
  unlimited_menu_items: boolean;
  unlimited_branches: boolean;
  unlimited_staff: boolean;
  /** When true, restaurants can purchase more than one unit of this add-on. */
  allow_multiple: boolean;
  /** Optional cap on the per-purchase quantity when `allow_multiple` is on. */
  max_quantity: number | null;
  created_at: string;
  updated_at: string;
}

export interface RestaurantAddonRow {
  id: string;
  addon_id: string;
  restaurant_id: string;
  source: 'purchase' | 'grant' | 'trial';
  status: AddonGrantStatus;
  starts_at: string;
  expires_at: string | null;
  granted_by: string | null;
  granted_via_request_id: string | null;
  notes: string | null;
  /** Number of units of the add-on that are active for the restaurant. */
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface AddonPurchaseRequest {
  id: string;
  addon_id: string;
  restaurant_id: string;
  requested_by: string | null;
  status: AddonRequestStatus;
  payment_method: string | null;
  payment_reference: string | null;
  amount: number;
  currency: string;
  billing_type: AddonBillingType;
  notes: string | null;
  admin_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  /** How many units of the add-on the tenant requested (≥ 1). */
  quantity: number;
  created_at: string;
  updated_at: string;
}

/** Public catalog — readable by anyone (used on /pricing and /admin/addons). */
export function usePlatformAddons(opts?: { publicOnly?: boolean }) {
  return useQuery<PlatformAddon[]>({
    queryKey: ['platform-addons', opts?.publicOnly ?? false],
    queryFn: async () => {
      let q = supabase
        .from('platform_addons' as any)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true });
      if (opts?.publicOnly) q = q.eq('is_public', true).eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PlatformAddon[];
    },
    staleTime: 60_000,
  });
}

/** Active add-on grants for the current tenant. */
export function useRestaurantAddons() {
  const { data: restaurant } = useCurrentRestaurant();
  return useQuery<RestaurantAddonRow[]>({
    queryKey: ['restaurant-addons', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];
      const { data, error } = await supabase
        .from('restaurant_addons' as any)
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .eq('status', 'active');
      if (error) throw error;
      const now = Date.now();
      return ((data ?? []) as unknown as RestaurantAddonRow[]).filter(
        (r) => !r.expires_at || new Date(r.expires_at).getTime() > now,
      );
    },
    enabled: !!restaurant,
    staleTime: 30_000,
  });
}

/** Convenience: returns the set of feature_keys unlocked by active add-ons. */
export function useActiveAddonFeatureKeys(): Set<string> {
  const { data: addons } = usePlatformAddons();
  const { data: grants } = useRestaurantAddons();
  const out = new Set<string>();
  if (!addons || !grants) return out;
  const byId = new Map(addons.map((a) => [a.id, a]));
  for (const g of grants) {
    const a = byId.get(g.addon_id);
    if (a?.feature_key && a.is_active) out.add(a.feature_key);
  }
  return out;
}

/** Aggregate quantity-limit overrides granted by active add-ons. */
export interface ActiveAddonQuantityBoosts {
  extraMenuItems: number;
  extraBranches: number;
  extraStaff: number;
  unlimitedMenuItems: boolean;
  unlimitedBranches: boolean;
  unlimitedStaff: boolean;
}

export function useActiveAddonQuantityBoosts(): ActiveAddonQuantityBoosts {
  const { data: addons } = usePlatformAddons();
  const { data: grants } = useRestaurantAddons();
  const out: ActiveAddonQuantityBoosts = {
    extraMenuItems: 0,
    extraBranches: 0,
    extraStaff: 0,
    unlimitedMenuItems: false,
    unlimitedBranches: false,
    unlimitedStaff: false,
  };
  if (!addons || !grants) return out;
  const byId = new Map(addons.map((a) => [a.id, a]));
  for (const g of grants) {
    const a = byId.get(g.addon_id);
    if (!a || !a.is_active) continue;
    // Each grant boosts the plan by (per-unit boost × granted quantity).
    const qty = Math.max(1, g.quantity ?? 1);
    out.extraMenuItems += (a.extra_menu_items ?? 0) * qty;
    out.extraBranches += (a.extra_branches ?? 0) * qty;
    out.extraStaff += (a.extra_staff ?? 0) * qty;
    if (a.unlimited_menu_items) out.unlimitedMenuItems = true;
    if (a.unlimited_branches) out.unlimitedBranches = true;
    if (a.unlimited_staff) out.unlimitedStaff = true;
  }
  return out;
}

/** Purchase requests scoped to the current tenant. */
export function useMyAddonRequests() {
  const { data: restaurant } = useCurrentRestaurant();
  return useQuery<AddonPurchaseRequest[]>({
    queryKey: ['addon-requests', 'mine', restaurant?.id],
    queryFn: async () => {
      if (!restaurant) return [];
      const { data, error } = await supabase
        .from('addon_purchase_requests' as any)
        .select('*')
        .eq('restaurant_id', restaurant.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AddonPurchaseRequest[];
    },
    enabled: !!restaurant,
    staleTime: 15_000,
  });
}

/** All purchase requests — platform admin only. */
export function useAllAddonRequests() {
  return useQuery<AddonPurchaseRequest[]>({
    queryKey: ['addon-requests', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('addon_purchase_requests' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AddonPurchaseRequest[];
    },
    staleTime: 15_000,
  });
}
