BEGIN;
ALTER TABLE public.order_items DROP CONSTRAINT order_items_status_check;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_status_check CHECK(status IN ('pending','preparing','ready','served','cancelled'));

-- Existing stock triggers handle insert/delete; edits also need to update stock.
CREATE OR REPLACE FUNCTION public.mobile_order_item_stock_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE recipe record;
BEGIN
  IF NEW.quantity IS NOT DISTINCT FROM OLD.quantity AND NEW.menu_item_id IS NOT DISTINCT FROM OLD.menu_item_id THEN RETURN NEW; END IF;
  IF EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND (paid_at IS NOT NULL OR status IN ('paid','completed','cancelled'))) THEN RAISE EXCEPTION 'Cannot change quantities of a closed order'; END IF;
  FOR recipe IN
    SELECT inv.id,inv.cost_per_unit,inv.branch_id,inv.restaurant_id,sum(parts.delta) AS delta
    FROM (SELECT inventory_item_id,quantity_per_unit*OLD.quantity AS delta FROM menu_item_ingredients WHERE menu_item_id=OLD.menu_item_id UNION ALL SELECT inventory_item_id,-quantity_per_unit*NEW.quantity FROM menu_item_ingredients WHERE menu_item_id=NEW.menu_item_id) parts
    JOIN inventory_items inv ON inv.id=parts.inventory_item_id GROUP BY inv.id HAVING sum(parts.delta)<>0
  LOOP
    UPDATE inventory_items SET current_stock=current_stock+recipe.delta WHERE id=recipe.id;
    INSERT INTO inventory_transactions(item_id,type,quantity,unit_cost,total_cost,notes,branch_id,restaurant_id,recorded_by)
    VALUES(recipe.id,CASE WHEN recipe.delta<0 THEN 'usage' ELSE 'adjustment' END,abs(recipe.delta),recipe.cost_per_unit,abs(recipe.delta)*recipe.cost_per_unit,'Automatic stock adjustment from ticket edit',recipe.branch_id,recipe.restaurant_id,auth.uid());
  END LOOP;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_mobile_order_item_stock_change ON public.order_items;
CREATE TRIGGER trg_mobile_order_item_stock_change AFTER UPDATE OF quantity,menu_item_id ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.mobile_order_item_stock_change();

-- Validate and price new lines added to existing tickets.
CREATE OR REPLACE FUNCTION public.mobile_insert_order_line(_restaurant uuid,_order uuid,_branch uuid,_item jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE menu menu_items; tag uuid; option uuid; line_id uuid;
BEGIN
  SELECT * INTO menu FROM menu_items WHERE id=(_item->>'menu_item_id')::uuid AND restaurant_id=_restaurant AND is_available;
  IF menu.id IS NULL OR (menu.branch_id IS NOT NULL AND menu.branch_id IS DISTINCT FROM _branch) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Menu item not available for this branch'; END IF;
  IF COALESCE((_item->>'quantity')::integer,0) NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Item quantity must be 1 to 100'; END IF;
  FOR tag IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(_item->'selected_tags','[]')) LOOP
    IF NOT EXISTS(SELECT 1 FROM menu_item_tags mt JOIN customization_tags t ON t.id=mt.tag_id WHERE mt.menu_item_id=menu.id AND mt.tag_id=tag AND t.restaurant_id=_restaurant AND t.is_active) THEN RAISE EXCEPTION 'Invalid menu customization'; END IF;
  END LOOP;
  FOR option IN SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(_item->'addon_option_ids','[]')) LOOP
    IF NOT EXISTS(SELECT 1 FROM menu_item_addon_options o JOIN menu_item_addons a ON a.id=o.addon_id WHERE o.id=option AND a.menu_item_id=menu.id AND o.restaurant_id=_restaurant) THEN RAISE EXCEPTION 'Invalid menu add-on option'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM menu_item_addons a WHERE a.menu_item_id=menu.id AND a.type='single' AND (SELECT count(*) FROM menu_item_addon_options o WHERE o.addon_id=a.id AND COALESCE(_item->'addon_option_ids','[]') @> to_jsonb(ARRAY[o.id::text]))>1) THEN RAISE EXCEPTION 'Choose one option per single-choice menu add-on'; END IF;
  IF EXISTS(SELECT 1 FROM menu_item_addons a WHERE a.menu_item_id=menu.id AND a.required AND NOT EXISTS(SELECT 1 FROM menu_item_addon_options o WHERE o.addon_id=a.id AND COALESCE(_item->'addon_option_ids','[]') @> to_jsonb(ARRAY[o.id::text]))) THEN RAISE EXCEPTION 'Required menu add-on missing'; END IF;
  INSERT INTO order_items(order_id,restaurant_id,menu_item_id,quantity,notes,selected_tags,selected_addons)
  VALUES(_order,_restaurant,menu.id,(_item->>'quantity')::integer,_item->>'notes',ARRAY(SELECT value::uuid FROM jsonb_array_elements_text(COALESCE(_item->'selected_tags','[]'))),COALESCE((SELECT jsonb_agg(jsonb_build_object('option_id',value)) FROM jsonb_array_elements_text(COALESCE(_item->'addon_option_ids','[]'))),'[]')) RETURNING id INTO line_id;
  RETURN line_id;
END; $$;

CREATE OR REPLACE FUNCTION public.mobile_edit_order(_actor uuid,_restaurant uuid,_order uuid,_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; ticket orders; line order_items; item jsonb; retained uuid[]:='{}'; qty integer; needs_preparation boolean:=false;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext(_restaurant::text));ctx:=mobile_api_context(_actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager','waiter','server') OR NOT(ctx->'features'->>'operations')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Order service access required'; END IF;
  SELECT * INTO ticket FROM orders WHERE id=_order AND restaurant_id=_restaurant FOR UPDATE;
  IF ticket.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order not found'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND NOT(ctx->'branch_ids' @> jsonb_build_array(ticket.branch_id::text)) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  IF ticket.paid_at IS NOT NULL OR ticket.status IN ('paid','completed','cancelled') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Cannot edit a closed order'; END IF;
  IF ticket.updated_at IS DISTINCT FROM (_payload->>'expected_updated_at')::timestamptz THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Order changed; refresh before retrying'; END IF;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','service_role','sub',_actor)::text,true);
  IF _payload ? 'items' THEN
    IF jsonb_typeof(_payload->'items')<>'array' OR jsonb_array_length(_payload->'items') NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'An order needs 1 to 100 items'; END IF;
    FOR item IN SELECT * FROM jsonb_array_elements(_payload->'items') LOOP
      qty:=COALESCE((item->>'quantity')::integer,0);
      IF item->>'id' IS NOT NULL THEN
        IF qty NOT BETWEEN 0 AND 100 THEN RAISE EXCEPTION 'Item quantity must be 0 to 100'; END IF;
        IF (item->>'id')::uuid=ANY(retained) THEN RAISE EXCEPTION 'Duplicate order line'; END IF;
        SELECT * INTO line FROM order_items WHERE id=(item->>'id')::uuid AND order_id=ticket.id AND restaurant_id=_restaurant FOR UPDATE;
        IF line.id IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Order line belongs to another ticket'; END IF;
        IF line.status='cancelled' AND qty>0 THEN RAISE EXCEPTION 'Add a new line instead of restoring a cancelled line'; END IF;
        needs_preparation:=needs_preparation OR qty>line.quantity;
        UPDATE order_items SET quantity=qty,notes=CASE WHEN item ? 'notes' THEN item->>'notes' ELSE notes END,status=CASE WHEN qty=0 THEN 'cancelled' WHEN qty>line.quantity THEN 'pending' ELSE status END WHERE id=line.id;
        retained:=array_append(retained,line.id);
      ELSE
        retained:=array_append(retained,mobile_insert_order_line(_restaurant,ticket.id,ticket.branch_id,item));needs_preparation:=true;
      END IF;
    END LOOP;
    UPDATE order_items SET quantity=0,status='cancelled' WHERE order_id=ticket.id AND NOT(id=ANY(retained)) AND quantity>0;
    IF NOT EXISTS(SELECT 1 FROM order_items WHERE order_id=ticket.id AND quantity>0 AND status<>'cancelled') THEN RAISE EXCEPTION 'At least one active item is required'; END IF;
  END IF;
  UPDATE orders SET notes=CASE WHEN _payload ? 'notes' THEN _payload->>'notes' ELSE notes END,discount_amount=ticket.discount_amount,status=CASE WHEN needs_preparation AND status IN ('ready','served') THEN 'preparing' ELSE status END WHERE id=ticket.id;
  RETURN (SELECT to_jsonb(o)||jsonb_build_object('order_items',(SELECT COALESCE(jsonb_agg(to_jsonb(i) ORDER BY i.id),'[]') FROM order_items i WHERE i.order_id=o.id)) FROM orders o WHERE o.id=ticket.id);
END; $$;

-- Audit records have no restaurant column; match their row snapshots, including deletions.
CREATE OR REPLACE FUNCTION public.mobile_api_audit(_actor uuid,_restaurant uuid,_from timestamptz,_to timestamptz,_limit integer DEFAULT 50,_offset integer DEFAULT 0)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb; result jsonb; total bigint;
BEGIN
  ctx:=mobile_api_context(_actor,_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager') OR NOT(ctx->'features'->>'accounting')::boolean THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Accounting administrator access required'; END IF;
  IF _from IS NULL OR _to IS NULL OR _from>=_to OR _to-_from>interval '366 days' OR _limit NOT BETWEEN 1 AND 100 OR _offset NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid audit range or pagination'; END IF;
  SELECT count(*) INTO total FROM audit_logs a WHERE a.changed_at>=_from AND a.changed_at<_to AND COALESCE(a.new_data->>'restaurant_id',a.old_data->>'restaurant_id')=_restaurant::text AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(COALESCE(a.new_data->>'branch_id',a.old_data->>'branch_id')));
  SELECT COALESCE(jsonb_agg(to_jsonb(rows)),'[]') INTO result FROM (SELECT a.* FROM audit_logs a WHERE a.changed_at>=_from AND a.changed_at<_to AND COALESCE(a.new_data->>'restaurant_id',a.old_data->>'restaurant_id')=_restaurant::text AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(COALESCE(a.new_data->>'branch_id',a.old_data->>'branch_id'))) ORDER BY a.changed_at DESC,a.id LIMIT _limit OFFSET _offset) rows;
  RETURN jsonb_build_object('rows',result,'total',total);
END; $$;

REVOKE ALL ON FUNCTION public.mobile_insert_order_line(uuid,uuid,uuid,jsonb),public.mobile_edit_order(uuid,uuid,uuid,jsonb),public.mobile_api_audit(uuid,uuid,timestamptz,timestamptz,integer,integer) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.mobile_order_item_stock_change() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.mobile_insert_order_line(uuid,uuid,uuid,jsonb),public.mobile_edit_order(uuid,uuid,uuid,jsonb),public.mobile_api_audit(uuid,uuid,timestamptz,timestamptz,integer,integer) TO service_role;
GRANT SELECT ON public.qr_short_links,public.qr_scans,public.cta_clicks TO service_role;
COMMIT;
