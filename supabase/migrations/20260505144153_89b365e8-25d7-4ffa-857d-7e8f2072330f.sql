UPDATE public.subscriptions
SET plan = 'yearly',
    status = 'active',
    current_period_end = (TIMESTAMPTZ '2026-05-05 14:29:11+00') + INTERVAL '12 months',
    updated_at = now()
WHERE restaurant_id = '616e5ece-def2-48aa-97e5-fb5272d9afaa';