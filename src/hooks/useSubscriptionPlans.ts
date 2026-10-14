import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { PlanTier } from '@/lib/plans';

/** One currency's authored prices for a subscription plan. */
export interface PlanCurrencyPrice {
  monthly: number;
  yearly: number;
  original_monthly: number | null;
  original_yearly: number | null;
}

export interface SubscriptionPlan {
  id: string;
  tier: PlanTier;
  name: string;
  description: string | null;
  badge: string | null;
  sort_order: number;
  is_public: boolean;
  is_active: boolean;
  price_monthly: number;
  price_yearly: number;
  /** Optional pre-discount monthly price shown crossed-out on the public pricing page. */
  original_price_monthly: number | null;
  /** Optional pre-discount yearly price shown crossed-out on the public pricing page. */
  original_price_yearly: number | null;
  /** Base/default currency for this plan. Used as the fallback when the
   * viewer-selected currency has no authored entry in `prices`. */
  currency: string;
  /** Per-currency authored prices, keyed by ISO code (e.g. "USD", "BDT").
   * Each entry mirrors the base price fields. When a selected currency is
   * missing here, consumers fall back to the base `price_*` columns.
   * Shape: { [code]: { monthly, yearly, original_monthly, original_yearly } } */
  prices: Record<string, PlanCurrencyPrice> | null;
  max_menu_items: number | null;
  max_branches: number | null;
  max_staff: number | null;
  max_monthly_orders: number | null;
  feature_accounting: boolean;
  feature_loyalty: boolean;
  feature_promotions: boolean;
  feature_floor_plans: boolean;
  feature_ai_images: boolean;
  feature_custom_domain: boolean;
  feature_multi_branch: boolean;
  feature_pos: boolean;
  feature_kds: boolean;
  /** Editable bullet list shown inside this plan's card on /pricing.
   * If empty, the public page falls back to a built-in default list. */
  features: string[];
  /** Optional custom heading for the bullets section on the pricing card.
   * Falls back to "What's included" when empty. */
  features_heading: string | null;
  /** Whether the bullets section renders on the pricing card. Defaults to true. */
  features_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Fetch all subscription plans (platform-admin sees inactive too via RLS). */
export function useSubscriptionPlans() {
  return useQuery<SubscriptionPlan[]>({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans' as any)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as SubscriptionPlan[];
    },
    staleTime: 60_000,
  });
}

/** Find plan by tier from a fetched list. */
export function findPlanByTier(plans: SubscriptionPlan[] | undefined, tier: PlanTier) {
  return plans?.find((p) => p.tier === tier);
}
