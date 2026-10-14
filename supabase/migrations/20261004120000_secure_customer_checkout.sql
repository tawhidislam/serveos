-- Secure customer checkout.
--
-- Fixes:
--   1. Customers could insert orders with any total_amount / discount_amount
--      (the totals trigger only recalculated on UPDATE, and kept whatever
--      discount the client sent — up to the full order value).
--   2. Selected add-ons were never stored on order_items, so the kitchen never
--      saw them and the server-side total ignored their price.
--   3. Promotion uses and loyalty transactions were inserted from the browser
--      without restaurant_id, so RLS rejected them silently. Customers could
--      also insert arbitrary "earn" loyalty transactions for themselves.
--   4. Customers could UPDATE their own orders (status, discount, …).
--
-- Customer checkout now goes through place_customer_order(), which prices the
-- order, validates promotions and loyalty redemption server-side, and records
-- them. Staff (restaurant members) keep direct write access.

-- ── 1. Add-ons on order items ──────────────────────────────────────────────
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS selected_addons jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Rebuild selected_addons from the option ids the client sent, using the
-- authoritative names and prices. Options that don't belong to the item are
-- dropped, so a client can't attach foreign or made-up prices.
CREATE OR REPLACE FUNCTION public.resolve_order_item_addons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF NEW.selected_addons IS NULL OR jsonb_typeof(NEW.selected_addons) <> 'array' THEN
    NEW.selected_addons := '[]'::jsonb;
    RETURN NEW;
  END IF;

  SELECT array_agg((x->>'option_id')::uuid)
  INTO v_ids
  FROM jsonb_array_elements(NEW.selected_addons) x
  WHERE jsonb_typeof(x) = 'object' AND x ? 'option_id';

  IF v_ids IS NULL THEN
    NEW.selected_addons := '[]'::jsonb;
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'option_id', o.id,
           'addon_name', a.name,
           'name', o.name,
           'price_modifier', o.price_modifier
         ) ORDER BY a.sort_order, o.sort_order), '[]'::jsonb)
  INTO NEW.selected_addons
  FROM public.menu_item_addon_options o
  JOIN public.menu_item_addons a ON a.id = o.addon_id
  WHERE a.menu_item_id = NEW.menu_item_id
    AND o.id = ANY (v_ids);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resolve_order_item_addons ON public.order_items;
CREATE TRIGGER trg_resolve_order_item_addons
BEFORE INSERT OR UPDATE OF selected_addons, menu_item_id ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.resolve_order_item_addons();

-- ── 2. Who may set an order's discount ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_write_order_pricing(_restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    -- set by place_customer_order() after it has validated the discount
    COALESCE(current_setting('app.trusted_order_pricing', true), '') = 'on'
    -- service role, or direct SQL (no request JWT)
    OR COALESCE(current_setting('request.jwt.claims', true), '') = ''
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    OR EXISTS (
      SELECT 1 FROM public.restaurant_members m
      WHERE m.user_id = auth.uid() AND m.restaurant_id = _restaurant_id
    )
    OR public.is_platform_admin()
$$;

-- ── 3. Authoritative order totals (now including add-ons) ──────────────────
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  calc_total NUMERIC;
  tax NUMERIC;
  trusted boolean := public.can_write_order_pricing(NEW.restaurant_id);
BEGIN
  IF NEW.delivery_fee IS NULL OR NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;
  IF NEW.discount_amount IS NULL OR NEW.discount_amount < 0 THEN
    NEW.discount_amount := 0;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT trusted THEN
      -- Items are inserted afterwards; their trigger recalculates the total.
      NEW.discount_amount := 0;
      NEW.total_amount := 0;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT trusted THEN
    NEW.discount_amount := OLD.discount_amount;
    NEW.delivery_fee := OLD.delivery_fee;
  END IF;

  SELECT COALESCE(SUM(
           (mi.price + COALESCE((
              SELECT SUM((a->>'price_modifier')::numeric)
              FROM jsonb_array_elements(oi.selected_addons) a
            ), 0)) * oi.quantity
         ), 0)
  INTO calc_total
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = NEW.id;

  SELECT COALESCE(rs.tax_percentage, 0) INTO tax
  FROM restaurant_settings rs
  WHERE rs.restaurant_id = NEW.restaurant_id
  LIMIT 1;
  tax := COALESCE(tax, 0);

  NEW.tax_rate := tax;

  IF NEW.discount_amount > calc_total THEN
    NEW.discount_amount := calc_total;
  END IF;

  NEW.total_amount := ROUND(calc_total * (1 + tax / 100), 2)
                      - COALESCE(NEW.discount_amount, 0)
                      + COALESCE(NEW.delivery_fee, 0);

  IF NEW.total_amount < 0 THEN
    NEW.total_amount := 0;
  END IF;

  RETURN NEW;
END;
$$;

-- Recalculate the parent order whenever its items change, so the total is
-- right immediately rather than on the next status update. Statement-level so
-- a multi-item insert touches each order once.
CREATE OR REPLACE FUNCTION public.touch_orders_from_new_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders SET updated_at = now()
  WHERE id IN (SELECT DISTINCT order_id FROM new_rows);
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_orders_from_old_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.orders SET updated_at = now()
  WHERE id IN (SELECT DISTINCT order_id FROM old_rows);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_order_items_recalc_insert ON public.order_items;
CREATE TRIGGER trg_order_items_recalc_insert
AFTER INSERT ON public.order_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.touch_orders_from_new_items();

DROP TRIGGER IF EXISTS trg_order_items_recalc_update ON public.order_items;
CREATE TRIGGER trg_order_items_recalc_update
AFTER UPDATE ON public.order_items
REFERENCING NEW TABLE AS new_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.touch_orders_from_new_items();

DROP TRIGGER IF EXISTS trg_order_items_recalc_delete ON public.order_items;
CREATE TRIGGER trg_order_items_recalc_delete
AFTER DELETE ON public.order_items
REFERENCING OLD TABLE AS old_rows
FOR EACH STATEMENT EXECUTE FUNCTION public.touch_orders_from_old_items();

-- ── 4. Tighten customer write access ───────────────────────────────────────
-- Customers no longer insert orders directly; they use place_customer_order()
-- or place_guest_order().
DROP POLICY IF EXISTS "Customers create orders for active restaurants" ON public.orders;
DROP POLICY IF EXISTS "Guests create orders for active restaurants" ON public.orders;

-- Customers could update their own orders. Only staff may now.
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
CREATE POLICY "Staff can update orders" ON public.orders
FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'server'::app_role))
  AND restaurant_id = current_restaurant_id()
);

-- Customers could mint their own loyalty points. Earn/redeem is server-side now.
DROP POLICY IF EXISTS "Customers create own loyalty transactions" ON public.loyalty_transactions;

-- Anyone could bump any promotion's usage counter.
REVOKE EXECUTE ON FUNCTION public.increment_promotion_usage(uuid) FROM PUBLIC, anon, authenticated;

-- ── 5. Restaurant-scoped loyalty balance ───────────────────────────────────
DROP FUNCTION IF EXISTS public.get_loyalty_balance(uuid);
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(_user_id uuid, _restaurant_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(SUM(points), 0)::integer
  FROM public.loyalty_transactions
  WHERE user_id = _user_id
    AND _user_id = auth.uid()
    AND (_restaurant_id IS NULL OR restaurant_id = _restaurant_id)
    AND (expires_at IS NULL OR expires_at > now())
$$;
GRANT EXECUTE ON FUNCTION public.get_loyalty_balance(uuid, uuid) TO anon, authenticated;

-- ── 6. Customer checkout ───────────────────────────────────────────────────
-- _items: [{ menu_item_id, quantity, notes?, selected_tags?: text[], addon_option_ids?: uuid[] }]
-- _client_timezone: IANA zone of the customer's device, used for happy-hour
-- windows (restaurants don't store a timezone yet).
CREATE OR REPLACE FUNCTION public.place_customer_order(
  _restaurant_id uuid,
  _items jsonb,
  _table_id uuid DEFAULT NULL,
  _order_type text DEFAULT 'dine_in',
  _customer_name text DEFAULT NULL,
  _customer_phone text DEFAULT NULL,
  _delivery_address text DEFAULT NULL,
  _delivery_instructions text DEFAULT NULL,
  _promotion_id uuid DEFAULT NULL,
  _loyalty_points integer DEFAULT 0,
  _client_timezone text DEFAULT 'UTC'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid;
  v_customer_id uuid;
  v_settings public.restaurant_settings%ROWTYPE;
  v_loyalty public.loyalty_settings%ROWTYPE;
  v_promo public.promotions%ROWTYPE;
  v_item jsonb;
  v_inserted int := 0;
  v_rows int;
  v_subtotal numeric := 0;
  v_fee numeric := 0;
  v_promo_discount numeric := 0;
  v_loyalty_discount numeric := 0;
  v_points int := GREATEST(COALESCE(_loyalty_points, 0), 0);
  v_balance int;
  v_tier jsonb;
  v_earned int := 0;
  v_local timestamp;
BEGIN
  IF _order_type NOT IN ('dine_in', 'pickup', 'delivery') THEN
    RAISE EXCEPTION 'Invalid order type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.is_active = true) THEN
    RAISE EXCEPTION 'Restaurant is not accepting orders';
  END IF;

  IF _table_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_tables t WHERE t.id = _table_id AND t.restaurant_id = _restaurant_id
  ) THEN
    RAISE EXCEPTION 'Invalid table';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings WHERE restaurant_id = _restaurant_id LIMIT 1;

  IF _order_type = 'delivery' AND COALESCE(v_settings.delivery_enabled, false) = false THEN
    RAISE EXCEPTION 'Delivery is not available';
  END IF;
  IF _order_type = 'pickup' AND COALESCE(v_settings.pickup_enabled, false) = false THEN
    RAISE EXCEPTION 'Pickup is not available';
  END IF;

  IF v_uid IS NOT NULL THEN
    v_customer_id := public.current_restaurant_customer_id(_restaurant_id);
  END IF;

  INSERT INTO public.orders (
    restaurant_id, table_id, user_id, customer_id, status, total_amount, order_type,
    customer_name, customer_phone, delivery_address, delivery_instructions
  ) VALUES (
    _restaurant_id,
    CASE WHEN _order_type = 'dine_in' THEN _table_id ELSE NULL END,
    v_uid, v_customer_id, 'pending', 0, _order_type,
    NULLIF(trim(COALESCE(_customer_name, '')), ''),
    NULLIF(trim(COALESCE(_customer_phone, '')), ''),
    CASE WHEN _order_type = 'delivery' THEN NULLIF(trim(COALESCE(_delivery_address, '')), '') ELSE NULL END,
    NULLIF(trim(COALESCE(_delivery_instructions, '')), '')
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (
      order_id, restaurant_id, menu_item_id, quantity, notes, status, selected_tags, selected_addons
    )
    SELECT v_order_id, _restaurant_id, mi.id,
           LEAST(GREATEST(1, COALESCE((v_item->>'quantity')::int, 1)), 999),
           NULLIF(v_item->>'notes', ''),
           'pending',
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_item->'selected_tags', '[]'::jsonb)) x), '{}'),
           COALESCE((SELECT jsonb_agg(jsonb_build_object('option_id', x))
                     FROM jsonb_array_elements_text(COALESCE(v_item->'addon_option_ids', '[]'::jsonb)) x), '[]'::jsonb)
    FROM public.menu_items mi
    WHERE mi.id = (v_item->>'menu_item_id')::uuid
      AND mi.restaurant_id = _restaurant_id
      AND mi.is_available = true;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    v_inserted := v_inserted + v_rows;
  END LOOP;

  IF v_inserted = 0 THEN
    RAISE EXCEPTION 'No valid items in cart';
  END IF;

  -- Pre-tax subtotal including add-ons (the same basis the cart shows).
  SELECT COALESCE(SUM(
           (mi.price + COALESCE((SELECT SUM((a->>'price_modifier')::numeric)
                                 FROM jsonb_array_elements(oi.selected_addons) a), 0)) * oi.quantity
         ), 0)
  INTO v_subtotal
  FROM public.order_items oi
  JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = v_order_id;

  IF _order_type = 'delivery' THEN
    IF v_subtotal < COALESCE(v_settings.delivery_min_order, 0) THEN
      RAISE EXCEPTION 'Order is below the delivery minimum';
    END IF;
    v_fee := COALESCE(v_settings.delivery_fee, 0);
    IF COALESCE(v_settings.free_delivery_min, 0) > 0 AND v_subtotal >= v_settings.free_delivery_min THEN
      v_fee := 0;
    END IF;
  END IF;

  -- Promotion
  IF _promotion_id IS NOT NULL THEN
    SELECT * INTO v_promo FROM public.promotions
    WHERE id = _promotion_id AND restaurant_id = _restaurant_id
    FOR UPDATE;

    IF NOT FOUND
       OR NOT v_promo.is_active
       OR (v_promo.starts_at IS NOT NULL AND v_promo.starts_at > now())
       OR (v_promo.ends_at IS NOT NULL AND v_promo.ends_at <= now())
       OR (COALESCE(v_promo.max_uses, 0) > 0 AND v_promo.used_count >= v_promo.max_uses)
       OR v_subtotal < COALESCE(v_promo.min_order_amount, 0) THEN
      RAISE EXCEPTION 'This promotion is no longer available';
    END IF;

    IF v_promo.type = 'happy_hour' THEN
      BEGIN
        v_local := now() AT TIME ZONE COALESCE(NULLIF(_client_timezone, ''), 'UTC');
      EXCEPTION WHEN others THEN
        v_local := now() AT TIME ZONE 'UTC';
      END;
      IF v_promo.happy_hour_start IS NULL OR v_promo.happy_hour_end IS NULL
         OR (v_promo.happy_hour_days IS NOT NULL
             AND NOT (extract(dow FROM v_local)::int = ANY (v_promo.happy_hour_days)))
         OR v_local::time < v_promo.happy_hour_start
         OR v_local::time > v_promo.happy_hour_end THEN
        RAISE EXCEPTION 'This promotion is not active right now';
      END IF;
    END IF;

    IF v_promo.is_first_order_only OR v_promo.type = 'first_order' THEN
      IF v_uid IS NULL OR EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.user_id = v_uid AND o.restaurant_id = _restaurant_id
          AND o.id <> v_order_id AND o.status <> 'cancelled'
      ) THEN
        RAISE EXCEPTION 'This promotion is only for your first order';
      END IF;
    END IF;

    IF COALESCE(v_promo.max_uses_per_user, 0) > 0 THEN
      IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Sign in to use this promotion';
      END IF;
      IF (SELECT count(*) FROM public.promotion_uses pu
          WHERE pu.promotion_id = v_promo.id AND pu.user_id = v_uid) >= v_promo.max_uses_per_user THEN
        RAISE EXCEPTION 'You have already used this promotion';
      END IF;
    END IF;

    IF v_promo.type IN ('percentage', 'happy_hour', 'first_order') THEN
      v_promo_discount := v_subtotal * (v_promo.discount_value / 100);
      IF COALESCE(v_promo.max_discount_amount, 0) > 0 THEN
        v_promo_discount := LEAST(v_promo_discount, v_promo.max_discount_amount);
      END IF;
    ELSIF v_promo.type = 'fixed' THEN
      v_promo_discount := LEAST(v_promo.discount_value, v_subtotal);
    END IF;
    v_promo_discount := ROUND(GREATEST(v_promo_discount, 0), 2);
  END IF;

  -- Loyalty
  SELECT * INTO v_loyalty FROM public.loyalty_settings WHERE restaurant_id = _restaurant_id LIMIT 1;

  IF v_points > 0 THEN
    IF v_uid IS NULL THEN
      RAISE EXCEPTION 'Sign in to redeem points';
    END IF;
    IF NOT COALESCE(v_loyalty.is_enabled, false) THEN
      RAISE EXCEPTION 'Loyalty rewards are not available';
    END IF;

    -- Serialize concurrent redemptions by the same user.
    PERFORM pg_advisory_xact_lock(hashtext('loyalty:' || v_uid::text || ':' || _restaurant_id::text));
    v_balance := public.get_loyalty_balance(v_uid, _restaurant_id);

    IF v_points > v_balance OR v_points < COALESCE(v_loyalty.min_redeem_points, 0) THEN
      RAISE EXCEPTION 'Not enough loyalty points';
    END IF;

    IF v_loyalty.redemption_type = 'flexible' THEN
      IF COALESCE(v_loyalty.point_value, 0) <= 0 THEN
        RAISE EXCEPTION 'Loyalty rewards are not available';
      END IF;
      -- Don't burn more points than needed to cover the order.
      v_points := LEAST(v_points, CEIL((v_subtotal - v_promo_discount) / v_loyalty.point_value)::int);
      v_loyalty_discount := ROUND(v_points * v_loyalty.point_value, 2);
    ELSE
      SELECT t INTO v_tier
      FROM jsonb_array_elements(COALESCE(v_loyalty.redemption_tiers, '[]'::jsonb)) t
      WHERE (t->>'points')::int <= v_points
      ORDER BY (t->>'points')::int DESC
      LIMIT 1;
      IF v_tier IS NULL THEN
        RAISE EXCEPTION 'No reward tier matches those points';
      END IF;
      v_points := (v_tier->>'points')::int;
      v_loyalty_discount := (v_tier->>'discount')::numeric;
    END IF;

    v_loyalty_discount := LEAST(v_loyalty_discount, GREATEST(v_subtotal - v_promo_discount, 0));
    IF v_points <= 0 THEN
      v_loyalty_discount := 0;
    END IF;
  ELSE
    v_points := 0;
  END IF;

  -- Apply discount + fee; the totals trigger computes total_amount (with tax).
  PERFORM set_config('app.trusted_order_pricing', 'on', true);
  UPDATE public.orders
  SET discount_amount = v_promo_discount + v_loyalty_discount,
      delivery_fee = v_fee
  WHERE id = v_order_id;
  PERFORM set_config('app.trusted_order_pricing', '', true);

  IF v_promo_discount > 0 THEN
    INSERT INTO public.promotion_uses (promotion_id, user_id, order_id, discount_applied, restaurant_id)
    VALUES (v_promo.id, v_uid, v_order_id, v_promo_discount, _restaurant_id);
    UPDATE public.promotions SET used_count = used_count + 1 WHERE id = v_promo.id;
  END IF;

  IF v_points > 0 AND v_loyalty_discount > 0 THEN
    INSERT INTO public.loyalty_transactions (user_id, customer_id, restaurant_id, points, type, order_id, description)
    VALUES (v_uid, v_customer_id, _restaurant_id, -v_points, 'redeem', v_order_id,
            'Redeemed ' || v_points || ' points for discount');
  END IF;

  IF v_uid IS NOT NULL AND COALESCE(v_loyalty.is_enabled, false) THEN
    IF v_loyalty.earn_type = 'per_order' THEN
      v_earned := COALESCE(v_loyalty.points_per_order, 0);
    ELSE
      v_earned := FLOOR(GREATEST(v_subtotal - v_promo_discount - v_loyalty_discount, 0)
                        * COALESCE(v_loyalty.points_per_currency, 0))::int;
    END IF;
    IF v_earned > 0 THEN
      INSERT INTO public.loyalty_transactions (user_id, customer_id, restaurant_id, points, type, order_id, description, expires_at)
      VALUES (v_uid, v_customer_id, _restaurant_id, v_earned, 'earn', v_order_id,
              'Earned ' || v_earned || ' points',
              CASE WHEN v_loyalty.expiry_enabled THEN now() + make_interval(days => COALESCE(v_loyalty.expiry_days, 0)) END);
    END IF;
  END IF;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_customer_order(uuid, jsonb, uuid, text, text, text, text, text, uuid, integer, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_customer_order(uuid, jsonb, uuid, text, text, text, text, text, uuid, integer, text) TO anon, authenticated;

-- Internal helpers aren't meant to be called over the API.
REVOKE EXECUTE ON FUNCTION public.can_write_order_pricing(uuid) FROM PUBLIC, anon, authenticated;
