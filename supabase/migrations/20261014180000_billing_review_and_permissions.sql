BEGIN;
-- Read and submission permissions preserve existing tenant/platform RLS.
GRANT SELECT, INSERT ON public.subscription_payments TO authenticated;
GRANT SELECT ON public.mobile_payment_settings TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.mobile_payment_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subscription_coupons TO authenticated;

-- Approval and activation must succeed together, with one review per payment.
CREATE OR REPLACE FUNCTION public.review_subscription_payment(
  p_payment_id uuid, p_decision text, p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  payment public.subscription_payments%ROWTYPE;
  subscription public.subscriptions%ROWTYPE;
  period_start timestamptz := now();
  period_end timestamptz;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Only platform administrators can review payments' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('approved', 'rejected') OR p_decision IS NULL THEN
    RAISE EXCEPTION 'Choose approve or reject' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO payment FROM public.subscription_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002'; END IF;
  IF payment.status <> 'pending' THEN
    RAISE EXCEPTION 'This payment has already been reviewed' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'rejected' AND NULLIF(btrim(p_notes), '') IS NULL THEN
    RAISE EXCEPTION 'Enter a reason for rejection' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'approved' THEN
    IF NOT EXISTS (SELECT 1 FROM public.subscription_plans WHERE tier = payment.plan AND is_active) THEN
      RAISE EXCEPTION 'This package is unavailable. Review its configuration before approving.' USING ERRCODE = '22023';
    END IF;
    IF payment.amount < 0 OR (payment.amount = 0 AND payment.coupon_id IS NULL) THEN
      RAISE EXCEPTION 'The payment amount must be positive' USING ERRCODE = '22023';
    END IF;
    -- Serialize reviews for the same restaurant, including first activation.
    PERFORM 1 FROM public.restaurants WHERE id = payment.restaurant_id FOR UPDATE;
    SELECT * INTO subscription FROM public.subscriptions WHERE restaurant_id = payment.restaurant_id FOR UPDATE;
    IF subscription.status = 'active' AND subscription.plan <> 'free' AND subscription.current_period_end > now() THEN
      period_start := subscription.current_period_end;
    END IF;
    period_end := period_start + make_interval(months => public.subscription_period_months(payment.plan, payment.billing_cycle));
    INSERT INTO public.subscriptions (restaurant_id, plan, status, current_period_end)
    VALUES (payment.restaurant_id, payment.plan, 'active', period_end)
    ON CONFLICT (restaurant_id) DO UPDATE SET plan = EXCLUDED.plan, status = 'active', current_period_end = EXCLUDED.current_period_end;
  END IF;
  UPDATE public.subscription_payments SET status = p_decision, admin_notes = NULLIF(btrim(p_notes), ''),
    reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_payment_id;
  RETURN jsonb_build_object('success', true, 'status', p_decision, 'current_period_end', period_end);
END;
$$;
REVOKE ALL ON FUNCTION public.review_subscription_payment(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_subscription_payment(uuid, text, text) TO authenticated;
COMMIT;
