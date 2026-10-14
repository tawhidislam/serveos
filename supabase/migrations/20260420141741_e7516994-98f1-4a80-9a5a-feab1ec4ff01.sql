CREATE TABLE public.subscription_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier public.plan_tier NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  badge TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- pricing
  price_monthly NUMERIC NOT NULL DEFAULT 0,
  price_yearly NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  -- limits (NULL = unlimited)
  max_menu_items INTEGER,
  max_branches INTEGER,
  max_staff INTEGER,
  max_monthly_orders INTEGER,
  -- feature flags
  feature_accounting BOOLEAN NOT NULL DEFAULT false,
  feature_loyalty BOOLEAN NOT NULL DEFAULT false,
  feature_promotions BOOLEAN NOT NULL DEFAULT false,
  feature_floor_plans BOOLEAN NOT NULL DEFAULT false,
  feature_ai_images BOOLEAN NOT NULL DEFAULT false,
  feature_custom_domain BOOLEAN NOT NULL DEFAULT false,
  feature_multi_branch BOOLEAN NOT NULL DEFAULT false,
  feature_pos BOOLEAN NOT NULL DEFAULT true,
  feature_kds BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public plans are viewable by all"
ON public.subscription_plans FOR SELECT
USING (is_active = true AND is_public = true);

CREATE POLICY "Platform admins view all plans"
ON public.subscription_plans FOR SELECT
TO authenticated
USING (public.is_platform_admin());

CREATE POLICY "Platform admins manage plans"
ON public.subscription_plans FOR ALL
TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

CREATE TRIGGER update_subscription_plans_updated_at
BEFORE UPDATE ON public.subscription_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing tiers from hardcoded PLAN_LIMITS
INSERT INTO public.subscription_plans (
  tier, name, description, badge, sort_order, price_monthly, price_yearly, currency,
  max_menu_items, max_branches, max_staff, max_monthly_orders,
  feature_accounting, feature_loyalty, feature_promotions, feature_floor_plans,
  feature_ai_images, feature_custom_domain, feature_multi_branch
) VALUES
  ('free', 'Free', 'Get started with the essentials.', NULL, 1, 0, 0, 'USD',
    50, 1, 3, 500,
    false, false, false, false, false, false, false),
  ('pro', 'Pro', 'For growing restaurants ready to scale.', 'Most popular', 2, 49, 490, 'USD',
    NULL, 3, 25, NULL,
    true, true, true, true, true, true, true),
  ('enterprise', 'Enterprise', 'Custom multi-location, dedicated support.', 'Custom', 3, 0, 0, 'USD',
    NULL, NULL, NULL, NULL,
    true, true, true, true, true, true, true);