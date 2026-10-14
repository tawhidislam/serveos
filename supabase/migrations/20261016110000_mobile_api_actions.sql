BEGIN;
CREATE OR REPLACE FUNCTION public.mobile_api_action(_actor uuid,_restaurant uuid,_action text,_id uuid,_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; role_name text; item inventory_items; line jsonb; previous numeric; quantity numeric; cost numeric; parent orders; row_data jsonb; receipt uuid; total numeric:=0; next_status text; customer restaurant_customers; coupon subscription_coupons; plan subscription_plans; amount numeric; currency_code text; addon platform_addons; addon_coupon addon_coupons; qty integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant::text));ctx:=mobile_api_context(_actor,_restaurant);role_name:=ctx->>'role';
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  IF _action IN ('inventory-receive','inventory-adjust','loyalty-adjust','subscription-payment','addon-request','branding','support-message','support-start') THEN
    IF _action NOT IN ('support-message','support-start') AND role_name NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access required'; END IF;
  END IF;
  IF _action='branding' THEN
    IF _data->>'theme_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM platform_themes WHERE id=(_data->>'theme_id')::uuid AND is_active) THEN RAISE EXCEPTION 'Choose an active theme'; END IF;
    UPDATE restaurants SET theme_id=CASE WHEN _data ? 'theme_id' THEN NULLIF(_data->>'theme_id','')::uuid ELSE theme_id END,name=COALESCE(_data->>'name',name),tagline=CASE WHEN _data ? 'tagline' THEN _data->>'tagline' ELSE tagline END,phone=CASE WHEN _data ? 'phone' THEN _data->>'phone' ELSE phone END,address=CASE WHEN _data ? 'address' THEN _data->>'address' ELSE address END,cuisine_type=CASE WHEN _data ? 'cuisine_type' THEN _data->>'cuisine_type' ELSE cuisine_type END,logo_url=CASE WHEN _data ? 'logo_url' THEN _data->>'logo_url' ELSE logo_url END,primary_color=COALESCE(_data->>'primary_color',primary_color),accent_color=COALESCE(_data->>'accent_color',accent_color),theme_overrides=CASE WHEN _data ? 'theme_overrides' THEN _data->'theme_overrides' ELSE theme_overrides END WHERE id=_restaurant RETURNING to_jsonb(restaurants.*) INTO row_data;RETURN row_data;
  ELSIF _action='table-status' THEN
    IF role_name NOT IN ('owner','admin','manager','waiter','server') OR NOT(ctx->'features'->>'operations')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Waiter access required'; END IF;
    IF _data->>'status' NOT IN ('available','occupied','reserved') THEN RAISE EXCEPTION 'Invalid table status'; END IF;
    UPDATE restaurant_tables SET status=_data->>'status' WHERE id=_id AND restaurant_id=_restaurant AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) RETURNING to_jsonb(restaurant_tables.*) INTO row_data;
  ELSIF _action='waiter-call-resolve' THEN
    IF role_name NOT IN ('owner','admin','manager','waiter','server') OR NOT(ctx->'features'->>'operations')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Waiter access required'; END IF;
    IF jsonb_array_length(ctx->'branch_ids')>0 AND NOT EXISTS(SELECT 1 FROM waiter_calls w JOIN restaurant_tables t ON t.id=w.table_id WHERE w.id=_id AND w.restaurant_id=_restaurant AND ctx->'branch_ids' @> jsonb_build_array(t.branch_id::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
    UPDATE waiter_calls SET status='resolved',resolved_at=now(),resolved_by=_actor WHERE id=_id AND restaurant_id=_restaurant AND status='pending' RETURNING to_jsonb(waiter_calls.*) INTO row_data;
  ELSIF _action='order-item-status' THEN
    SELECT o.* INTO parent FROM orders o JOIN order_items i ON i.order_id=o.id WHERE i.id=_id AND o.restaurant_id=_restaurant FOR UPDATE OF o;
    IF parent.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order item not found'; END IF;
    IF NOT(ctx->'features'->>'operations')::boolean OR (jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(parent.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Order access denied'; END IF;
    next_status:=_data->>'status';
    IF role_name='kitchen' AND next_status NOT IN ('preparing','ready') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kitchen status access denied'; END IF;
    IF role_name IN ('waiter','server') AND next_status<>'served' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Waiter can mark items served only'; END IF;
    IF parent.status IN ('paid','cancelled','completed') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Order is closed'; END IF;
    UPDATE order_items SET status=next_status WHERE id=_id AND restaurant_id=_restaurant AND status=_data->>'expected_status' AND ((status='pending' AND next_status='preparing') OR (status='preparing' AND next_status='ready') OR (status='ready' AND next_status='served')) RETURNING to_jsonb(order_items.*) INTO row_data;
  ELSIF _action IN ('inventory-receive','inventory-adjust') THEN
    IF NOT(ctx->'features'->>'accounting')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accounting feature required'; END IF;
    IF jsonb_typeof(_data->'lines')<>'array' OR jsonb_array_length(_data->'lines') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Provide 1 to 100 inventory lines'; END IF;
    IF _action='inventory-receive' THEN
      IF jsonb_array_length(ctx->'branch_ids')>0 AND (_data->>'branch_id' IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(_data->>'branch_id'))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned branch is required'; END IF;
      IF _data->>'supplier_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM suppliers WHERE id=(_data->>'supplier_id')::uuid AND restaurant_id=_restaurant) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Supplier belongs to another restaurant'; END IF;
      INSERT INTO stock_receipts(restaurant_id,branch_id,supplier_id,supplier_name,reference,received_date,notes,recorded_by) VALUES(_restaurant,NULLIF(_data->>'branch_id','')::uuid,NULLIF(_data->>'supplier_id','')::uuid,_data->>'supplier_name',_data->>'reference',COALESCE((_data->>'received_date')::date,current_date),_data->>'notes',_actor) RETURNING id INTO receipt;
    END IF;
    FOR line IN SELECT * FROM jsonb_array_elements(_data->'lines') LOOP
      SELECT * INTO item FROM inventory_items WHERE id=(line->>'item_id')::uuid AND restaurant_id=_restaurant FOR UPDATE;
      IF item.id IS NULL OR (jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(item.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Inventory item access denied'; END IF;
      IF _data->>'branch_id' IS NOT NULL AND item.branch_id IS DISTINCT FROM (_data->>'branch_id')::uuid THEN RAISE EXCEPTION 'Inventory branch mismatch'; END IF;
      previous:=item.current_stock;cost:=COALESCE((line->>'unit_cost')::numeric,item.cost_per_unit,0);
      IF cost<0 THEN RAISE EXCEPTION 'Unit cost cannot be negative'; END IF;
      IF _action='inventory-receive' THEN
        quantity:=(line->>'quantity')::numeric;IF quantity IS NULL OR quantity<=0 THEN RAISE EXCEPTION 'Quantity must be positive'; END IF;
        UPDATE inventory_items SET current_stock=current_stock+quantity,cost_per_unit=cost WHERE id=item.id;
        INSERT INTO stock_receipt_lines(receipt_id,restaurant_id,item_id,quantity,unit_cost,total_cost,expiry_date,batch_code) VALUES(receipt,_restaurant,item.id,quantity,cost,quantity*cost,NULLIF(line->>'expiry_date','')::date,line->>'batch_code');
        INSERT INTO inventory_transactions(restaurant_id,item_id,type,quantity,unit_cost,total_cost,notes,recorded_by,branch_id) VALUES(_restaurant,item.id,'purchase',quantity,cost,quantity*cost,_data->>'notes',_actor,item.branch_id);total:=total+quantity*cost;
      ELSE
        quantity:=(line->>'quantity_after')::numeric;IF quantity IS NULL OR quantity<0 THEN RAISE EXCEPTION 'Stock cannot be negative'; END IF;
        UPDATE inventory_items SET current_stock=quantity WHERE id=item.id;
        INSERT INTO inventory_adjustments(restaurant_id,branch_id,item_id,reason,quantity_before,quantity_after,delta,unit_cost,cost_impact,notes,reference,adjusted_by) VALUES(_restaurant,item.branch_id,item.id,COALESCE(_data->>'reason','correction'),previous,quantity,quantity-previous,cost,(quantity-previous)*cost,_data->>'notes',_data->>'reference',_actor);
      END IF;
    END LOOP;
    IF receipt IS NOT NULL THEN UPDATE stock_receipts SET total_cost=total WHERE id=receipt RETURNING to_jsonb(stock_receipts.*) INTO row_data; ELSE row_data:=jsonb_build_object('adjusted',jsonb_array_length(_data->'lines')); END IF;
  ELSIF _action='loyalty-adjust' THEN
    IF NOT(ctx->'features'->>'loyalty')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Loyalty feature required'; END IF;
    SELECT * INTO customer FROM restaurant_customers WHERE id=_id AND restaurant_id=_restaurant FOR UPDATE;
    IF customer.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Customer not found'; END IF;
    qty:=(_data->>'points')::integer;IF qty=0 OR qty IS NULL THEN RAISE EXCEPTION 'Points must be a nonzero integer'; END IF;
    IF (SELECT COALESCE(sum(points),0) FROM loyalty_transactions WHERE customer_id=customer.id)+qty<0 THEN RAISE EXCEPTION 'Insufficient loyalty points'; END IF;
    INSERT INTO loyalty_transactions(restaurant_id,customer_id,user_id,points,type,description) VALUES(_restaurant,customer.id,customer.auth_user_id,qty,CASE WHEN qty>0 THEN 'earn' ELSE 'redeem' END,_data->>'description') RETURNING to_jsonb(loyalty_transactions.*) INTO row_data;
  ELSIF _action='subscription-payment' THEN
    SELECT * INTO plan FROM subscription_plans WHERE tier=_data->>'plan' AND is_active AND is_public AND tier<>'trial';
    IF plan.id IS NULL THEN RAISE EXCEPTION 'Choose an active paid package'; END IF;
    currency_code:=COALESCE(_data->>'currency',plan.currency);
    IF currency_code=plan.currency THEN amount:=CASE WHEN plan.tier IN ('yearly','annual') THEN plan.price_yearly ELSE plan.price_monthly END;
    ELSE IF NOT(plan.prices ? currency_code) THEN RAISE EXCEPTION 'Package currency is not configured'; END IF;amount:=(plan.prices->currency_code->>CASE WHEN plan.tier IN ('yearly','annual') THEN 'yearly' ELSE 'monthly' END)::numeric; END IF;
    IF amount<=0 THEN RAISE EXCEPTION 'Package price not configured'; END IF;
    IF _data->>'coupon_code' IS NOT NULL THEN
      SELECT * INTO coupon FROM subscription_coupons WHERE upper(code)=upper(_data->>'coupon_code') AND is_active AND (valid_from IS NULL OR valid_from<=now()) AND (valid_until IS NULL OR valid_until>now()) AND (max_redemptions IS NULL OR redemption_count<max_redemptions) AND (applies_to_plans IS NULL OR cardinality(applies_to_plans)=0 OR plan.tier=ANY(applies_to_plans)) AND (applies_to_cycles IS NULL OR cardinality(applies_to_cycles)=0 OR (CASE WHEN plan.tier IN ('yearly','annual') THEN 'yearly' ELSE 'monthly' END)=ANY(applies_to_cycles)) AND amount>=COALESCE(min_amount,0) FOR UPDATE;
      IF coupon.id IS NULL THEN RAISE EXCEPTION 'Coupon not applicable'; END IF;
      IF coupon.discount_type='percent' THEN cost:=round(amount*coupon.discount_value/100,2); ELSE IF coupon.currency IS DISTINCT FROM currency_code THEN RAISE EXCEPTION 'Coupon currency mismatch'; END IF;cost:=coupon.discount_value; END IF;
      cost:=LEAST(amount,GREATEST(0,cost));
    ELSE cost:=0; END IF;
    IF NOT EXISTS(SELECT 1 FROM mobile_payment_settings WHERE provider=_data->>'payment_method' AND is_enabled) AND NOT(_data->>'payment_method'='bkash' AND EXISTS(SELECT 1 FROM bkash_settings WHERE is_enabled)) THEN RAISE EXCEPTION 'Payment method not available'; END IF;
    IF length(btrim(COALESCE(_data->>'sender_number','')))=0 OR length(btrim(COALESCE(_data->>'transaction_id','')))=0 THEN RAISE EXCEPTION 'Sender number and transaction ID are required'; END IF;
    IF EXISTS(SELECT 1 FROM subscription_payments WHERE restaurant_id=_restaurant AND payment_method=_data->>'payment_method' AND transaction_id=_data->>'transaction_id' AND status IN ('pending','approved')) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This transaction already has a payment request'; END IF;
    INSERT INTO subscription_payments(restaurant_id,submitted_by,plan,billing_cycle,amount,currency,payment_method,sender_number,transaction_id,reference_code,notes,coupon_id,coupon_code,original_amount,discount_amount) VALUES(_restaurant,_actor,plan.tier,CASE WHEN plan.tier IN ('yearly','annual') THEN 'yearly' ELSE 'monthly' END,amount-cost,currency_code,_data->>'payment_method',_data->>'sender_number',_data->>'transaction_id',_data->>'reference_code',_data->>'notes',coupon.id,coupon.code,amount,cost) RETURNING to_jsonb(subscription_payments.*) INTO row_data;
  ELSIF _action='addon-request' THEN
    SELECT * INTO addon FROM platform_addons WHERE id=(_data->>'addon_id')::uuid AND is_public AND is_active;
    IF addon.id IS NULL THEN RAISE EXCEPTION 'Add-on not available'; END IF;
    qty:=COALESCE((_data->>'quantity')::integer,1);IF qty<1 OR qty>100 OR (NOT addon.allow_multiple AND qty<>1) OR (addon.max_quantity IS NOT NULL AND qty>addon.max_quantity) THEN RAISE EXCEPTION 'Invalid add-on quantity'; END IF;
    amount:=addon.price_amount*qty;cost:=0;
    IF _data->>'coupon_code' IS NOT NULL THEN
      SELECT * INTO addon_coupon FROM addon_coupons WHERE upper(code)=upper(_data->>'coupon_code') AND is_active AND (valid_from IS NULL OR valid_from<=now()) AND (valid_until IS NULL OR valid_until>now()) AND (max_redemptions IS NULL OR redemption_count<max_redemptions) AND (applies_to_addons IS NULL OR cardinality(applies_to_addons)=0 OR addon.id=ANY(applies_to_addons)) AND (applies_to_billing_types IS NULL OR cardinality(applies_to_billing_types)=0 OR addon.billing_type=ANY(applies_to_billing_types)) AND amount>=min_amount FOR UPDATE;
      IF addon_coupon.id IS NULL THEN RAISE EXCEPTION 'Add-on coupon not applicable'; END IF;
      IF addon_coupon.discount_type='percent' THEN cost:=round(amount*addon_coupon.discount_value/100,2); ELSE IF addon_coupon.currency<>addon.currency THEN RAISE EXCEPTION 'Coupon currency mismatch'; END IF;cost:=addon_coupon.discount_value; END IF;cost:=LEAST(amount,GREATEST(0,cost));
    END IF;
    IF amount-cost>0 AND NOT EXISTS(SELECT 1 FROM mobile_payment_settings WHERE provider=_data->>'payment_method' AND is_enabled) AND NOT(_data->>'payment_method'='bkash' AND EXISTS(SELECT 1 FROM bkash_settings WHERE is_enabled)) THEN RAISE EXCEPTION 'Payment method not available'; END IF;
    INSERT INTO addon_purchase_requests(restaurant_id,requested_by,addon_id,quantity,amount,original_amount,discount_amount,currency,billing_type,payment_method,payment_reference,sender_number,transaction_id,reference_code,notes,addon_coupon_id,coupon_code) VALUES(_restaurant,_actor,addon.id,qty,amount-cost,amount,cost,addon.currency,addon.billing_type,_data->>'payment_method',_data->>'payment_reference',_data->>'sender_number',_data->>'transaction_id',_data->>'reference_code',_data->>'notes',addon_coupon.id,addon_coupon.code) RETURNING to_jsonb(addon_purchase_requests.*) INTO row_data;
  ELSIF _action IN ('support-start','support-message') THEN
    IF length(btrim(COALESCE(_data->>'body','')))=0 OR length(_data->>'body')>4000 THEN RAISE EXCEPTION 'Support message must be 1 to 4000 characters'; END IF;
    IF _action='support-start' THEN
      IF (SELECT count(*) FROM support_conversations WHERE requester_user_id=_actor AND status NOT IN ('resolved','closed'))>=5 THEN RAISE EXCEPTION 'Please continue an existing support conversation'; END IF;
      INSERT INTO support_conversations(requester_kind,requester_user_id,restaurant_id,category,subject,status,ai_enabled,channel) SELECT 'restaurant',_actor,_restaurant,COALESCE(_data->>'category','other'),left(_data->>'body',80),CASE WHEN auto_reply_enabled THEN 'bot' ELSE 'open' END,auto_reply_enabled,'chat' FROM support_settings WHERE id=true RETURNING id INTO _id;
    ELSIF NOT EXISTS(SELECT 1 FROM support_conversations WHERE id=_id AND restaurant_id=_restaurant AND (requester_user_id=_actor OR role_name IN ('owner','admin')) AND status NOT IN ('resolved','closed')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Support conversation access denied'; END IF;
    PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',_actor)::text,true);
    INSERT INTO support_messages(conversation_id,sender_kind,sender_user_id,body,is_internal) VALUES(_id,'requester',_actor,_data->>'body',false) RETURNING to_jsonb(support_messages.*) INTO row_data;
  ELSE RAISE EXCEPTION 'Unsupported action'; END IF;
  IF row_data IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Record changed or not found; refresh before retrying'; END IF;
  RETURN row_data;
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_api_report(_actor uuid,_restaurant uuid,_from timestamptz,_to timestamptz)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; result jsonb;
BEGIN
  ctx:=mobile_api_context(_actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Report administrator access required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _to<=_from OR _to-_from>interval '366 days' THEN RAISE EXCEPTION 'Report range must be 1 to 366 days'; END IF;
  SELECT jsonb_build_object('currency',(SELECT currency FROM restaurant_settings WHERE restaurant_id=_restaurant LIMIT 1),'orders',count(*),'paid_orders',(SELECT count(*) FROM orders WHERE restaurant_id=_restaurant AND paid_at>=_from AND paid_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text))),'collected',(SELECT COALESCE(sum(total_amount),0) FROM orders WHERE restaurant_id=_restaurant AND paid_at>=_from AND paid_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text))),'open_orders',count(*) FILTER(WHERE status IN ('pending','confirmed','preparing','ready')),'sales_by_day',(SELECT COALESCE(jsonb_agg(s),'[]') FROM (SELECT date_trunc('day',paid_at) AS day,sum(total_amount) AS collected,count(*) AS orders FROM orders WHERE restaurant_id=_restaurant AND paid_at>=_from AND paid_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) GROUP BY 1 ORDER BY 1) s)) INTO result FROM orders WHERE restaurant_id=_restaurant AND created_at>=_from AND created_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text));
  IF (ctx->'features'->>'accounting')::boolean THEN result:=result||jsonb_build_object('expenses',(SELECT COALESCE(sum(amount),0) FROM expenses WHERE restaurant_id=_restaurant AND expense_date>=_from::date AND expense_date<((_to-interval '1 microsecond')::date+1) AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)))); END IF;
  IF (ctx->'features'->>'accounting')::boolean THEN
    SELECT result||jsonb_build_object(
      'discounts',COALESCE(sum(discount_amount),0),'delivery_fees',COALESCE(sum(delivery_fee),0),
      'tax_collected',COALESCE(sum(round((total_amount+discount_amount-delivery_fee)*tax_rate/(100+tax_rate),2)),0),
      'payments_by_method',(SELECT COALESCE(jsonb_agg(p),'[]') FROM (SELECT payment_method,count(*) AS orders,sum(total_amount) AS collected FROM orders WHERE restaurant_id=_restaurant AND paid_at>=_from AND paid_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) GROUP BY payment_method ORDER BY payment_method) p)
    ) INTO result FROM orders WHERE restaurant_id=_restaurant AND paid_at>=_from AND paid_at<_to AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text));
    result:=result||jsonb_build_object(
      'expenses_by_category',(SELECT COALESCE(jsonb_agg(e),'[]') FROM (SELECT category_id,sum(amount) AS amount FROM expenses WHERE restaurant_id=_restaurant AND expense_date>=_from::date AND expense_date<((_to-interval '1 microsecond')::date+1) AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) GROUP BY category_id ORDER BY category_id) e),
      'payroll_by_status',(SELECT COALESCE(jsonb_agg(p),'[]') FROM (SELECT status,sum(net_pay) AS net_pay FROM payroll_records WHERE restaurant_id=_restaurant AND period_start>=_from::date AND period_start<((_to-interval '1 microsecond')::date+1) AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) GROUP BY status ORDER BY status) p),
      'inventory_cost_by_type',(SELECT COALESCE(jsonb_agg(t),'[]') FROM (SELECT type,sum(total_cost) AS total_cost FROM inventory_transactions WHERE restaurant_id=_restaurant AND transaction_date>=_from::date AND transaction_date<((_to-interval '1 microsecond')::date+1) AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(branch_id::text)) GROUP BY type ORDER BY type) t)
    );
  END IF;
  RETURN result||jsonb_build_object('from',_from,'to',_to,'timezone','UTC');
END; $$;
REVOKE ALL ON FUNCTION public.mobile_api_action(uuid,uuid,text,uuid,jsonb),public.mobile_api_report(uuid,uuid,timestamptz,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_api_action(uuid,uuid,text,uuid,jsonb),public.mobile_api_report(uuid,uuid,timestamptz,timestamptz) TO service_role;
COMMIT;
