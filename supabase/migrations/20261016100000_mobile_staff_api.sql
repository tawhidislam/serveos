BEGIN;
ALTER TABLE public.restaurant_members ADD COLUMN IF NOT EXISTS role text CHECK(role IN ('admin','manager','kitchen','waiter','server'));
CREATE TABLE public.mobile_api_rate_limits(key text PRIMARY KEY,window_started_at timestamptz NOT NULL DEFAULT now(),request_count integer NOT NULL DEFAULT 0);
CREATE TABLE public.mobile_order_requests(actor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,key text NOT NULL,payload_hash text NOT NULL,order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,PRIMARY KEY(actor_id,restaurant_id,key));
ALTER TABLE public.mobile_api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_order_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.mobile_api_rate_limits,public.mobile_order_requests FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.mobile_api_rate_limit(_key text,_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE used integer;
BEGIN
  INSERT INTO mobile_api_rate_limits(key,request_count) VALUES(left(_key,200),1) ON CONFLICT(key) DO UPDATE SET request_count=CASE WHEN mobile_api_rate_limits.window_started_at<now()-interval '1 minute' THEN 1 ELSE mobile_api_rate_limits.request_count+1 END,window_started_at=CASE WHEN mobile_api_rate_limits.window_started_at<now()-interval '1 minute' THEN now() ELSE mobile_api_rate_limits.window_started_at END RETURNING request_count INTO used;
  RETURN used<=_limit;
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_api_context(_actor uuid,_restaurant uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r restaurants; role_name text; sub subscriptions; plan subscription_plans; features jsonb; limits jsonb; branch_ids jsonb; active boolean; extra_menu integer:=0; extra_staff integer:=0; extra_branch integer:=0; feature_name text;
BEGIN
  SELECT * INTO r FROM restaurants WHERE id=_restaurant;
  IF r.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Restaurant not found'; END IF;
  IF r.owner_id=_actor THEN role_name:='owner'; ELSE
    SELECT m.role INTO role_name FROM restaurant_members m WHERE m.restaurant_id=_restaurant AND m.user_id=_actor;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Restaurant access denied'; END IF;
    IF role_name IS NULL THEN SELECT ur.role::text INTO role_name FROM user_roles ur WHERE ur.user_id=_actor AND ur.role::text IN ('admin','manager','kitchen','waiter','server') ORDER BY CASE ur.role::text WHEN 'admin' THEN 1 WHEN 'manager' THEN 2 WHEN 'kitchen' THEN 3 ELSE 4 END LIMIT 1; END IF;
  END IF;
  IF role_name IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Restaurant staff access required'; END IF;
  IF NOT r.is_active THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Restaurant suspended'; END IF;
  SELECT * INTO sub FROM subscriptions WHERE restaurant_id=_restaurant LIMIT 1;
  SELECT * INTO plan FROM subscription_plans WHERE tier=COALESCE(sub.plan,'free') LIMIT 1;
  active:=sub.id IS NOT NULL AND sub.status IN ('active','trialing') AND (sub.current_period_end IS NULL OR sub.current_period_end>now());
  features:=jsonb_build_object('operations',active AND COALESCE(sub.plan,'free')<>'free','accounting',active AND COALESCE(plan.feature_accounting,false),'loyalty',active AND COALESCE(plan.feature_loyalty,false),'promotions',active AND COALESCE(plan.feature_promotions,false),'floorPlans',active AND COALESCE(plan.feature_floor_plans,false),'customDomain',active AND COALESCE(plan.feature_custom_domain,false));
  SELECT COALESCE(sum(a.extra_menu_items*g.quantity),0),COALESCE(sum(a.extra_staff*g.quantity),0),COALESCE(sum(a.extra_branches*g.quantity),0) INTO extra_menu,extra_staff,extra_branch FROM restaurant_addons g JOIN platform_addons a ON a.id=g.addon_id WHERE g.restaurant_id=_restaurant AND g.status='active' AND a.is_active AND (g.expires_at IS NULL OR g.expires_at>now());
  FOR feature_name IN SELECT a.feature_key FROM restaurant_addons g JOIN platform_addons a ON a.id=g.addon_id WHERE g.restaurant_id=_restaurant AND g.status='active' AND a.is_active AND a.feature_key IN ('operations','accounting','loyalty','promotions','floorPlans','customDomain') AND (g.expires_at IS NULL OR g.expires_at>now()) AND active LOOP features:=jsonb_set(features,ARRAY[feature_name],'true'); END LOOP;
  limits:=jsonb_build_object('menu_items',CASE WHEN plan.max_menu_items IS NULL OR EXISTS(SELECT 1 FROM restaurant_addons g JOIN platform_addons a ON a.id=g.addon_id WHERE g.restaurant_id=_restaurant AND g.status='active' AND a.is_active AND a.unlimited_menu_items AND (g.expires_at IS NULL OR g.expires_at>now())) THEN NULL ELSE plan.max_menu_items+extra_menu END,'staff',CASE WHEN plan.max_staff IS NULL OR EXISTS(SELECT 1 FROM restaurant_addons g JOIN platform_addons a ON a.id=g.addon_id WHERE g.restaurant_id=_restaurant AND g.status='active' AND a.is_active AND a.unlimited_staff AND (g.expires_at IS NULL OR g.expires_at>now())) THEN NULL ELSE plan.max_staff+extra_staff END,'branches',CASE WHEN plan.max_branches IS NULL OR EXISTS(SELECT 1 FROM restaurant_addons g JOIN platform_addons a ON a.id=g.addon_id WHERE g.restaurant_id=_restaurant AND g.status='active' AND a.is_active AND a.unlimited_branches AND (g.expires_at IS NULL OR g.expires_at>now())) THEN NULL ELSE plan.max_branches+extra_branch END);
  IF NOT active OR plan.id IS NULL THEN limits:=jsonb_build_object('menu_items',50,'staff',3,'branches',1); END IF;
  SELECT COALESCE(jsonb_agg(branch_id),'[]'::jsonb) INTO branch_ids FROM staff_branches WHERE user_id=_actor AND restaurant_id=_restaurant;
  IF role_name IN ('owner','admin') THEN branch_ids:='[]'; END IF;
  RETURN jsonb_build_object('restaurant',to_jsonb(r),'role',role_name,'branch_ids',branch_ids,'subscription',to_jsonb(sub),'features',features,'limits',limits,'is_active',active);
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_api_mutate(_actor uuid,_restaurant uuid,_table text,_method text,_id uuid,_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; old_row jsonb; merged jsonb; result jsonb; columns text; values_sql text; assignments text; ref record; ref_id uuid; exists_ref boolean; ref_branch uuid; limit_value integer; current_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant::text));
  ctx:=mobile_api_context(_actor,_restaurant);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  IF ctx->>'role' NOT IN ('owner','admin','manager') AND _table<>'reservations' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Administrator access required'; END IF;
  IF _table NOT IN ('branches','categories','menu_items','menu_item_addons','menu_item_addon_options','menu_item_images','customization_tags','menu_item_tags','restaurant_tables','floor_plans','reservations','promotions','loyalty_settings','expense_categories','expenses','budget_alerts','inventory_items','menu_item_ingredients','suppliers','employee_shifts','employee_tips','payroll_records','cash_drawer_sessions','restaurant_settings','homepage_content','restaurant_custom_domains','custom_domain_requests','staff_branches','qr_short_links') THEN RAISE EXCEPTION 'Unsupported resource'; END IF;
  IF _method NOT IN ('POST','PATCH','DELETE') THEN RAISE EXCEPTION 'Unsupported method'; END IF;
  IF _table='staff_branches' AND ctx->>'role' NOT IN ('owner','admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff administrator access required'; END IF;
  IF _table IN ('restaurant_custom_domains','custom_domain_requests') AND ctx->>'role'<>'owner' THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Owner access required'; END IF;
  IF _method<>'POST' THEN EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1 AND restaurant_id=$2 FOR UPDATE',_table) INTO old_row USING _id,_restaurant; IF old_row IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Record not found'; END IF; END IF;
  IF old_row IS NOT NULL AND old_row->>'branch_id' IS NOT NULL AND jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(old_row->>'branch_id')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Existing record branch access denied'; END IF;
  merged:=COALESCE(old_row,'{}'::jsonb)||COALESCE(_data,'{}'::jsonb)||jsonb_build_object('restaurant_id',_restaurant);
  IF jsonb_array_length(ctx->'branch_ids')>0 AND merged->>'branch_id' IS NULL AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=_table AND column_name='branch_id') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned branch is required'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND merged->>'branch_id' IS NOT NULL AND NOT(ctx->'branch_ids' @> jsonb_build_array(merged->>'branch_id')) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  -- Validate every public foreign key against the chosen restaurant.
  FOR ref IN SELECT a.attname AS field,tn.nspname AS schema_name,t.relname AS target,ta.attname AS target_field FROM pg_constraint c JOIN pg_class t ON t.oid=c.confrelid JOIN pg_namespace tn ON tn.oid=t.relnamespace JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1] JOIN pg_attribute ta ON ta.attrelid=c.confrelid AND ta.attnum=c.confkey[1] WHERE c.contype='f' AND c.conrelid=format('public.%I',_table)::regclass LOOP
    IF ref.field='restaurant_id' OR merged->>ref.field IS NULL THEN CONTINUE; END IF;
    ref_id:=(merged->>ref.field)::uuid;
    IF ref.schema_name='public' AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=ref.target AND column_name='restaurant_id') THEN
      EXECUTE format('SELECT EXISTS(SELECT 1 FROM public.%I WHERE %I=$1 AND restaurant_id=$2)',ref.target,ref.target_field) INTO exists_ref USING ref_id,_restaurant;
      IF NOT exists_ref THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Related record belongs to another restaurant'; END IF;
      IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=ref.target AND column_name='branch_id') THEN
        IF old_row->>ref.field IS NOT NULL AND jsonb_array_length(ctx->'branch_ids')>0 THEN
          EXECUTE format('SELECT branch_id FROM public.%I WHERE %I=$1 AND restaurant_id=$2',ref.target,ref.target_field) INTO ref_branch USING (old_row->>ref.field)::uuid,_restaurant;
          IF ref_branch IS NOT NULL AND NOT(ctx->'branch_ids' @> jsonb_build_array(ref_branch::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Existing related record branch access denied'; END IF;
        END IF;
        EXECUTE format('SELECT branch_id FROM public.%I WHERE %I=$1 AND restaurant_id=$2',ref.target,ref.target_field) INTO ref_branch USING ref_id,_restaurant;
        IF ref_branch IS NOT NULL AND jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(ref_branch::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Related record branch access denied'; END IF;
        IF ref_branch IS NOT NULL AND merged->>'branch_id' IS NOT NULL AND ref_branch IS DISTINCT FROM (merged->>'branch_id')::uuid THEN RAISE EXCEPTION 'Related record and branch do not match'; END IF;
      END IF;
    END IF;
  END LOOP;
  IF _table='menu_item_addon_options' AND old_row IS NOT NULL AND jsonb_array_length(ctx->'branch_ids')>0 THEN SELECT m.branch_id INTO ref_branch FROM menu_item_addons a JOIN menu_items m ON m.id=a.menu_item_id WHERE a.id=(old_row->>'addon_id')::uuid AND m.restaurant_id=_restaurant; IF ref_branch IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(ref_branch::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Existing menu add-on branch access denied'; END IF; END IF;
  IF _table='menu_item_addon_options' AND jsonb_array_length(ctx->'branch_ids')>0 THEN SELECT m.branch_id INTO ref_branch FROM menu_item_addons a JOIN menu_items m ON m.id=a.menu_item_id WHERE a.id=(merged->>'addon_id')::uuid AND m.restaurant_id=_restaurant; IF ref_branch IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(ref_branch::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Menu add-on branch access denied'; END IF; END IF;
  IF merged->>'user_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM restaurant_members WHERE restaurant_id=_restaurant AND user_id=(merged->>'user_id')::uuid) AND NOT EXISTS(SELECT 1 FROM restaurants WHERE id=_restaurant AND owner_id=(merged->>'user_id')::uuid) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff member belongs to another restaurant'; END IF;
  IF _method='POST' AND _table IN ('restaurant_settings','loyalty_settings') THEN
    EXECUTE format('SELECT count(*) FROM public.%I WHERE restaurant_id=$1',_table) INTO current_count USING _restaurant;
    IF current_count>0 THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Settings already exist; use PATCH'; END IF;
  END IF;
  IF _method='POST' AND _table='cash_drawer_sessions' AND EXISTS(SELECT 1 FROM cash_drawer_sessions WHERE restaurant_id=_restaurant AND branch_id IS NOT DISTINCT FROM (merged->>'branch_id')::uuid AND status='open') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Cash drawer is already open'; END IF;
  IF _method='POST' AND _table IN ('menu_items','branches') THEN
    limit_value:=(ctx->'limits'->>CASE _table WHEN 'menu_items' THEN 'menu_items' ELSE 'branches' END)::integer;
    EXECUTE format('SELECT count(*) FROM public.%I WHERE restaurant_id=$1',_table) INTO current_count USING _restaurant;
    IF limit_value IS NOT NULL AND current_count>=limit_value THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Package capacity reached'; END IF;
  END IF;
  IF _method='DELETE' THEN EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND restaurant_id=$2 RETURNING to_jsonb(%I.*)',_table,_table) INTO result USING _id,_restaurant; RETURN result; END IF;
  IF _table='qr_short_links' AND (_data ? 'code') AND NOT(_data->>'code' ~ '^[A-Za-z0-9_-]{3,32}$') THEN RAISE EXCEPTION 'QR code must contain 3 to 32 letters, numbers, underscores or hyphens'; END IF;
  IF _table='expenses' THEN _data:=_data||jsonb_build_object('recorded_by',_actor); END IF;
  IF _table='custom_domain_requests' THEN _data:=_data||jsonb_build_object('requested_by',_actor); END IF;
  IF _table='cash_drawer_sessions' THEN
    IF _method='POST' THEN _data:=_data||jsonb_build_object('opened_by',_actor); END IF;
    IF _data->>'status'='closed' THEN _data:=_data||jsonb_build_object('closed_by',_actor,'closed_at',now()); END IF;
  END IF;
  IF _table='payroll_records' THEN _data:=_data||jsonb_build_object('net_pay',GREATEST(0,COALESCE((merged->>'base_pay')::numeric,0)+COALESCE((merged->>'tips_total')::numeric,0)+COALESCE((merged->>'bonuses')::numeric,0)-COALESCE((merged->>'deductions')::numeric,0))); IF _data->>'status'='paid' THEN _data:=_data||jsonb_build_object('paid_at',now()); END IF; END IF;
  _data:=_data||jsonb_build_object('restaurant_id',_restaurant);
  SELECT string_agg(format('%I',key),','),string_agg(format('r.%I',key),','),string_agg(format('%I=r.%I',key,key),',') INTO columns,values_sql,assignments FROM jsonb_object_keys(_data) key;
  IF _method='POST' THEN EXECUTE format('INSERT INTO public.%I(%s) SELECT %s FROM jsonb_populate_record(NULL::public.%I,$1) r RETURNING to_jsonb(%I.*)',_table,columns,values_sql,_table,_table) INTO result USING _data;
  ELSE EXECUTE format('UPDATE public.%I t SET %s FROM jsonb_populate_record(NULL::public.%I,$1) r WHERE t.id=$2 AND t.restaurant_id=$3 RETURNING to_jsonb(t)',_table,assignments,_table) INTO result USING _data,_id,_restaurant; END IF;
  RETURN result;
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_create_order(_actor uuid,_restaurant uuid,_payload jsonb,_key text,_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; existing mobile_order_requests; order_id uuid; item jsonb; menu menu_items; branch uuid; table_branch uuid; tag uuid; option uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant::text));ctx:=mobile_api_context(_actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager','waiter','server') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Order creation access required'; END IF;
  IF NOT(ctx->'features'->>'operations')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active operations package required'; END IF;
  SELECT * INTO existing FROM mobile_order_requests WHERE actor_id=_actor AND restaurant_id=_restaurant AND key=_key;
  IF existing.order_id IS NOT NULL THEN IF existing.payload_hash<>_hash THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Idempotency key was used for a different order'; END IF; RETURN (SELECT to_jsonb(o) FROM orders o WHERE id=existing.order_id); END IF;
  IF jsonb_typeof(_payload->'items')<>'array' OR jsonb_array_length(_payload->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'An order needs 1 to 100 items'; END IF;
  branch:=NULLIF(_payload->>'branch_id','')::uuid;
  IF _payload->>'table_id' IS NOT NULL THEN SELECT branch_id INTO table_branch FROM restaurant_tables WHERE id=(_payload->>'table_id')::uuid AND restaurant_id=_restaurant; IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Table belongs to another restaurant'; END IF; branch:=COALESCE(branch,table_branch); IF branch IS DISTINCT FROM table_branch THEN RAISE EXCEPTION 'Table and branch do not match'; END IF; END IF;
  IF branch IS NOT NULL AND NOT EXISTS(SELECT 1 FROM branches WHERE id=branch AND restaurant_id=_restaurant AND is_active) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch not available'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (branch IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(branch::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  INSERT INTO orders(restaurant_id,branch_id,table_id,user_id,order_type,customer_name,customer_phone,delivery_address,delivery_instructions,notes,tax_rate,delivery_fee) SELECT _restaurant,branch,NULLIF(_payload->>'table_id','')::uuid,_actor,COALESCE(_payload->>'order_type','dine_in'),_payload->>'customer_name',_payload->>'customer_phone',_payload->>'delivery_address',_payload->>'delivery_instructions',_payload->>'notes',COALESCE(tax_percentage,0),CASE WHEN _payload->>'order_type'='delivery' THEN COALESCE(delivery_fee,0) ELSE 0 END FROM restaurant_settings WHERE restaurant_id=_restaurant LIMIT 1 RETURNING id INTO order_id;
  IF order_id IS NULL THEN RAISE EXCEPTION 'Restaurant settings not initialized'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  FOR item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    SELECT * INTO menu FROM menu_items WHERE id=(item->>'menu_item_id')::uuid AND restaurant_id=_restaurant AND is_available;
    IF menu.id IS NULL OR (menu.branch_id IS NOT NULL AND menu.branch_id IS DISTINCT FROM branch) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Menu item not available for this branch'; END IF;
    IF (item->>'quantity')::integer NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Item quantity must be 1 to 100'; END IF;
    FOR tag IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(item->'selected_tags','[]')) LOOP IF NOT EXISTS(SELECT 1 FROM menu_item_tags mt JOIN customization_tags t ON t.id=mt.tag_id WHERE mt.menu_item_id=menu.id AND mt.tag_id=tag AND t.restaurant_id=_restaurant AND t.is_active) THEN RAISE EXCEPTION 'Invalid menu customization'; END IF; END LOOP;
    FOR option IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(item->'addon_option_ids','[]')) LOOP IF NOT EXISTS(SELECT 1 FROM menu_item_addon_options o JOIN menu_item_addons a ON a.id=o.addon_id WHERE o.id=option AND a.menu_item_id=menu.id AND o.restaurant_id=_restaurant) THEN RAISE EXCEPTION 'Invalid menu add-on option'; END IF; END LOOP;
    IF EXISTS(SELECT 1 FROM menu_item_addons a WHERE a.menu_item_id=menu.id AND a.type='single' AND (SELECT count(*) FROM menu_item_addon_options o WHERE o.addon_id=a.id AND COALESCE(item->'addon_option_ids','[]') @> to_jsonb(ARRAY[o.id::text]))>1) THEN RAISE EXCEPTION 'Choose one option per single-choice menu add-on'; END IF;
    IF EXISTS(SELECT 1 FROM menu_item_addons a WHERE a.menu_item_id=menu.id AND a.required AND NOT EXISTS(SELECT 1 FROM menu_item_addon_options o WHERE o.addon_id=a.id AND COALESCE(item->'addon_option_ids','[]') @> to_jsonb(ARRAY[o.id::text]))) THEN RAISE EXCEPTION 'Required menu add-on missing'; END IF;
    INSERT INTO order_items(order_id,restaurant_id,menu_item_id,quantity,notes,selected_tags,selected_addons) VALUES(order_id,_restaurant,menu.id,(item->>'quantity')::integer,item->>'notes',ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(item->'selected_tags','[]'))),COALESCE((SELECT jsonb_agg(jsonb_build_object('option_id',value)) FROM jsonb_array_elements_text(COALESCE(item->'addon_option_ids','[]'))),'[]'));
  END LOOP;
  INSERT INTO mobile_order_requests(actor_id,restaurant_id,key,payload_hash,order_id) VALUES(_actor,_restaurant,_key,_hash,order_id);
  RETURN (SELECT to_jsonb(o) FROM orders o WHERE id=order_id);
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_order_action(_actor uuid,_restaurant uuid,_order uuid,_action text,_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; o orders; next_status text; role_name text;
BEGIN
  ctx:=mobile_api_context(_actor,_restaurant);role_name:=ctx->>'role';
  IF NOT(ctx->'features'->>'operations')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active operations package required'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  SELECT * INTO o FROM orders WHERE id=_order AND restaurant_id=_restaurant FOR UPDATE;
  IF o.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order not found'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  IF _action='status' THEN
    IF o.status IS DISTINCT FROM _payload->>'expected_status' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Order status changed; refresh before retrying'; END IF;
    next_status:=_payload->>'status';
    IF next_status='cancelled' AND o.paid_at IS NOT NULL THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='A paid order requires a refund workflow'; END IF;
    IF NOT((o.status='pending' AND next_status IN ('confirmed','preparing','cancelled')) OR (o.status='confirmed' AND next_status IN ('preparing','cancelled')) OR (o.status='preparing' AND next_status IN ('ready','cancelled')) OR (o.status='ready' AND next_status IN ('served','cancelled')) OR (o.status='served' AND next_status='completed')) THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Invalid order transition'; END IF;
    IF role_name='kitchen' AND next_status NOT IN ('preparing','ready') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Kitchen can prepare or mark ready only'; END IF;
    IF role_name IN ('waiter','server') AND next_status NOT IN ('confirmed','served','completed') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Waiter cannot perform this transition'; END IF;
    UPDATE orders SET status=next_status WHERE id=o.id;
    IF next_status IN ('preparing','ready','served') THEN UPDATE order_items SET status=next_status WHERE order_id=o.id AND quantity>0 AND status NOT IN ('served','cancelled'); END IF;
  ELSIF _action='discount' THEN
    IF role_name NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Discount administrator access required'; END IF;
    IF o.paid_at IS NOT NULL OR o.status IN ('cancelled','completed','paid') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Cannot discount a closed order'; END IF;
    IF (_payload->>'discount_amount')::numeric<0 OR (_payload->>'discount_amount')::numeric>(SELECT COALESCE(sum(COALESCE(i.unit_price,m.price)*i.quantity),0) FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id WHERE i.order_id=o.id) THEN RAISE EXCEPTION 'Discount must not exceed the subtotal'; END IF;
    UPDATE orders SET discount_amount=(_payload->>'discount_amount')::numeric WHERE id=o.id;
  ELSIF _action='payment' THEN
    IF role_name NOT IN ('owner','admin','manager') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Payment administrator access required'; END IF;
    IF o.paid_at IS NOT NULL OR o.status='cancelled' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Order already paid or cancelled'; END IF;
    IF COALESCE(_payload->>'payment_method','') NOT IN ('cash','card','bkash','nagad','rocket','bank_transfer') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
    UPDATE orders SET paid_at=now(),payment_method=_payload->>'payment_method' WHERE id=o.id;
    IF _payload->>'payment_method'='cash' THEN UPDATE cash_drawer_sessions SET cash_in=cash_in+o.total_amount WHERE restaurant_id=_restaurant AND branch_id IS NOT DISTINCT FROM o.branch_id AND status='open'; END IF;
  ELSIF _action='table' THEN
    IF role_name NOT IN ('owner','admin','manager','waiter','server') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Waiter access required'; END IF;
    IF NOT EXISTS(SELECT 1 FROM restaurant_tables WHERE id=(_payload->>'table_id')::uuid AND restaurant_id=_restaurant AND branch_id IS NOT DISTINCT FROM o.branch_id) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Table belongs to another restaurant or branch'; END IF;
    UPDATE orders SET table_id=(_payload->>'table_id')::uuid WHERE id=o.id;
  ELSE RAISE EXCEPTION 'Unsupported order action'; END IF;
  RETURN (SELECT to_jsonb(t) FROM orders t WHERE id=o.id);
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_staff_change(_actor uuid,_restaurant uuid,_user uuid,_role text,_remove boolean DEFAULT false)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; staff_limit integer; staff_count integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant::text));ctx:=mobile_api_context(_actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff administrator access required'; END IF;
  IF _actor=_user OR EXISTS(SELECT 1 FROM restaurants WHERE owner_id=_user AND id=_restaurant) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Cannot change the restaurant owner or your own role'; END IF;
  IF _role NOT IN ('admin','manager','kitchen','waiter','server') OR (_role='admin' AND ctx->>'role'<>'owner') THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Only owner can grant restaurant admin'; END IF;
  IF EXISTS(SELECT 1 FROM restaurant_members WHERE user_id=_user AND restaurant_id<>_restaurant) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff account belongs to another restaurant'; END IF;
  IF _remove THEN
    IF NOT EXISTS(SELECT 1 FROM restaurant_members WHERE user_id=_user AND restaurant_id=_restaurant) THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Staff member not found'; END IF;
    DELETE FROM staff_branches WHERE user_id=_user AND restaurant_id=_restaurant;
    DELETE FROM restaurant_members WHERE user_id=_user AND restaurant_id=_restaurant;
    DELETE FROM user_roles WHERE user_id=_user AND role::text IN ('admin','manager','kitchen','waiter','server');
    RETURN;
  END IF;
  staff_limit:=(ctx->'limits'->>'staff')::integer;SELECT count(*) INTO staff_count FROM restaurant_members WHERE restaurant_id=_restaurant AND user_id<>(SELECT owner_id FROM restaurants WHERE id=_restaurant);
  IF NOT EXISTS(SELECT 1 FROM restaurant_members WHERE user_id=_user AND restaurant_id=_restaurant) AND staff_limit IS NOT NULL AND staff_count>=staff_limit THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Package staff capacity reached'; END IF;
  INSERT INTO restaurant_members(user_id,restaurant_id,role) VALUES(_user,_restaurant,_role) ON CONFLICT(user_id,restaurant_id) DO UPDATE SET role=EXCLUDED.role;
  DELETE FROM user_roles WHERE user_id=_user AND role::text IN ('admin','manager','kitchen','waiter','server');
  INSERT INTO user_roles(user_id,role) VALUES(_user,_role::app_role) ON CONFLICT DO NOTHING;
END; $$;

-- Backend-only access. The Edge API validates the JWT and supplies the actor.
DO $$ DECLARE f record; BEGIN
  FOR f IN SELECT oid::regprocedure AS signature FROM pg_proc WHERE pronamespace='public'::regnamespace AND proname IN ('mobile_api_rate_limit','mobile_api_context','mobile_api_mutate','mobile_create_order','mobile_order_action','mobile_staff_change') LOOP EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,anon,authenticated',f.signature); EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',f.signature); END LOOP;
END $$;
DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['branches','categories','menu_items','menu_item_addons','menu_item_addon_options','menu_item_images','customization_tags','menu_item_tags','restaurant_tables','floor_plans','reservations','promotions','restaurant_customers','loyalty_settings','loyalty_transactions','expense_categories','expenses','budget_alerts','inventory_items','inventory_transactions','inventory_adjustments','menu_item_ingredients','suppliers','employee_shifts','employee_tips','payroll_records','cash_drawer_sessions','restaurant_settings','homepage_content','restaurant_custom_domains','custom_domain_requests','staff_branches','orders','order_items','waiter_calls','restaurant_members','profiles','subscriptions','subscription_payments','subscription_coupons','addon_purchase_requests','restaurant_addons','stock_receipts','stock_receipt_lines','platform_addons','subscription_plans','mobile_payment_settings','bkash_settings','user_roles'] LOOP EXECUTE format('GRANT SELECT ON public.%I TO service_role',t); END LOOP;
END $$;
COMMIT;
