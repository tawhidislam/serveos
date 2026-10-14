import type { SubscriptionPlan, PlanCurrencyPrice } from '@/hooks/useSubscriptionPlans';

export type BillingCycle = 'monthly' | 'yearly';

export interface ResolvedPlanPrice {
  /** The currency the price is actually denominated in. This may differ from
   * the requested currency when we fell back to the plan's base currency. */
  currency: string;
  /** True when the requested currency had an authored entry; false when we
   * fell back to the plan's base `price_*` columns. */
  isRequestedCurrency: boolean;
  /** Current price for the requested cycle. */
  current: number;
  /** Optional pre-discount price for the requested cycle (crossed-out). */
  original: number | null;
  /** Absolute savings (original - current) when original > current, else null. */
  savings: number | null;
  /** Rounded percentage savings, else null. */
  savingsPct: number | null;
}

/** Pull the authored per-currency entry for `currency`, if present and valid. */
function entryFor(
  plan: SubscriptionPlan,
  currency: string,
): PlanCurrencyPrice | null {
  const prices = plan.prices;
  if (!prices || typeof prices !== 'object') return null;
  const entry = prices[currency];
  if (!entry || typeof entry !== 'object') return null;
  return entry;
}

/**
 * Resolve the price a viewer should see for a plan in a chosen currency and
 * billing cycle. Falls back to the plan's base currency (the legacy
 * `price_*`/`original_price_*` columns) when the chosen currency has no
 * authored entry, so a number is always shown.
 */
export function getPlanPrice(
  plan: SubscriptionPlan,
  currency: string,
  cycle: BillingCycle,
): ResolvedPlanPrice {
  const entry = entryFor(plan, currency);

  let resolvedCurrency: string;
  let isRequestedCurrency: boolean;
  let current: number;
  let original: number | null;

  if (entry) {
    resolvedCurrency = currency;
    isRequestedCurrency = true;
    current = Number(cycle === 'monthly' ? entry.monthly : entry.yearly) || 0;
    original =
      cycle === 'monthly'
        ? entry.original_monthly != null
          ? Number(entry.original_monthly)
          : null
        : entry.original_yearly != null
          ? Number(entry.original_yearly)
          : null;
  } else {
    // Fallback to the plan's base-currency columns.
    resolvedCurrency = plan.currency;
    isRequestedCurrency = false;
    current = Number(cycle === 'monthly' ? plan.price_monthly : plan.price_yearly) || 0;
    original =
      cycle === 'monthly'
        ? plan.original_price_monthly != null
          ? Number(plan.original_price_monthly)
          : null
        : plan.original_price_yearly != null
          ? Number(plan.original_price_yearly)
          : null;
  }

  const savings = original != null && original > current ? original - current : null;
  const savingsPct = savings != null && original ? Math.round((savings / original) * 100) : null;

  return { currency: resolvedCurrency, isRequestedCurrency, current, original, savings, savingsPct };
}

/**
 * Choose which billing cycle a plan card represents. Mirrors the existing
 * marketing logic: a plan that only sets a yearly price is a yearly card.
 * Uses the resolved price in the given currency so cycle detection follows
 * whatever currency the viewer selected.
 */
export function getPlanCycle(plan: SubscriptionPlan, currency: string, preferred?: BillingCycle): BillingCycle {
  // Keep an explicitly selected cycle only when that package offers it.
  if (preferred && getPlanPrice(plan, currency, preferred).current > 0) return preferred;
  const yearly = getPlanPrice(plan, currency, 'yearly').current;
  const monthly = getPlanPrice(plan, currency, 'monthly').current;
  return yearly > 0 && !monthly ? 'yearly' : 'monthly';
}
