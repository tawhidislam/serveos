-- Run with psql -v ON_ERROR_STOP=1. All fixtures are rolled back.
BEGIN;
DO $$
DECLARE
  tenant uuid := gen_random_uuid();
  other_tenant uuid := gen_random_uuid();
  owner_user uuid := gen_random_uuid();
  waiter_user uuid := gen_random_uuid();
BEGIN
  INSERT INTO auth.users(id, email, raw_user_meta_data)
  VALUES (owner_user, 'subscription-owner-' || owner_user || '@example.test', '{}'::jsonb),
         (waiter_user, 'subscription-waiter-' || waiter_user || '@example.test', '{}'::jsonb);
  INSERT INTO public.restaurants(id, name, slug, owner_id)
  VALUES (tenant, 'Subscription access test', 'subscription-access-' || tenant, owner_user),
         (other_tenant, 'Other subscription test', 'subscription-access-' || other_tenant, NULL);
  INSERT INTO public.restaurant_members(user_id, restaurant_id, role)
  VALUES (owner_user, tenant, 'admin'), (waiter_user, tenant, 'waiter')
  ON CONFLICT DO NOTHING;
  UPDATE public.subscriptions SET plan='monthly', status='active', current_period_end=now()+interval '30 days'
  WHERE restaurant_id=tenant;
  PERFORM set_config('test.subscription_tenant', tenant::text, true);
  PERFORM set_config('test.subscription_other', other_tenant::text, true);
  PERFORM set_config('test.subscription_owner', owner_user::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role','authenticated','sub',waiter_user)::text, true);
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE access record; changed integer;
BEGIN
  SELECT * INTO access FROM public.get_restaurant_subscription_access(current_setting('test.subscription_tenant')::uuid);
  IF access.plan IS DISTINCT FROM 'monthly' OR access.status IS DISTINCT FROM 'active' OR access.current_period_end IS NULL THEN
    RAISE EXCEPTION 'Waiter cannot resolve the restaurant paid plan';
  END IF;
  IF to_jsonb(access) ? 'stripe_customer_id' OR to_jsonb(access) ? 'stripe_subscription_id' THEN
    RAISE EXCEPTION 'Billing identifiers leaked to staff';
  END IF;
  IF EXISTS(SELECT 1 FROM public.subscriptions WHERE restaurant_id=current_setting('test.subscription_tenant')::uuid) THEN
    RAISE EXCEPTION 'Waiter gained access to the full billing record';
  END IF;
  BEGIN
    UPDATE public.subscriptions SET plan='yearly' WHERE restaurant_id=current_setting('test.subscription_tenant')::uuid;
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 0 THEN RAISE EXCEPTION 'Waiter changed a subscription'; END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    PERFORM public.get_restaurant_subscription_access(current_setting('test.subscription_other')::uuid);
    RAISE EXCEPTION 'Another restaurant subscription was exposed';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',gen_random_uuid())::text,true);
  BEGIN
    PERFORM public.get_restaurant_subscription_access(current_setting('test.subscription_tenant')::uuid);
    RAISE EXCEPTION 'An unrelated account read subscription access';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',current_setting('test.subscription_owner'))::text,true);
  SELECT * INTO access FROM public.get_restaurant_subscription_access(current_setting('test.subscription_tenant')::uuid);
  IF access.plan IS DISTINCT FROM 'monthly' THEN RAISE EXCEPTION 'Owner entitlement access regressed'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.subscriptions WHERE restaurant_id=current_setting('test.subscription_tenant')::uuid) THEN
    RAISE EXCEPTION 'Owner billing access regressed';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_function_privilege('anon','public.get_restaurant_subscription_access(uuid)','EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous callers must not read subscription access';
  END IF;
END;
$$;
ROLLBACK;
