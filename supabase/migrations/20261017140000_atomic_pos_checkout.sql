BEGIN;
ALTER TABLE public.orders ADD COLUMN payment_splits jsonb NOT NULL DEFAULT '[]'::jsonb CHECK(jsonb_typeof(payment_splits)='array');

-- Staff checkout supports an explicit per-order tax rate, including zero.
-- Customer checkout continues to use restaurant settings; paid totals are frozen.
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE subtotal numeric; tax numeric; trusted boolean:=public.can_write_order_pricing(NEW.restaurant_id);
BEGIN
  NEW.delivery_fee:=GREATEST(0,COALESCE(NEW.delivery_fee,0));
  NEW.discount_amount:=GREATEST(0,COALESCE(NEW.discount_amount,0));
  IF TG_OP='INSERT' THEN
    IF NOT trusted THEN NEW.discount_amount:=0;NEW.total_amount:=0; END IF;
    RETURN NEW;
  END IF;
  IF NOT trusted THEN NEW.discount_amount:=OLD.discount_amount;NEW.delivery_fee:=OLD.delivery_fee; END IF;
  IF OLD.paid_at IS NOT NULL THEN
    NEW.tax_rate:=OLD.tax_rate;NEW.discount_amount:=OLD.discount_amount;
    NEW.delivery_fee:=OLD.delivery_fee;NEW.total_amount:=OLD.total_amount;RETURN NEW;
  END IF;
  SELECT COALESCE(sum(COALESCE(oi.unit_price,mi.price+COALESCE((SELECT sum((a->>'price_modifier')::numeric) FROM jsonb_array_elements(oi.selected_addons) a),0))*oi.quantity),0)
  INTO subtotal FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=NEW.id;
  SELECT COALESCE(tax_percentage,0) INTO tax FROM restaurant_settings WHERE restaurant_id=NEW.restaurant_id LIMIT 1;
  NEW.tax_rate:=CASE WHEN trusted THEN COALESCE(NEW.tax_rate,tax,0) ELSE COALESCE(tax,0) END;
  IF NEW.tax_rate<0 OR NEW.tax_rate>100 OR NEW.tax_rate='NaN'::numeric THEN RAISE EXCEPTION 'Tax must be between 0 and 100 percent'; END IF;
  NEW.discount_amount:=LEAST(NEW.discount_amount,subtotal);
  NEW.total_amount:=GREATEST(0,round(subtotal*(1+NEW.tax_rate/100),2)-NEW.discount_amount+NEW.delivery_fee);
  RETURN NEW;
END; $$;

CREATE FUNCTION public.pos_order_receipt(_order uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT jsonb_build_object('order',to_jsonb(o),'items',COALESCE((
    SELECT jsonb_agg(jsonb_build_object('name',m.name,'quantity',i.quantity,'unit_price',COALESCE(i.unit_price,m.price),'notes',i.notes) ORDER BY i.created_at,i.id)
    FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id WHERE i.order_id=o.id
  ),'[]'::jsonb)) FROM orders o WHERE o.id=_order;
$$;
REVOKE ALL ON FUNCTION public.pos_order_receipt(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.pos_checkout(_restaurant uuid,_request_key uuid,_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  actor uuid:=auth.uid(); ctx jsonb; previous mobile_order_requests; fingerprint text;
  item jsonb; menu menu_items; table_row restaurant_tables; branch uuid;
  created_order uuid; tax numeric; discount numeric; subtotal numeric; total numeric;
  payment text; payments jsonb; part jsonb; amount numeric; allocated numeric:=0; cash_amount numeric:=0;
  drawer uuid; method_count integer; existing_hash text;
BEGIN
  IF actor IS NULL OR _request_key IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff authentication required'; END IF;
  ctx:=mobile_api_context(actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager','waiter','server') OR NOT (ctx->'features'->>'operations')::boolean THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active POS staff access required';
  END IF;
  IF jsonb_typeof(_payload) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid checkout payload'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_object_keys(_payload) k WHERE k NOT IN ('items','table_id','tax_rate','discount_amount','payment','payments','notes')) THEN RAISE EXCEPTION 'Unknown checkout field'; END IF;
  fingerprint:=md5(_payload::text);
  PERFORM pg_advisory_xact_lock(hashtextextended(_restaurant::text,0));
  SELECT * INTO previous FROM mobile_order_requests WHERE actor_id=actor AND restaurant_id=_restaurant AND key='pos:'||_request_key::text;
  IF FOUND THEN
    IF previous.payload_hash<>fingerprint THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Checkout request changed; start a new checkout'; END IF;
    RETURN pos_order_receipt(previous.order_id);
  END IF;
  IF jsonb_typeof(_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(_payload->'items') NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Add between 1 and 200 order lines'; END IF;
  tax:=COALESCE((_payload->>'tax_rate')::numeric,0); discount:=COALESCE((_payload->>'discount_amount')::numeric,0);
  payment:=_payload->>'payment';
  IF tax<0 OR tax>100 OR tax='NaN'::numeric OR discount<0 OR discount='NaN'::numeric OR discount<>round(discount,2) THEN RAISE EXCEPTION 'Enter a valid tax and discount'; END IF;
  IF payment IS NULL OR payment NOT IN ('cash','card','mobile','pay_later','split') THEN RAISE EXCEPTION 'Invalid payment method'; END IF;
  IF length(COALESCE(_payload->>'notes',''))>4000 THEN RAISE EXCEPTION 'Order notes are too long'; END IF;
  IF _payload->>'table_id' IS NOT NULL THEN
    SELECT * INTO table_row FROM restaurant_tables WHERE id=(_payload->>'table_id')::uuid AND restaurant_id=_restaurant FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Table belongs to another restaurant'; END IF;
    branch:=table_row.branch_id;
  ELSE
    SELECT branch_id INTO branch FROM menu_items WHERE id=(_payload->'items'->0->>'menu_item_id')::uuid AND restaurant_id=_restaurant;
    IF branch IS NULL AND jsonb_array_length(ctx->'branch_ids')>0 THEN branch:=(ctx->'branch_ids'->>0)::uuid; END IF;
  END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (branch IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(branch::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Assigned branch access required'; END IF;
  INSERT INTO orders(user_id,restaurant_id,branch_id,table_id,tax_rate,discount_amount,notes,status)
  VALUES(actor,_restaurant,branch,table_row.id,tax,0,NULLIF(_payload->>'notes',''),'pending') RETURNING id INTO created_order;
  FOR item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
    IF COALESCE(item->>'quantity','') !~ '^[1-9][0-9]*$' OR (item->>'quantity')::numeric>100 THEN RAISE EXCEPTION 'Quantity must be an integer from 1 to 100'; END IF;
    SELECT * INTO menu FROM menu_items WHERE id=(item->>'menu_item_id')::uuid AND restaurant_id=_restaurant AND is_available FOR SHARE;
    IF NOT FOUND OR (menu.branch_id IS NOT NULL AND menu.branch_id IS DISTINCT FROM branch) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Menu item is unavailable for this restaurant or branch'; END IF;
    IF EXISTS(SELECT 1 FROM menu_item_addons WHERE menu_item_id=menu.id AND required) THEN RAISE EXCEPTION 'This item requires customization; use New Order to choose its options'; END IF;
    IF (item->>'expected_price')::numeric IS DISTINCT FROM menu.price THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Menu prices changed. Refresh the menu and add the affected items again.'; END IF;
    INSERT INTO order_items(order_id,restaurant_id,menu_item_id,quantity,notes,status)
    VALUES(created_order,_restaurant,menu.id,(item->>'quantity')::integer,NULLIF(item->>'notes',''),'pending');
  END LOOP;
  SELECT sum(unit_price*quantity) INTO subtotal FROM order_items WHERE order_id=created_order;
  IF discount>subtotal THEN RAISE EXCEPTION 'Discount cannot exceed the subtotal'; END IF;
  UPDATE orders SET tax_rate=tax,discount_amount=discount WHERE id=created_order RETURNING total_amount INTO total;
  IF payment='pay_later' THEN
    IF COALESCE(jsonb_array_length(_payload->'payments'),0)>0 THEN RAISE EXCEPTION 'Pay-later orders cannot include paid splits'; END IF;
  ELSE
    payments:=COALESCE(_payload->'payments',jsonb_build_array(jsonb_build_object('method',payment,'amount',total)));
    IF jsonb_typeof(payments)<>'array' OR jsonb_array_length(payments) NOT BETWEEN 1 AND 50 THEN RAISE EXCEPTION 'Invalid split payments'; END IF;
    FOR part IN SELECT * FROM jsonb_array_elements(payments) LOOP
      amount:=(part->>'amount')::numeric;
      IF COALESCE(part->>'method','') NOT IN ('cash','card','mobile') OR amount IS NULL OR amount<0 OR amount='NaN'::numeric OR amount<>round(amount,2) OR (amount=0 AND total>0) THEN RAISE EXCEPTION 'Invalid payment allocation'; END IF;
      allocated:=allocated+amount;
      IF part->>'method'='cash' THEN cash_amount:=cash_amount+amount; END IF;
    END LOOP;
    IF allocated<>total THEN RAISE EXCEPTION 'Payments must equal the order total'; END IF;
    SELECT count(DISTINCT p->>'method') INTO method_count FROM jsonb_array_elements(payments) p;
    UPDATE orders SET paid_at=now(),payment_method=CASE WHEN method_count>1 THEN 'split' ELSE payments->0->>'method' END,payment_splits=payments WHERE id=created_order;
    IF cash_amount>0 THEN
      SELECT id INTO drawer FROM cash_drawer_sessions WHERE restaurant_id=_restaurant AND branch_id IS NOT DISTINCT FROM branch AND status='open' ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
      IF drawer IS NOT NULL THEN UPDATE cash_drawer_sessions SET cash_in=cash_in+cash_amount WHERE id=drawer; END IF;
    END IF;
  END IF;
  INSERT INTO mobile_order_requests(actor_id,restaurant_id,key,payload_hash,order_id) VALUES(actor,_restaurant,'pos:'||_request_key::text,fingerprint,created_order);
  RETURN pos_order_receipt(created_order);
END; $$;
REVOKE ALL ON FUNCTION public.pos_checkout(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_checkout(uuid,uuid,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
