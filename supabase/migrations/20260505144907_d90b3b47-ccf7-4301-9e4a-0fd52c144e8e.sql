
-- Helper: months implied by plan tier (preferred) or billing cycle (fallback).
CREATE OR REPLACE FUNCTION public.subscription_period_months(_plan text, _cycle text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(coalesce(_plan,'')) IN ('quarterly','3_month','3month','three_month') THEN 3
    WHEN lower(coalesce(_plan,'')) IN ('biannual','semiannual','6_month','6month','six_month') THEN 6
    WHEN lower(coalesce(_plan,'')) IN ('yearly','annual') THEN 12
    WHEN lower(coalesce(_plan,'')) = 'monthly' THEN 1
    WHEN lower(coalesce(_cycle,'')) IN ('quarterly','3_month','three_month') THEN 3
    WHEN lower(coalesce(_cycle,'')) IN ('biannual','semiannual','6_month','six_month') THEN 6
    WHEN lower(coalesce(_cycle,'')) IN ('yearly','annual') THEN 12
    ELSE 1
  END
$$;

-- Canonical billing cycle label for a plan tier (NULL = not duration-encoded).
CREATE OR REPLACE FUNCTION public.canonical_billing_cycle_for_plan(_plan text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE lower(coalesce(_plan,''))
    WHEN 'monthly' THEN 'monthly'
    WHEN 'quarterly' THEN 'quarterly'
    WHEN '3_month' THEN 'quarterly'
    WHEN '3month' THEN 'quarterly'
    WHEN 'three_month' THEN 'quarterly'
    WHEN 'biannual' THEN 'biannual'
    WHEN 'semiannual' THEN 'biannual'
    WHEN '6_month' THEN 'biannual'
    WHEN '6month' THEN 'biannual'
    WHEN 'six_month' THEN 'biannual'
    WHEN 'yearly' THEN 'yearly'
    WHEN 'annual' THEN 'yearly'
    ELSE NULL
  END
$$;

-- Trigger: subscriptions sanity check
CREATE OR REPLACE FUNCTION public.validate_subscription_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan text := lower(coalesce(NEW.plan, 'free'));
BEGIN
  IF v_plan = 'free' THEN
    -- Free plans never have a paid renewal window; force a clean state.
    NEW.current_period_end := NULL;
    IF NEW.status NOT IN ('expired','canceled','trialing') THEN
      NEW.status := 'expired';
    END IF;
    RETURN NEW;
  END IF;

  -- Paid plans that are active/trialing must have a future renewal date.
  IF NEW.status IN ('active','trialing') THEN
    IF NEW.current_period_end IS NULL THEN
      RAISE EXCEPTION 'Subscription on plan % with status % requires current_period_end',
        NEW.plan, NEW.status;
    END IF;
    IF NEW.current_period_end > now() + INTERVAL '10 years' THEN
      RAISE EXCEPTION 'current_period_end is too far in the future (max 10 years)';
    END IF;
    -- Auto-expire if the renewal date is already in the past.
    IF NEW.current_period_end <= now() THEN
      NEW.status := 'expired';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_subscription_consistency ON public.subscriptions;
CREATE TRIGGER trg_validate_subscription_consistency
BEFORE INSERT OR UPDATE ON public.subscriptions
FOR EACH ROW EXECUTE FUNCTION public.validate_subscription_consistency();

-- Trigger: normalize billing_cycle on subscription_payments to match plan tier
CREATE OR REPLACE FUNCTION public.normalize_subscription_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  canonical text := public.canonical_billing_cycle_for_plan(NEW.plan);
BEGIN
  -- If the plan tier encodes its own duration, force billing_cycle to match.
  IF canonical IS NOT NULL THEN
    NEW.billing_cycle := canonical;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_subscription_payment ON public.subscription_payments;
CREATE TRIGGER trg_normalize_subscription_payment
BEFORE INSERT OR UPDATE ON public.subscription_payments
FOR EACH ROW EXECUTE FUNCTION public.normalize_subscription_payment();

-- Backfill: align existing payment rows with their plan tier.
UPDATE public.subscription_payments
SET billing_cycle = public.canonical_billing_cycle_for_plan(plan)
WHERE public.canonical_billing_cycle_for_plan(plan) IS NOT NULL
  AND billing_cycle <> public.canonical_billing_cycle_for_plan(plan);
