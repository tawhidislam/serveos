-- ============================================================
-- 1. Extend addon_purchase_requests with mobile-banking fields
-- ============================================================
ALTER TABLE public.addon_purchase_requests
  ADD COLUMN IF NOT EXISTS sender_number    TEXT,
  ADD COLUMN IF NOT EXISTS transaction_id   TEXT,
  ADD COLUMN IF NOT EXISTS reference_code   TEXT,
  ADD COLUMN IF NOT EXISTS original_amount  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS discount_amount  NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS addon_coupon_id  UUID,
  ADD COLUMN IF NOT EXISTS coupon_code      TEXT;

-- Prevent duplicate TrxIDs per provider (matches subscription_payments behaviour).
CREATE UNIQUE INDEX IF NOT EXISTS idx_addon_requests_unique_trx
  ON public.addon_purchase_requests(payment_method, transaction_id)
  WHERE transaction_id IS NOT NULL;

-- ============================================================
-- 2. Dedicated add-on coupons (kept separate from plan coupons)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.addon_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL DEFAULT 'percent',
  discount_value NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'BDT',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  max_redemptions INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ,
  valid_until TIMESTAMPTZ,
  applies_to_addons UUID[],          -- NULL = all add-ons
  applies_to_billing_types TEXT[],   -- NULL = all ('monthly','one_time')
  min_amount NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT addon_coupons_discount_type_chk
    CHECK (discount_type IN ('percent','fixed')),
  CONSTRAINT addon_coupons_discount_value_chk
    CHECK (discount_value >= 0),
  CONSTRAINT addon_coupons_percent_max_chk
    CHECK (discount_type <> 'percent' OR discount_value <= 100)
);

-- Normalize codes to upper-case + validate format.
CREATE OR REPLACE FUNCTION public.normalize_addon_coupon()
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
  IF NEW.applies_to_addons IS NOT NULL AND array_length(NEW.applies_to_addons,1) IS NULL THEN
    NEW.applies_to_addons := NULL;
  END IF;
  IF NEW.applies_to_billing_types IS NOT NULL AND array_length(NEW.applies_to_billing_types,1) IS NULL THEN
    NEW.applies_to_billing_types := NULL;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS addon_coupons_normalize ON public.addon_coupons;
CREATE TRIGGER addon_coupons_normalize
  BEFORE INSERT OR UPDATE ON public.addon_coupons
  FOR EACH ROW EXECUTE FUNCTION public.normalize_addon_coupon();

ALTER TABLE public.addon_coupons ENABLE ROW LEVEL SECURITY;

-- Tenants need read access to validate codes they enter at checkout.
CREATE POLICY "Anyone authenticated can read addon coupons"
  ON public.addon_coupons FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage addon coupons"
  ON public.addon_coupons FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ============================================================
-- 3. RPC: validate_addon_coupon
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_addon_coupon(
  _code TEXT,
  _addon_id UUID,
  _billing_type TEXT,
  _amount NUMERIC
)
RETURNS TABLE(
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
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c public.addon_coupons%ROWTYPE;
  d NUMERIC := 0;
BEGIN
  IF _code IS NULL OR length(trim(_code)) = 0 THEN
    RETURN QUERY SELECT false, 'Enter a coupon code'::text, NULL::uuid, NULL::text, NULL::text, NULL::text, NULL::numeric, 0::numeric, _amount;
    RETURN;
  END IF;

  SELECT * INTO c FROM public.addon_coupons WHERE code = upper(trim(_code)) LIMIT 1;
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
  IF c.applies_to_addons IS NOT NULL AND NOT (_addon_id = ANY(c.applies_to_addons)) THEN
    RETURN QUERY SELECT false, 'This coupon does not apply to the selected add-on'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF c.applies_to_billing_types IS NOT NULL AND NOT (lower(_billing_type) = ANY(SELECT lower(x) FROM unnest(c.applies_to_billing_types) AS x)) THEN
    RETURN QUERY SELECT false, 'This coupon does not apply to the selected billing type'::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;
  IF _amount < c.min_amount THEN
    RETURN QUERY SELECT false, format('Minimum order amount of %s required', c.min_amount)::text, c.id, c.code, c.description, c.discount_type, c.discount_value, 0::numeric, _amount;
    RETURN;
  END IF;

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

-- ============================================================
-- 4. Trigger: redeem add-on coupon on approval
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_addon_coupon()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.addon_coupon_id IS NOT NULL
     AND NEW.status = 'approved'
     AND COALESCE(OLD.status, '') <> 'approved' THEN
    UPDATE public.addon_coupons
    SET redemption_count = redemption_count + 1,
        updated_at = now()
    WHERE id = NEW.addon_coupon_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_redeem_addon_coupon ON public.addon_purchase_requests;
CREATE TRIGGER trg_redeem_addon_coupon
  AFTER UPDATE ON public.addon_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.redeem_addon_coupon();