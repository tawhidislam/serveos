import { expect, it } from 'vitest';
import type { SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { updatePackagePrice } from '@/lib/package-editor';
import { getPlanPrice } from '@/lib/plan-pricing';

it('updates the customer-visible currency price and preserves other currencies', () => {
  const plan: SubscriptionPlan = {
    id: 'test', tier: 'monthly', name: 'Monthly', description: null, badge: null, sort_order: 1, is_public: true, is_active: true,
    max_menu_items: null, max_branches: null, max_staff: null, max_monthly_orders: null,
    feature_accounting: true, feature_loyalty: true, feature_promotions: false, feature_floor_plans: true,
    feature_custom_domain: true, feature_multi_branch: false, feature_pos: true, feature_kds: true, feature_ai_images: false,
    features: [], features_heading: null, features_visible: true,
    currency: 'BDT', price_monthly: 349, price_yearly: 0, original_price_monthly: 802, original_price_yearly: null,
    prices: { BDT: { monthly: 349, yearly: 0, original_monthly: 802, original_yearly: null }, USD: { monthly: 5, yearly: 50, original_monthly: null, original_yearly: null } },
  };
  const updated = updatePackagePrice(plan, 'monthly', 399, 900);
  expect(updated.price_monthly).toBe(399);
  expect(getPlanPrice(updated, 'BDT', 'monthly')).toMatchObject({ current: 399, original: 900 });
  expect(updated.prices?.USD).toEqual(plan.prices?.USD);
  expect(plan.prices?.BDT.monthly).toBe(349);
});
