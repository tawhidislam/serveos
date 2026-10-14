/**
 * Plan length. Packages encode their duration in the tier
 * (`quarterly` → 3 months, `biannual` → 6 months); legacy payments may only
 * carry a `billing_cycle`. Mirrors the SQL helper used when activating paid
 * periods, so marketing labels and billing always agree.
 */
function monthsFromKey(key: string): number | null {
  const k = key.toLowerCase().trim();
  if (k === 'quarterly' || k === '3_month' || k === '3month' || k === 'three_month') return 3;
  if (k === 'biannual' || k === 'semiannual' || k === '6_month' || k === '6month' || k === 'six_month') return 6;
  if (k === 'yearly' || k === 'annual') return 12;
  if (k === 'monthly') return 1;
  return null;
}

/** Months covered by one payment for a plan tier, falling back to the billing cycle. */
export function planDurationMonths(tier?: string | null, billingCycle?: string | null): number {
  return monthsFromKey(tier ?? '') ?? monthsFromKey(billingCycle ?? '') ?? 1;
}

/** Suffix shown after a package price: "/mo", "/yr" or "/ 3 months". */
export function durationSuffix(months: number): string {
  if (months <= 1) return '/mo';
  if (months === 12) return '/yr';
  return `/ ${months} months`;
}

export function isTrialPlan(tier?: string | null): boolean { return tier === 'trial'; }
export function planTermLabel(tier?: string | null, cycle?: string | null): string {
  if (isTrialPlan(tier)) return '7 days';
  const months = planDurationMonths(tier, cycle);
  return `${months} month${months === 1 ? '' : 's'}`;
}
export function planTermSuffix(tier?: string | null, cycle?: string | null): string {
  return isTrialPlan(tier) ? '/ 7 days' : durationSuffix(planDurationMonths(tier, cycle));
}
