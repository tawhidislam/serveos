import { expect, it } from 'vitest';
import type { SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { getPlanCycle, getPlanPrice } from '@/lib/plan-pricing';
import { planDurationMonths } from '@/lib/plan-duration';

it.each([
  ['monthly', 349, 802, 1, 56, 453],
  ['quarterly', 944, 1500, 3, 37, 556],
  ['biannual', 1444, 3000, 6, 52, 1556],
  ['yearly', 2197, 6000, 12, 63, 3803],
] as const)('resolves the %s package total, term and savings even when monthly was selected', (tier, price, original, months, pct, saved) => {
  const yearly = tier === 'yearly';
  const plan = {
    tier, currency: 'BDT', prices: {},
    price_monthly: yearly ? 0 : price, price_yearly: yearly ? price : 0,
    original_price_monthly: yearly ? null : original, original_price_yearly: yearly ? original : null,
  } as SubscriptionPlan;
  const cycle = getPlanCycle(plan, 'BDT', 'monthly');
  expect(getPlanPrice(plan, 'BDT', cycle)).toMatchObject({ current: price, original, savings: saved, savingsPct: pct });
  expect(planDurationMonths(tier, cycle)).toBe(months);
});
