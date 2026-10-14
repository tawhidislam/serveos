CREATE OR REPLACE FUNCTION public.place_guest_order(
  _restaurant_id uuid,
  _order_type text,
  _customer_name text,
  _customer_phone text,
  _delivery_address text,
  _delivery_instructions text,
  _items jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_settings public.restaurant_settings%ROWTYPE;
  v_subtotal numeric := 0;
  v_fee numeric := 0;
  v_item jsonb;
BEGIN
  IF _order_type NOT IN ('pickup','delivery') THEN
    RAISE EXCEPTION 'Invalid order type';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = _restaurant_id AND r.is_active = true) THEN
    RAISE EXCEPTION 'Restaurant is not accepting orders';
  END IF;

  SELECT * INTO v_settings FROM public.restaurant_settings WHERE restaurant_id = _restaurant_id LIMIT 1;

  IF _order_type = 'delivery' AND COALESCE(v_settings.delivery_enabled, false) = false THEN
    RAISE EXCEPTION 'Delivery is not available';
  END IF;
  IF _order_type = 'pickup' AND COALESCE(v_settings.pickup_enabled, false) = false THEN
    RAISE EXCEPTION 'Pickup is not available';
  END IF;

  IF _customer_name IS NULL OR length(trim(_customer_name)) = 0
     OR _customer_phone IS NULL OR length(trim(_customer_phone)) = 0 THEN
    RAISE EXCEPTION 'Name and phone are required';
  END IF;
  IF _order_type = 'delivery' AND (_delivery_address IS NULL OR length(trim(_delivery_address)) = 0) THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;

  IF _items IS NULL OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  SELECT COALESCE(SUM(mi.price * (i->>'quantity')::int), 0)
  INTO v_subtotal
  FROM jsonb_array_elements(_items) AS i
  JOIN public.menu_items mi
    ON mi.id = (i->>'menu_item_id')::uuid
   AND mi.restaurant_id = _restaurant_id
   AND mi.is_available = true;

  IF v_subtotal <= 0 THEN
    RAISE EXCEPTION 'No valid items in cart';
  END IF;

  IF _order_type = 'delivery' THEN
    IF v_subtotal < COALESCE(v_settings.delivery_min_order, 0) THEN
      RAISE EXCEPTION 'Order is below the delivery minimum';
    END IF;
    v_fee := COALESCE(v_settings.delivery_fee, 0);
    IF v_settings.free_delivery_min IS NOT NULL
       AND v_settings.free_delivery_min > 0
       AND v_subtotal >= v_settings.free_delivery_min THEN
      v_fee := 0;
    END IF;
  END IF;

  INSERT INTO public.orders (
    restaurant_id, status, total_amount, order_type,
    customer_name, customer_phone, delivery_address, delivery_instructions, delivery_fee
  ) VALUES (
    _restaurant_id, 'pending', 0, _order_type,
    trim(_customer_name), trim(_customer_phone),
    CASE WHEN _order_type = 'delivery' THEN trim(_delivery_address) ELSE NULL END,
    NULLIF(trim(COALESCE(_delivery_instructions,'')), ''),
    v_fee
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    INSERT INTO public.order_items (order_id, restaurant_id, menu_item_id, quantity, notes, status, selected_tags)
    SELECT v_order_id, _restaurant_id, mi.id,
           GREATEST(1, (v_item->>'quantity')::int),
           NULLIF(v_item->>'notes',''),
           'pending',
           COALESCE((SELECT array_agg(x) FROM jsonb_array_elements_text(COALESCE(v_item->'selected_tags','[]'::jsonb)) x), '{}')
    FROM public.menu_items mi
    WHERE mi.id = (v_item->>'menu_item_id')::uuid
      AND mi.restaurant_id = _restaurant_id
      AND mi.is_available = true;
  END LOOP;

  -- Trigger recalculates the authoritative total (tax + delivery fee).
  UPDATE public.orders SET updated_at = now() WHERE id = v_order_id;

  RETURN v_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.place_guest_order(uuid, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_guest_order(uuid, text, text, text, text, text, jsonb) TO anon, authenticated;