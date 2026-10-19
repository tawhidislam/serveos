BEGIN;

ALTER TABLE public.orders
  ADD COLUMN kitchen_started_at timestamptz,
  ADD COLUMN kitchen_due_at timestamptz,
  ADD COLUMN kitchen_ready_at timestamptz,
  ADD COLUMN kitchen_target_minutes integer CHECK (kitchen_target_minutes BETWEEN 1 AND 240);
CREATE INDEX orders_kitchen_history ON public.orders(restaurant_id,kitchen_ready_at DESC) WHERE kitchen_ready_at IS NOT NULL;

-- Start once, independent of updated_at (payment, notes and messages can change it).
-- Existing orders are deliberately not assigned invented preparation timestamps.
CREATE FUNCTION public.track_kitchen_timing() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE target integer;
BEGIN
  IF NEW.status='preparing' AND OLD.status IS DISTINCT FROM NEW.status AND OLD.kitchen_started_at IS NULL THEN
    SELECT LEAST(240,GREATEST(1,COALESCE(max(m.prep_time_minutes) FILTER(WHERE m.prep_time_minutes>0),15))) INTO target
      FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id WHERE i.order_id=NEW.id AND i.quantity>0;
    NEW.kitchen_started_at:=clock_timestamp(); NEW.kitchen_target_minutes:=target;
    NEW.kitchen_due_at:=NEW.kitchen_started_at+make_interval(mins=>target);
  END IF;
  IF NEW.status='ready' AND OLD.status IS DISTINCT FROM NEW.status AND OLD.kitchen_ready_at IS NULL THEN
    NEW.kitchen_ready_at:=clock_timestamp();
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.track_kitchen_timing() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER track_kitchen_timing BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.track_kitchen_timing();

CREATE TABLE public.kitchen_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL CHECK(length(btrim(message)) BETWEEN 1 AND 500),
  extra_minutes integer CHECK(extra_minutes BETWEEN 1 AND 120),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX kitchen_updates_order_time ON public.kitchen_updates(order_id,created_at DESC);
CREATE INDEX kitchen_updates_restaurant_time ON public.kitchen_updates(restaurant_id,created_at DESC);
ALTER TABLE public.kitchen_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kitchen_updates FROM anon,authenticated;
GRANT SELECT ON public.kitchen_updates TO authenticated;
GRANT ALL ON public.kitchen_updates TO service_role;
-- Keep assignment tables private; the policy checks only the caller's access.
CREATE FUNCTION public.can_read_kitchen_updates(_restaurant uuid,_branch uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS(SELECT 1 FROM public.restaurants r WHERE r.id=_restaurant AND r.owner_id=auth.uid())
    OR EXISTS(SELECT 1 FROM public.restaurant_members m WHERE m.restaurant_id=_restaurant AND m.user_id=auth.uid() AND (
      m.role IN ('owner','admin') OR (m.role IN ('manager','kitchen','waiter','server') AND (
        NOT EXISTS(SELECT 1 FROM public.staff_branches b WHERE b.restaurant_id=_restaurant AND b.user_id=auth.uid())
        OR EXISTS(SELECT 1 FROM public.staff_branches b WHERE b.restaurant_id=_restaurant AND b.user_id=auth.uid() AND b.branch_id=_branch)
      ))
    ))
  );
$$;
REVOKE ALL ON FUNCTION public.can_read_kitchen_updates(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_read_kitchen_updates(uuid,uuid) TO authenticated;
CREATE POLICY "Staff read kitchen updates in their restaurant and branches" ON public.kitchen_updates FOR SELECT TO authenticated USING (public.can_read_kitchen_updates(restaurant_id,branch_id));

-- Internal role/tenant/subscription checks shared by the small kitchen RPC surface.
CREATE FUNCTION public.kitchen_context(_restaurant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Staff authentication required'; END IF;
  ctx:=mobile_api_context(auth.uid(),_restaurant);
  IF ctx->>'role' NOT IN ('owner','admin','manager','kitchen') OR NOT (ctx->'features'->>'operations')::boolean THEN
    RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Active kitchen staff access required';
  END IF;
  RETURN ctx;
END; $$;
REVOKE ALL ON FUNCTION public.kitchen_context(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.kitchen_menu(_restaurant uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.name),'[]') INTO result FROM (
    SELECT m.id,m.name,m.is_available,COALESCE(c.name,'Uncategorized') AS category,m.branch_id
    FROM menu_items m LEFT JOIN categories c ON c.id=m.category_id
    WHERE m.restaurant_id=_restaurant AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(m.branch_id::text))
  ) rows;
  RETURN result;
END; $$;

CREATE FUNCTION public.kitchen_set_availability(_restaurant uuid,_item uuid,_available boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); item menu_items;
BEGIN
  IF _available IS NULL THEN RAISE EXCEPTION 'Choose an availability'; END IF;
  SELECT * INTO item FROM menu_items WHERE id=_item AND restaurant_id=_restaurant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Menu item not found'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (item.branch_id IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(item.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  UPDATE menu_items SET is_available=_available WHERE id=item.id;
END; $$;

CREATE FUNCTION public.kitchen_set_eta(_restaurant uuid,_order uuid,_minutes integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); o orders;
BEGIN
  IF _minutes IS NULL OR _minutes NOT BETWEEN 1 AND 240 THEN RAISE EXCEPTION 'Remaining time must be between 1 and 240 minutes'; END IF;
  SELECT * INTO o FROM orders WHERE id=_order AND restaurant_id=_restaurant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order not found'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (o.branch_id IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  IF o.status<>'preparing' THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Only cooking orders have a preparation timer'; END IF;
  UPDATE orders SET kitchen_started_at=COALESCE(kitchen_started_at,clock_timestamp()),kitchen_target_minutes=COALESCE(kitchen_target_minutes,_minutes),kitchen_due_at=clock_timestamp()+make_interval(mins=>_minutes) WHERE id=o.id;
END; $$;

CREATE FUNCTION public.kitchen_send_update(_restaurant uuid,_order uuid,_message text,_extra_minutes integer DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); o orders; message_id uuid;
BEGIN
  IF _message IS NULL OR length(btrim(_message)) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Enter a message of 1 to 500 characters'; END IF;
  IF _extra_minutes IS NOT NULL AND _extra_minutes NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Extra time must be between 1 and 120 minutes'; END IF;
  SELECT * INTO o FROM orders WHERE id=_order AND restaurant_id=_restaurant FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION USING ERRCODE='P0002',MESSAGE='Order not found'; END IF;
  IF jsonb_array_length(ctx->'branch_ids')>0 AND (o.branch_id IS NULL OR NOT(ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))) THEN RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='Branch access denied'; END IF;
  IF o.status NOT IN ('pending','confirmed','preparing','ready') THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='This ticket is closed'; END IF;
  IF _extra_minutes IS NOT NULL THEN
    IF o.status<>'preparing' OR o.kitchen_due_at IS NULL THEN RAISE EXCEPTION USING ERRCODE='PT409',MESSAGE='Start the preparation timer before adding time'; END IF;
    UPDATE orders SET kitchen_due_at=GREATEST(kitchen_due_at,clock_timestamp())+make_interval(mins=>_extra_minutes) WHERE id=o.id;
  END IF;
  INSERT INTO kitchen_updates(restaurant_id,order_id,branch_id,author_id,message,extra_minutes) VALUES(_restaurant,o.id,o.branch_id,auth.uid(),btrim(_message),_extra_minutes) RETURNING id INTO message_id;
  RETURN message_id;
END; $$;

CREATE FUNCTION public.kitchen_history(_restaurant uuid,_days integer DEFAULT 1,_offset integer DEFAULT 0) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); result jsonb; total bigint;
BEGIN
  IF _days IS NULL OR _days NOT IN (1,7,30) OR _offset IS NULL OR _offset NOT BETWEEN 0 AND 10000 THEN RAISE EXCEPTION 'Invalid history range or page'; END IF;
  SELECT count(*) INTO total FROM orders o WHERE o.restaurant_id=_restaurant AND o.status IN ('ready','served','completed','paid') AND COALESCE(o.kitchen_ready_at,o.updated_at)>=now()-make_interval(days=>_days)
    AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text));
  SELECT COALESCE(jsonb_agg(to_jsonb(rows)),'[]') INTO result FROM (
    SELECT o.id,o.ticket_number,o.status,o.created_at,o.notes,o.kitchen_started_at,o.kitchen_due_at,o.kitchen_ready_at,o.kitchen_target_minutes,COALESCE(t.label,'Takeaway') AS table_label,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',m.name,'quantity',i.quantity,'notes',i.notes,'selected_tags',i.selected_tags,'selected_addons',i.selected_addons,'prep_time_minutes',m.prep_time_minutes)) FROM order_items i JOIN menu_items m ON m.id=i.menu_item_id WHERE i.order_id=o.id),'[]') AS items
    FROM orders o LEFT JOIN restaurant_tables t ON t.id=o.table_id
    WHERE o.restaurant_id=_restaurant AND o.status IN ('ready','served','completed','paid') AND COALESCE(o.kitchen_ready_at,o.updated_at)>=now()-make_interval(days=>_days)
      AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))
    ORDER BY COALESCE(o.kitchen_ready_at,o.updated_at) DESC,o.id LIMIT 25 OFFSET _offset
  ) rows;
  RETURN jsonb_build_object('total',total,'orders',result);
END; $$;

CREATE FUNCTION public.kitchen_report(_restaurant uuid,_days integer DEFAULT 7) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE ctx jsonb:=kitchen_context(_restaurant); summary jsonb; daily jsonb;
BEGIN
  IF _days IS NULL OR _days NOT IN (1,7,30) THEN RAISE EXCEPTION 'Choose 1, 7 or 30 days'; END IF;
  WITH timed AS (
    SELECT o.*,EXTRACT(epoch FROM (kitchen_ready_at-kitchen_started_at))/60.0 AS minutes FROM orders o
    WHERE o.restaurant_id=_restaurant AND o.status<>'cancelled' AND o.kitchen_ready_at>=now()-make_interval(days=>_days) AND o.kitchen_started_at IS NOT NULL AND o.kitchen_ready_at>=o.kitchen_started_at AND o.kitchen_target_minutes IS NOT NULL
      AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))
  ) SELECT jsonb_build_object('prepared',count(*),'average_minutes',round(avg(minutes),1),'late',count(*) FILTER(WHERE minutes>kitchen_target_minutes),'on_time_percent',round(100.0*count(*) FILTER(WHERE minutes<=kitchen_target_minutes)/NULLIF(count(*),0),1),'average_delay_minutes',round(avg(GREATEST(0,minutes-kitchen_target_minutes)),1)) INTO summary FROM timed;
  WITH timed AS (
    SELECT (kitchen_ready_at AT TIME ZONE 'UTC')::date AS day,EXTRACT(epoch FROM (kitchen_ready_at-kitchen_started_at))/60.0 AS minutes,kitchen_target_minutes AS target FROM orders o
    WHERE o.restaurant_id=_restaurant AND o.status<>'cancelled' AND o.kitchen_ready_at>=now()-make_interval(days=>_days) AND o.kitchen_started_at IS NOT NULL AND o.kitchen_ready_at>=o.kitchen_started_at AND o.kitchen_target_minutes IS NOT NULL
      AND (jsonb_array_length(ctx->'branch_ids')=0 OR ctx->'branch_ids' @> jsonb_build_array(o.branch_id::text))
  ) SELECT COALESCE(jsonb_agg(to_jsonb(rows) ORDER BY rows.day DESC),'[]') INTO daily FROM (SELECT day,count(*) AS prepared,round(avg(minutes),1) AS average_minutes,count(*) FILTER(WHERE minutes>target) AS late FROM timed GROUP BY day) rows;
  RETURN jsonb_build_object('summary',summary,'daily',daily);
END; $$;

REVOKE ALL ON FUNCTION public.kitchen_menu(uuid),public.kitchen_set_availability(uuid,uuid,boolean),public.kitchen_set_eta(uuid,uuid,integer),public.kitchen_send_update(uuid,uuid,text,integer),public.kitchen_history(uuid,integer,integer),public.kitchen_report(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.kitchen_menu(uuid),public.kitchen_set_availability(uuid,uuid,boolean),public.kitchen_set_eta(uuid,uuid,integer),public.kitchen_send_update(uuid,uuid,text,integer),public.kitchen_history(uuid,integer,integer),public.kitchen_report(uuid,integer) TO authenticated;

DO $$ BEGIN
  IF EXISTS(SELECT 1 FROM pg_publication WHERE pubname='supabase_realtime') THEN ALTER PUBLICATION supabase_realtime ADD TABLE public.kitchen_updates; END IF;
END $$;
NOTIFY pgrst,'reload schema';
COMMIT;
