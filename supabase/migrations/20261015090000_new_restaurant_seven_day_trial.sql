BEGIN;
-- Match the existing Monthly Plan's access, with no charge and a seven-day term.
INSERT INTO public.subscription_plans (tier, name, description, badge, sort_order, currency, is_active, is_public,
  price_monthly, price_yearly, prices, max_menu_items, max_branches, max_staff, max_monthly_orders,
  feature_accounting, feature_loyalty, feature_promotions, feature_floor_plans, feature_ai_images,
  feature_custom_domain, feature_multi_branch, feature_pos, feature_kds, features, features_heading, features_visible)
SELECT 'trial', '7-Day Free Trial', 'Try the Monthly Plan features free for 7 days. No payment required.', 'New restaurants', 0, currency, true, true,
  0, 0, jsonb_build_object(currency, jsonb_build_object('monthly', 0, 'yearly', 0, 'original_monthly', null, 'original_yearly', null)),
  max_menu_items, max_branches, max_staff, max_monthly_orders, feature_accounting, feature_loyalty, feature_promotions,
  feature_floor_plans, feature_ai_images, feature_custom_domain, feature_multi_branch, feature_pos, feature_kds,
  features, features_heading, features_visible
FROM public.subscription_plans WHERE tier='monthly'
ON CONFLICT (tier) DO NOTHING;
CREATE OR REPLACE FUNCTION public.validate_subscription_consistency()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_plan text := lower(coalesce(NEW.plan, 'free'));
BEGIN
  IF v_plan = 'trial' THEN
    NEW.current_period_end := COALESCE(NEW.current_period_end, NEW.created_at + interval '7 days');
    IF NEW.current_period_end > NEW.created_at + interval '7 days' THEN
      RAISE EXCEPTION 'The free trial lasts seven days from restaurant registration';
    END IF;
    IF NEW.status IN ('active', 'trialing') THEN
      NEW.status := CASE WHEN NEW.current_period_end <= now() THEN 'expired'::public.subscription_status ELSE 'trialing'::public.subscription_status END;
    END IF;
    RETURN NEW;
  END IF;
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
CREATE OR REPLACE FUNCTION public.handle_new_restaurant_subscription()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (restaurant_id, plan, status, current_period_end)
  VALUES (NEW.id, 'trial', 'trialing', now() + interval '7 days')
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- New orders stop when a subscription expires; existing restaurant data is kept.
CREATE OR REPLACE FUNCTION public.guard_expired_restaurant_orders()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE subscription public.subscriptions%ROWTYPE;
BEGIN
  IF NEW.restaurant_id IS NULL OR public.is_platform_admin() THEN RETURN NEW; END IF;
  SELECT * INTO subscription FROM public.subscriptions WHERE restaurant_id = NEW.restaurant_id;
  IF subscription.status IN ('expired','canceled') OR (subscription.plan <> 'free' AND subscription.current_period_end <= now()) THEN
    RAISE EXCEPTION 'This restaurant subscription has expired. Choose a paid package to accept new orders.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_expired_restaurant_orders BEFORE INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.guard_expired_restaurant_orders();
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
  IF p_decision = 'approved' AND payment.plan = 'trial' THEN
    RAISE EXCEPTION 'The free trial is assigned automatically at signup and cannot be purchased' USING ERRCODE = '22023';
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
COMMIT;
