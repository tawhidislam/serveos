import { expect, it } from 'vitest';
import { collectedThisMonth } from '@/lib/billing-summary';

it('counts approved collections in the review month and keeps currencies separate', () => {
  const now = new Date('2026-10-15T00:00:00Z');
  const base = { created_at: '2026-09-30T10:00:00Z', reviewed_at: '2026-10-01T00:00:00Z', status: 'approved', amount: 349, currency: 'BDT' };
  expect(collectedThisMonth([base, { ...base, amount: 5, currency: 'USD' }, { ...base, status: 'pending' }, { ...base, status: 'rejected' }], now)).toEqual({ BDT: 349, USD: 5 });
});
it('uses the client timezone at month boundaries', () => {
  expect(collectedThisMonth([{ status: 'approved', amount: 944, currency: 'BDT', created_at: '2026-09-30T17:00:00Z' }], new Date('2026-10-01T00:00:00Z'))).toEqual({ BDT: 944 });
});
