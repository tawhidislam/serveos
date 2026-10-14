BEGIN;

-- Keep catalog management behind the existing platform-admin RLS policy.
GRANT SELECT ON public.platform_addons TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.platform_addons TO authenticated;

-- Demo catalog only: no restaurant grants, payment requests, or charges.
-- Preserve edits when this seed is reapplied.
INSERT INTO public.platform_addons
  (key, name, description, badge, billing_type, price_amount, currency,
   feature_key, icon, sort_order, is_public, is_active,
   extra_staff, extra_menu_items, extra_branches, allow_multiple, max_quantity)
VALUES
  ('demo-promotions', 'Promotions & Marketing',
   'Unlock promotions and discount campaigns for plans without marketing tools. Demo product with a sample price.',
   'Demo', 'monthly', 149, 'BDT', 'promotions', 'Megaphone', 10, true, true, 0, 0, 0, false, NULL),
  ('demo-accounting', 'Accounting Suite',
   'Unlock the accounting suite for plans that do not include it. Demo product with a sample price.',
   'Demo', 'monthly', 199, 'BDT', 'accounting', 'Calculator', 20, true, true, 0, 0, 0, false, NULL),
  ('demo-loyalty', 'Customer Loyalty',
   'Unlock customer loyalty tools for plans without this feature. Demo product with a sample price.',
   'Demo', 'monthly', 129, 'BDT', 'loyalty', 'Heart', 30, true, true, 0, 0, 0, false, NULL),
  ('demo-floor-plans', 'Floor Plan Manager',
   'Unlock floor plans and table layouts for plans without this feature. Demo product with a sample price.',
   'Demo', 'monthly', 99, 'BDT', 'floorPlans', 'LayoutGrid', 40, true, true, 0, 0, 0, false, NULL),
  ('demo-custom-domain', 'Custom Domain Access',
   'Unlock custom domain settings; domain registration is separate. Demo product with a sample price.',
   'Demo', 'monthly', 99, 'BDT', 'customDomain', 'Globe', 50, true, true, 0, 0, 0, false, NULL),
  ('demo-extra-staff', '5 Extra Staff Accounts',
   'Add five staff slots per unit to a capped plan. Unlimited plans already include this capacity. Demo product with a sample price.',
   'Demo', 'monthly', 79, 'BDT', NULL, 'Users', 60, true, true, 5, 0, 0, true, 10),
  ('demo-extra-menu', '100 Extra Menu Items',
   'Add 100 menu item slots per unit to a capped plan. Unlimited plans already include this capacity. Demo product with a sample price.',
   'Demo', 'monthly', 99, 'BDT', NULL, 'UtensilsCrossed', 70, true, true, 0, 100, 0, true, 10),
  ('demo-extra-branch', 'Extra Branch Capacity',
   'Add one branch slot per unit to a capped plan. Branch management must be available on your plan. Demo product with a sample price.',
   'Demo', 'monthly', 199, 'BDT', NULL, 'Building2', 80, true, true, 0, 0, 1, true, 10)
ON CONFLICT (key) DO NOTHING;

COMMIT;
