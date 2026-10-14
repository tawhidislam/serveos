import { expect, it } from 'vitest';
import { isTrialPlan, planTermLabel, planTermSuffix } from '@/lib/plan-duration';
it('labels the trial in days rather than a month', () => {
  expect(isTrialPlan('trial')).toBe(true);
  expect(planTermLabel('trial', 'monthly')).toBe('7 days');
  expect(planTermSuffix('trial', 'monthly')).toBe('/ 7 days');
  expect(planTermLabel('quarterly', 'monthly')).toBe('3 months');
});
