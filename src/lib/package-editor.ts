import type { SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import type { BillingCycle } from '@/lib/plan-pricing';
import { getPlanPrice } from '@/lib/plan-pricing';

/** Update the base price and its public currency entry together. */
export function updatePackagePrice(plan: SubscriptionPlan, cycle: BillingCycle, current: number, original: number | null): SubscriptionPlan {
  const monthly = getPlanPrice(plan, plan.currency, 'monthly');
  const yearly = getPlanPrice(plan, plan.currency, 'yearly');
  const entry = {
    monthly: cycle === 'monthly' ? current : monthly.current,
    yearly: cycle === 'yearly' ? current : yearly.current,
    original_monthly: cycle === 'monthly' ? original : monthly.original,
    original_yearly: cycle === 'yearly' ? original : yearly.original,
  };
  return {
    ...plan, price_monthly: entry.monthly, price_yearly: entry.yearly,
    original_price_monthly: entry.original_monthly, original_price_yearly: entry.original_yearly,
    prices: { ...plan.prices, [plan.currency]: entry },
  };
}
