-- Enable pg_cron for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Notices table for expiry warnings (one per subscription per period_end)
CREATE TABLE IF NOT EXISTS public.subscription_expiry_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  notice_type TEXT NOT NULL CHECK (notice_type IN ('warning_7d', 'expired')),
  period_end TIMESTAMPTZ,
  plan TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, notice_type, period_end)
);

ALTER TABLE public.subscription_expiry_notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own expiry notices"
  ON public.subscription_expiry_notices FOR SELECT TO authenticated
  USING (restaurant_id = current_restaurant_id());

CREATE POLICY "Tenant owners acknowledge own expiry notices"
  ON public.subscription_expiry_notices FOR UPDATE TO authenticated
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

CREATE POLICY "Platform admins manage expiry notices"
  ON public.subscription_expiry_notices FOR ALL TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE INDEX IF NOT EXISTS idx_expiry_notices_restaurant ON public.subscription_expiry_notices(restaurant_id, acknowledged);

-- Processing function: warns 7 days before, downgrades on expiry
CREATE OR REPLACE FUNCTION public.process_subscription_expiries()
RETURNS TABLE(warned INT, expired INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_warned INT := 0;
  v_expired INT := 0;
BEGIN
  -- 1. Insert 7-day warnings for active subscriptions expiring within the next 7 days
  WITH ins AS (
    INSERT INTO public.subscription_expiry_notices (restaurant_id, notice_type, period_end, plan)
    SELECT s.restaurant_id, 'warning_7d', s.current_period_end, s.plan::text
    FROM public.subscriptions s
    WHERE s.status IN ('active', 'trialing')
      AND s.plan::text <> 'free'
      AND s.current_period_end IS NOT NULL
      AND s.current_period_end > now()
      AND s.current_period_end <= now() + INTERVAL '7 days'
    ON CONFLICT (restaurant_id, notice_type, period_end) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_warned FROM ins;

  -- 2. Downgrade expired subscriptions to free
  WITH expired_subs AS (
    UPDATE public.subscriptions
    SET plan = 'free'::plan_tier,
        status = 'expired'::subscription_status,
        updated_at = now()
    WHERE status IN ('active', 'trialing', 'past_due')
      AND plan::text <> 'free'
      AND current_period_end IS NOT NULL
      AND current_period_end <= now()
    RETURNING restaurant_id, current_period_end, plan
  ),
  exp_ins AS (
    INSERT INTO public.subscription_expiry_notices (restaurant_id, notice_type, period_end, plan)
    SELECT restaurant_id, 'expired', current_period_end, plan::text FROM expired_subs
    ON CONFLICT (restaurant_id, notice_type, period_end) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_expired FROM exp_ins;

  RETURN QUERY SELECT v_warned, v_expired;
END;
$$;

-- Schedule daily at 02:00 UTC
SELECT cron.unschedule('process-subscription-expiries')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'process-subscription-expiries');

SELECT cron.schedule(
  'process-subscription-expiries',
  '0 2 * * *',
  $$ SELECT public.process_subscription_expiries(); $$
);