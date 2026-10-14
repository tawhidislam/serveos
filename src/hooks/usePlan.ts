import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { PLAN_LIMITS, type PlanTier, type PlanLimits } from '@/lib/plans';
import { useSubscriptionPlans, findPlanByTier, SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { useActiveAddonFeatureKeys, useActiveAddonQuantityBoosts } from '@/hooks/useAddons';

interface PlanState {
  tier: PlanTier;
  limits: PlanLimits;
  status: string;
  isActive: boolean;
}

/** Map a DB plan row to the PlanLimits shape used across the app. */
function dbPlanToLimits(p: SubscriptionPlan): PlanLimits {
  return {
    maxMenuItems: p.max_menu_items,
    maxBranches: p.max_branches,
    maxStaff: p.max_staff,
    accounting: p.feature_accounting,
    loyalty: p.feature_loyalty,
    promotions: p.feature_promotions,
    floorPlans: p.feature_floor_plans,
    customDomain: p.feature_custom_domain,
    // Operations suite is locked only on the free tier; any paid DB plan unlocks it.
    operations: (p.tier ?? '').toLowerCase() !== 'free',
  };
}

/** Returns the current restaurant's subscription plan and feature limits. */
export function usePlan() {
  const { data: restaurant } = useCurrentRestaurant();
  const { data: plans } = useSubscriptionPlans();
  const boosts = useActiveAddonQuantityBoosts();
  const addonFeatures = useActiveAddonFeatureKeys();

  return useQuery<PlanState>({
    queryKey: [
      'plan',
      restaurant?.id,
      plans?.map((p) => p.id).join(','),
      boosts.extraMenuItems,
      boosts.extraBranches,
      boosts.extraStaff,
      boosts.unlimitedMenuItems,
      boosts.unlimitedBranches,
      boosts.unlimitedStaff,
      Array.from(addonFeatures).sort().join(','),
    ],
    queryFn: async () => {
      if (!restaurant) {
        return { tier: 'free', limits: PLAN_LIMITS.free, status: 'inactive', isActive: false };
      }
      const { data } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('restaurant_id', restaurant.id)
        .maybeSingle();
      const tier = (data?.plan ?? 'free') as PlanTier;
      const status = data?.status ?? 'trialing';
      const periodLapsed = tier !== 'free' && !!data?.current_period_end && Date.parse(data.current_period_end) <= Date.now();
      const active = (status === 'active' || status === 'trialing') && !periodLapsed;
      const dbPlan = findPlanByTier(plans, tier);
      // Resolve base limits with a safe fallback. The DB now ships custom
      // tiers (monthly/quarterly/biannual/yearly) that are NOT in PLAN_LIMITS;
      // if the plans list hasn't loaded yet (or RLS hides the row), we must
      // not return `undefined` — that previously broke FeatureGate and locked
      // paying customers out. Any non-free tier inherits the legacy `pro`
      // unlocks as a safe default.
      const fallbackLimits =
        PLAN_LIMITS[tier] ?? (tier === 'free' ? PLAN_LIMITS.free : PLAN_LIMITS.pro);
      const baseLimits = active ? (dbPlan ? dbPlanToLimits(dbPlan) : fallbackLimits) : PLAN_LIMITS.free;


      // Apply add-on boosts: unlimited_* wins; otherwise add extras to the
      // numeric base. Boolean feature flags stay as-is — useFeatureAccess
      // already merges the addonFeatures set on top.
      const limits: PlanLimits = {
        ...baseLimits,
        maxMenuItems: boosts.unlimitedMenuItems
          ? null
          : baseLimits.maxMenuItems == null
            ? null
            : baseLimits.maxMenuItems + boosts.extraMenuItems,
        maxBranches: boosts.unlimitedBranches
          ? null
          : baseLimits.maxBranches == null
            ? null
            : baseLimits.maxBranches + boosts.extraBranches,
        maxStaff: boosts.unlimitedStaff
          ? null
          : baseLimits.maxStaff == null
            ? null
            : baseLimits.maxStaff + boosts.extraStaff,
        accounting: baseLimits.accounting || addonFeatures.has('accounting'),
        loyalty: baseLimits.loyalty || addonFeatures.has('loyalty'),
        promotions: baseLimits.promotions || addonFeatures.has('promotions'),
        floorPlans: baseLimits.floorPlans || addonFeatures.has('floorPlans'),
        customDomain: baseLimits.customDomain || addonFeatures.has('customDomain'),
        operations: baseLimits.operations || addonFeatures.has('operations'),
      };

      return {
        tier,
        limits,
        status,
        isActive: active,
      };
    },
    enabled: !!restaurant,
    staleTime: 60_000,
  });
}

/**
 * Convenience hook: check if a specific feature flag is unlocked.
 * Plan flag OR active add-on grant unlocks the feature (additive — never tightens access).
 */
export function useFeatureAccess(feature: keyof PlanLimits): boolean {
  const { data } = usePlan();
  const addonFeatures = useActiveAddonFeatureKeys();
  if (!data?.isActive) return false;
  if (addonFeatures.has(feature as string)) return true;
  const value = data.limits[feature];
  return typeof value === 'boolean' ? value : true;
}

