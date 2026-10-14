-- Add original (pre-discount) price columns so admins can show "Save X" on the marketing pricing page.
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS original_price_monthly numeric,
  ADD COLUMN IF NOT EXISTS original_price_yearly numeric;

COMMENT ON COLUMN public.subscription_plans.original_price_monthly IS 'Optional pre-discount monthly price shown crossed-out on the public pricing page.';
COMMENT ON COLUMN public.subscription_plans.original_price_yearly  IS 'Optional pre-discount yearly price shown crossed-out on the public pricing page.';

-- Seed four billing-period plans matching the Zatiq-style pricing page layout.
-- Use ON CONFLICT on (tier) so re-running this migration is idempotent for these specific tiers.
INSERT INTO public.subscription_plans (
  tier, name, description, badge, sort_order, is_public, is_active,
  price_monthly, price_yearly, currency,
  original_price_monthly, original_price_yearly,
  max_menu_items, max_branches, max_staff, max_monthly_orders,
  feature_accounting, feature_loyalty, feature_promotions, feature_floor_plans,
  feature_ai_images, feature_custom_domain, feature_multi_branch, feature_pos, feature_kds
) VALUES
  (
    'monthly', 'Monthly Plan',
    'Try us out for a month. Cancel anytime.',
    NULL, 10, true, true,
    500, 0, 'BDT',
    700, NULL,
    NULL, 1, NULL, NULL,
    true, true, true, true, true, true, true, true, true
  ),
  (
    'quarterly', '3 Months Plan',
    'Our most popular plan for small teams.',
    'Popular', 20, true, true,
    1200, 0, 'BDT',
    1500, NULL,
    NULL, 1, NULL, NULL,
    true, true, true, true, true, true, true, true, true
  ),
  (
    'biannual', '6 Months Plan',
    'Save more by committing to half a year.',
    NULL, 30, true, true,
    2200, 0, 'BDT',
    3000, NULL,
    NULL, 1, NULL, NULL,
    true, true, true, true, true, true, true, true, true
  ),
  (
    'yearly', 'Yearly Plan',
    'Best value — biggest savings of the year.',
    'Popular', 40, true, true,
    5000, 0, 'BDT',
    6000, NULL,
    NULL, 1, NULL, NULL,
    true, true, true, true, true, true, true, true, true
  )
ON CONFLICT (tier) DO UPDATE SET
  name                   = EXCLUDED.name,
  description            = EXCLUDED.description,
  badge                  = EXCLUDED.badge,
  sort_order             = EXCLUDED.sort_order,
  is_public              = EXCLUDED.is_public,
  is_active              = EXCLUDED.is_active,
  price_monthly          = EXCLUDED.price_monthly,
  price_yearly           = EXCLUDED.price_yearly,
  currency               = EXCLUDED.currency,
  original_price_monthly = EXCLUDED.original_price_monthly,
  original_price_yearly  = EXCLUDED.original_price_yearly;