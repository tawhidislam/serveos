-- Extend any active subscription whose most recent approved payment was for a
-- multi-month plan (quarterly = 3 months, biannual = 6 months) but was
-- mistakenly activated for only one month.
WITH latest_payment AS (
  SELECT DISTINCT ON (restaurant_id)
    restaurant_id, plan, reviewed_at
  FROM public.subscription_payments
  WHERE status = 'approved'
  ORDER BY restaurant_id, reviewed_at DESC
)
UPDATE public.subscriptions s
SET current_period_end = lp.reviewed_at + (
      CASE lp.plan
        WHEN 'quarterly' THEN INTERVAL '3 months'
        WHEN 'biannual'  THEN INTERVAL '6 months'
      END
    ),
    updated_at = now()
FROM latest_payment lp
WHERE s.restaurant_id = lp.restaurant_id
  AND lp.plan IN ('quarterly', 'biannual')
  AND s.current_period_end < lp.reviewed_at + (
        CASE lp.plan
          WHEN 'quarterly' THEN INTERVAL '3 months'
          WHEN 'biannual'  THEN INTERVAL '6 months'
        END
      );