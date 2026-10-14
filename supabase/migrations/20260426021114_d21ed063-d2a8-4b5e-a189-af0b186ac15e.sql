-- ============================================================
-- Subscription coupons
-- ============================================================

CREATE TABLE IF NOT EXISTS public.subscription_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent', -- 'percent' | 'fixed'
  discount_value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_redemptions INTEGER,                       -- NULL = unlimited
  redemption_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  applies_to_plans TEXT[],                       -- NULL/empty = all plans
  applies_to_cycles TEXT[],                      -- NULL/empty = all cycles ('monthly'/'yearly')
  min_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT subscription_coupons_discount_type_chk
    CHECK (discount_type IN ('percent','fixed')),
  CONSTRAINT subscription_coupons_discount_value_chk
    CHECK (discount_value >= 0),
  CONSTRAINT subscription_coupons_percent_max_chk
    CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

-- Always store codes uppercased for case-insensitive matching.
CREATE OR REPLACE FUNCTION public.normalize_subscription_coupon()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    RAISE EXCEPTION 'Coupon code is required';
  END IF;
  NEW.code := upper(trim(NEW.code));
  IF NEW.code !~ '^[A-Z0-9_-]{3,40}$' THEN
    RAISE EXCEPTION 'Coupon code must be 3-40 chars: A-Z, 0-9, _ or -';
  END IF;
  -- Empty arrays should behave like NULL ("applies to all").
  IF NEW.applies_to_plans IS NOT NULL AND array_length(NEW.applies_to_plans,1) IS NULL THEN
    NEW.applies_to_plans := NULL;
  END IF;
  IF NEW.applies_to_cycles IS NOT NULL AND array_length(NEW.applies_to_cycles,1) IS NULL THEN
    NEW.applies_to_cycles := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_coupons_normalize ON public.subscription_coupons;
CREATE TRIGGER subscription_coupons_normalize
  BEFORE INSERT OR UPDATE ON public.subscription_coupons
  FOR EACH ROW EXECUTE FUNCTION public.normalize_subscription_coupon();

ALTER TABLE public.subscription_coupons ENABLE ROW LEVEL SECURITY;

-- Only platform admins can read or modify the master coupon table.
CREATE POLICY "Platform admins manage subscription coupons"
  ON public.subscription_coupons
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ============================================================
-- subscription_payments — discount tracking
-- ============================================================

ALTER TABLE public.subscription_payments
  ADD COLUMN IF NOT EXISTS coupon_id UUID REFERENCES public.subscription_coupons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS coupon_code TEXT,
  ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC NOT NULL DEFAULT 0;

-- ============================================================
-- Validation function (callable by any authenticated user)
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_subscription_coupon(
  _code TEXT,
  _plan TEXT,
  _cycle TEXT,
  _amount NUMERIC
)
RETURNS TABLE (
  valid BOOLEAN,
  reason TEXT,
  coupon_id UUID,
  code TEXT,
  description TEXT,
  discount_type TEXT,
  discount_value NUMERIC,
  discount_amount NUMERIC,
  final_amount NUMERIC
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.subscription_coupons%ROWTYPE;
  d NUMERIC := 0;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, 'Enter a coupon code'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, 0::numeric, _amount;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.subscription_coupons WHERE code = upper(trim(_code)) LIMIT 1;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Invalid coupon code'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, 0::numeric, _amount;
    RETURN;
  END IF;

  IF NOT c.is_active THEN
    RETURN QUERY SELECT false, 'This coupon is no longer active'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.valid_from IS NOT NULL AND c.valid_from > now() THEN
    RETURN QUERY SELECT false, 'This coupon is not yet active'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.valid_until IS NOT NULL AND c.valid_until < now() THEN
    RETURN QUERY SELECT false, 'This coupon has expired'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.max_redemptions IS NOT NULL AND c.redemption_count >= c.max_redemptions THEN
    RETURN QUERY SELECT false, 'This coupon has reached its usage limit'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.applies_to_plans IS NOT NULL AND NOT (lower(_plan) = ANY(SELECT lower(x) FROM unnest(c.applies_to_plans) AS x)) THEN
    RETURN QUERY SELECT false, 'This coupon does not apply to the selected plan'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.applies_to_cycles IS NOT NULL AND NOT (lower(_cycle) = ANY(SELECT lower(x) FROM unnest(c.applies_to_cycles) AS x)) THEN
    RETURN QUERY SELECT false, 'This coupon does not apply to the selected billing cycle'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF _amount < c.min_amount THEN
    RETURN QUERY SELECT false, format('Minimum order amount of %s required', c.min_amount)::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;

  -- Compute discount.
  IF c.discount_type = 'percent' THEN
    d := round(_amount * c.discount_value / 100.0, 2);
  ELSE
    d := LEAST(c.discount_value, _amount);
  END IF;
  IF d > _amount THEN d := _amount; END IF;
  IF d < 0 THEN d := 0; END IF;

  RETURN QUERY SELECT
    true,
    'Coupon applied'::text,
    c.id,
    c.code,
    c.description,
    c.discount_type,
    c.discount_value,
    d,
    GREATEST(0, _amount - d);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_subscription_coupon(TEXT, TEXT, TEXT, NUMERIC) TO authenticated;

-- ============================================================
-- Auto-redeem on payment approval
-- ============================================================

CREATE OR REPLACE FUNCTION public.redeem_subscription_coupon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Increment redemption_count once when a payment with a coupon transitions
  -- from any non-approved state into 'approved'.
  IF NEW.coupon_id IS NOT NULL
     AND NEW.status = 'approved'
     AND COALESCE(OLD.status, '') <> 'approved' THEN
    UPDATE public.subscription_coupons
    SET redemption_count = redemption_count + 1,
        updated_at = now()
    WHERE id = NEW.coupon_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS subscription_payments_redeem_coupon ON public.subscription_payments;
CREATE TRIGGER subscription_payments_redeem_coupon
  AFTER UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.redeem_subscription_coupon();

-- Helpful indexes.
CREATE INDEX IF NOT EXISTS idx_subscription_coupons_code ON public.subscription_coupons(code);
CREATE INDEX IF NOT EXISTS idx_subscription_coupons_active ON public.subscription_coupons(is_active) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_subscription_payments_coupon ON public.subscription_payments(coupon_id);