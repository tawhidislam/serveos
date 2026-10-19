BEGIN;
-- Authenticated web staff use the same transition checks as the mobile API.
CREATE FUNCTION public.staff_set_order_status(_restaurant uuid,_order uuid,_status text,_expected_status text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE actor uuid:=auth.uid(); claims text:=current_setting('request.jwt.claims',true); result jsonb;
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff authentication required'; END IF;
  result:=mobile_order_action(actor,_restaurant,_order,'status',jsonb_build_object('status',_status,'expected_status',_expected_status));
  PERFORM set_config('request.jwt.claims',COALESCE(claims,''),true);
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.staff_set_order_status(uuid,uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.staff_set_order_status(uuid,uuid,text,text) TO authenticated;

CREATE FUNCTION public.pos_settle_order(_restaurant uuid,_order uuid,_payment text,_tax_rate numeric,_discount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; o orders; subtotal numeric; drawer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff authentication required'; END IF;
  ctx:=mobile_api_context(auth.uid(),_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager') OR NOT(ctx->'features'->>'operations')::boolean THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Payment administrator access required';
  END IF;
  IF _payment IS NULL OR _payment NOT IN ('cash','card','mobile') OR _tax_rate IS NULL OR _tax_rate<0 OR _tax_rate>100 OR _tax_rate='NaN'::numeric OR _discount IS NULL OR _discount<0 OR _discount='NaN'::numeric OR _discount<>round(_discount,2) THEN RAISE EXCEPTION 'Invalid payment, tax or discount'; END IF;
  SELECT * INTO o FROM orders WHERE id=_order AND restaurant_id=_restaurant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order not found'; END IF;
  IF o.paid_at IS NOT NULL OR o.status IN ('cancelled','completed','paid') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Order already paid or closed'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (o.branch_id IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  SELECT COALESCE(sum(COALESCE(i.unit_price,m.price)*i.quantity),0) INTO subtotal FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id WHERE i.order_id=o.id;
  IF _discount>subtotal THEN RAISE EXCEPTION 'Discount cannot exceed the subtotal'; END IF;
  UPDATE orders SET tax_rate=_tax_rate,discount_amount=_discount WHERE id=o.id RETURNING * INTO o;
  UPDATE orders SET paid_at=now(),payment_method=_payment,payment_splits=jsonb_build_array(jsonb_build_object('method',_payment,'amount',o.total_amount)),status=CASE WHEN o.status='served' THEN 'completed' ELSE o.status END WHERE id=o.id RETURNING * INTO o;
  IF _payment='cash' THEN
    SELECT id INTO drawer FROM cash_drawer_sessions WHERE restaurant_id=_restaurant AND branch_id IS NOT DISTINCT FROM o.branch_id AND status='open' ORDER BY opened_at DESC LIMIT 1 FOR UPDATE;
    IF drawer IS NOT NULL THEN UPDATE cash_drawer_sessions SET cash_in=cash_in+o.total_amount WHERE id=drawer; END IF;
  END IF;
  RETURN to_jsonb(o);
END; $$;
REVOKE ALL ON FUNCTION public.pos_settle_order(uuid,uuid,text,numeric,numeric) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pos_settle_order(uuid,uuid,text,numeric,numeric) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
