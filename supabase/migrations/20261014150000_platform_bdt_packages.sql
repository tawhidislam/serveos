-- User-authored BDT packages. Prices for multi-month tiers are full package totals.
BEGIN;
INSERT INTO public.subscription_plans (
  tier, name, description, badge, sort_order, is_public, is_active, currency, price_monthly, price_yearly, original_price_monthly, original_price_yearly, prices, features, features_heading, features_visible, max_monthly_orders, feature_accounting, feature_loyalty, feature_floor_plans, feature_custom_domain, feature_pos, feature_kds
) VALUES
  ('monthly', 'Monthly Plan', 'Try us out for a month. Cancel anytime.', NULL, 10, true, true, 'BDT', 349, 0, 802, NULL, '{"BDT": {"monthly": 349, "yearly": 0, "original_monthly": 802, "original_yearly": null}}'::jsonb, '["Accounting suite", "Explore our 4 free subdomains", "Add your custom domain", "Public Website for your restaurants", "Table QR & NFC order System", "Unlimited order and receipt processing", "Theme customization", "Track customer loyalty & customer list", "Enable alerts", "Dashboard", "Export reports", "Floor plans"]'::jsonb, 'What''s included', true, NULL, true, true, true, true, true, true),
  ('quarterly', '3 Months Plan', 'Our most popular plan for small teams.', 'Most popular', 20, true, true, 'BDT', 944, 0, 1500, NULL, '{"BDT": {"monthly": 944, "yearly": 0, "original_monthly": 1500, "original_yearly": null}}'::jsonb, '["Accounting suite", "Explore our 4 free subdomains", "Add your custom domain", "Public Website for your restaurants", "Table QR & NFC order System", "Unlimited order and receipt processing", "Theme customization", "Track customer loyalty & customer list", "Enable alerts", "Export reports", "Floor plans"]'::jsonb, 'What''s included', true, NULL, true, true, true, true, true, true),
  ('biannual', '6 Months Plan', 'Save more by committing to half a year.', NULL, 30, true, true, 'BDT', 1444, 0, 3000, NULL, '{"BDT": {"monthly": 1444, "yearly": 0, "original_monthly": 3000, "original_yearly": null}}'::jsonb, '["Accounting suite", "Explore our 4 free subdomains", "Add your custom domain", "Public Website for your restaurants", "Table QR & NFC order System", "Unlimited order and receipt processing", "Theme customization", "Track customer loyalty & customer list", "Enable alerts", "Export reports", "Floor plans"]'::jsonb, 'What''s included', true, NULL, true, true, true, true, true, true),
  ('yearly', 'Yearly Plan', 'Best value — biggest savings of the year.', NULL, 40, true, true, 'BDT', 0, 2197, NULL, 6000, '{"BDT": {"monthly": 0, "yearly": 2197, "original_monthly": null, "original_yearly": 6000}}'::jsonb, '["Accounting suite", "Explore our 4 free subdomains", "Add your custom domain", "Public Website for your restaurants", "Table QR & NFC order System", "Unlimited order and receipt processing", "Theme customization", "Track customer loyalty & customer list", "Enable alerts", "Export reports", "Floor plans"]'::jsonb, 'What''s included', true, NULL, true, true, true, true, true, true)
ON CONFLICT (tier) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  badge = EXCLUDED.badge,
  sort_order = EXCLUDED.sort_order,
  is_public = EXCLUDED.is_public,
  is_active = EXCLUDED.is_active,
  currency = EXCLUDED.currency,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  original_price_monthly = EXCLUDED.original_price_monthly,
  original_price_yearly = EXCLUDED.original_price_yearly,
  prices = EXCLUDED.prices,
  features = EXCLUDED.features,
  features_heading = EXCLUDED.features_heading,
  features_visible = EXCLUDED.features_visible,
  max_monthly_orders = EXCLUDED.max_monthly_orders,
  feature_accounting = EXCLUDED.feature_accounting,
  feature_loyalty = EXCLUDED.feature_loyalty,
  feature_floor_plans = EXCLUDED.feature_floor_plans,
  feature_custom_domain = EXCLUDED.feature_custom_domain,
  feature_pos = EXCLUDED.feature_pos,
  feature_kds = EXCLUDED.feature_kds,
  updated_at = now();
COMMIT;
