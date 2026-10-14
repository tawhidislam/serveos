BEGIN;
DO $$
DECLARE restaurant uuid; actor uuid; package text; price numeric; currency_code text; result jsonb; coupon text:='API_ROLLBACK_PERCENT_TEST'; addon uuid; addon_price numeric; addon_currency text;
BEGIN
  SELECT r.id,r.owner_id INTO restaurant,actor FROM restaurants r WHERE r.owner_id IS NOT NULL LIMIT 1;
  IF restaurant IS NULL THEN RAISE EXCEPTION 'A local restaurant fixture is required'; END IF;
  SELECT tier,price_monthly,currency INTO package,price,currency_code FROM subscription_plans WHERE tier='monthly' AND is_active;
  INSERT INTO mobile_payment_settings(provider,display_name,receiver_number,is_enabled) VALUES('mobile_api_test','Rollback payment method','test',true);
  INSERT INTO subscription_coupons(code,discount_type,discount_value,currency,is_active,applies_to_plans) VALUES(coupon,'percent',10,currency_code,true,ARRAY[package]);
  result:=mobile_api_action(actor,restaurant,'subscription-payment',NULL,jsonb_build_object('plan',package,'payment_method','mobile_api_test','coupon_code',coupon,'sender_number','rollback test sender','transaction_id','rollback-test-transaction'));
  IF (result->>'amount')::numeric<>round(price*.9,2) OR result->>'status'<>'pending' THEN RAISE EXCEPTION 'Server coupon pricing failed'; END IF;
  BEGIN
    PERFORM mobile_api_action(actor,restaurant,'subscription-payment',NULL,jsonb_build_object('plan',package,'payment_method','mobile_api_test','sender_number','rollback test sender','transaction_id','rollback-test-transaction'));
    RAISE EXCEPTION 'Duplicate transaction accepted';
  EXCEPTION WHEN SQLSTATE 'PT409' THEN NULL;
  END;
  SELECT id,price_amount,currency INTO addon,addon_price,addon_currency FROM platform_addons WHERE is_active AND is_public AND price_amount>0 LIMIT 1;
  IF addon IS NULL THEN RAISE EXCEPTION 'A local add-on catalog fixture is required'; END IF;
  INSERT INTO addon_coupons(code,discount_type,discount_value,currency,is_active,applies_to_addons) VALUES(coupon,'percent',10,addon_currency,true,ARRAY[addon]);
  result:=mobile_api_action(actor,restaurant,'addon-request',NULL,jsonb_build_object('addon_id',addon,'payment_method','mobile_api_test','coupon_code',coupon));
  IF (result->>'amount')::numeric<>round(addon_price*.9,2) OR result->>'status'<>'pending' THEN RAISE EXCEPTION 'Server add-on coupon pricing failed'; END IF;
  BEGIN PERFORM mobile_api_action(actor,restaurant,'subscription-payment',NULL,jsonb_build_object('plan','trial','payment_method','mobile_api_test')); RAISE EXCEPTION 'Trial payment accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Trial payment accepted' THEN RAISE; END IF; END;
  BEGIN PERFORM mobile_api_action(actor,restaurant,'subscription-payment',NULL,jsonb_build_object('plan',package,'currency','XYZ','payment_method','mobile_api_test')); RAISE EXCEPTION 'Unconfigured currency accepted'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Unconfigured currency accepted' THEN RAISE; END IF; END;
  IF has_function_privilege('authenticated','public.mobile_api_context(uuid,uuid)','EXECUTE') OR has_function_privilege('authenticated','public.mobile_api_mutate(uuid,uuid,text,text,uuid,jsonb)','EXECUTE') THEN RAISE EXCEPTION 'Service API functions exposed directly'; END IF;
END;
$$;
ROLLBACK;
