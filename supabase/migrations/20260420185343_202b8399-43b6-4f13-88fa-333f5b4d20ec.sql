-- Convert plan_tier enum columns to text so platform admins can create custom packages
ALTER TABLE public.subscription_plans ALTER COLUMN tier TYPE text USING tier::text;
ALTER TABLE public.subscriptions ALTER COLUMN plan TYPE text USING plan::text;
ALTER TABLE public.subscription_payments ALTER COLUMN plan TYPE text USING plan::text;

-- Re-apply default for subscriptions.plan now that it's text
ALTER TABLE public.subscriptions ALTER COLUMN plan SET DEFAULT 'free';

-- Update process_subscription_expiries function to remove plan_tier cast
CREATE OR REPLACE FUNCTION public.process_subscription_expiries()
 RETURNS TABLE(warned integer, expired integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_warned INT := 0;
  v_expired INT := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.subscription_expiry_notices (restaurant_id, notice_type, period_end, plan)
    SELECT s.restaurant_id, 'warning_7d', s.current_period_end, s.plan
    FROM public.subscriptions s
    WHERE s.status IN ('active', 'trialing')
      AND s.plan <> 'free'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now()
      AND s.current_period_end <= now() + INTERVAL '7 days'
    ON CONFLICT (restaurant_id, notice_type, period_end) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_warned FROM ins;

  WITH expired_subs AS (
    UPDATE public.subscriptions
    SET plan = 'free',
        status = 'expired'::subscription_status,
        updated_at = now()
    WHERE status IN ('active', 'trialing', 'past_due')
      AND plan <> 'free'
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
    RETURNING restaurant_id, current_period_end, plan
  ),
  exp_ins AS (
    INSERT INTO public.subscription_expiry_notices (restaurant_id, notice_type, period_end, plan)
    SELECT restaurant_id, 'expired', current_period_end, plan FROM expired_subs
    ON CONFLICT (restaurant_id, notice_type, period_end) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_expired FROM exp_ins;

  RETURN QUERY SELECT v_warned, v_expired;
END;
$function$;

-- Drop the enum (no longer referenced)
DROP TYPE IF EXISTS public.plan_tier;

-- Add unique constraint on tier so each package has a unique slug
ALTER TABLE public.subscription_plans ADD CONSTRAINT subscription_plans_tier_unique UNIQUE (tier);