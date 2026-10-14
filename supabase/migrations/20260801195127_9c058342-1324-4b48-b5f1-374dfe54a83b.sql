-- ── Orders: fulfillment fields ────────────────────────────────────────────
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type text NOT NULL DEFAULT 'dine_in',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_phone text,
  ADD COLUMN IF NOT EXISTS delivery_address text,
  ADD COLUMN IF NOT EXISTS delivery_instructions text,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS requested_for timestamptz;

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_order_type_check,
  DROP CONSTRAINT IF EXISTS orders_fulfillment_details_check,
  DROP CONSTRAINT IF EXISTS orders_delivery_fee_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_check
    CHECK (order_type IN ('dine_in', 'pickup', 'delivery')),
  ADD CONSTRAINT orders_delivery_fee_check
    CHECK (delivery_fee >= 0),
  ADD CONSTRAINT orders_fulfillment_details_check CHECK (
    order_type = 'dine_in'
    OR (
      customer_name IS NOT NULL AND length(btrim(customer_name)) > 0
      AND customer_phone IS NOT NULL AND length(btrim(customer_phone)) > 0
      AND (
        order_type <> 'delivery'
        OR (delivery_address IS NOT NULL AND length(btrim(delivery_address)) > 0)
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_orders_type_created
  ON public.orders (restaurant_id, order_type, created_at DESC);

-- ── Restaurant settings: delivery / pickup configuration ─────────────────
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS delivery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pickup_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS delivery_fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS free_delivery_min numeric,
  ADD COLUMN IF NOT EXISTS delivery_min_order numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_eta_minutes integer NOT NULL DEFAULT 45,
  ADD COLUMN IF NOT EXISTS pickup_eta_minutes integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS delivery_area_note text;

-- ── Totals: include delivery fee, scope tax to the right restaurant ──────
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  calc_total NUMERIC;
  tax NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.discount_amount < 0 THEN
      NEW.discount_amount := 0;
    END IF;
    IF NEW.delivery_fee < 0 THEN
      NEW.delivery_fee := 0;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(mi.price * oi.quantity), 0)
  INTO calc_total
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = NEW.id;

  SELECT COALESCE(rs.tax_percentage, 0) INTO tax
  FROM restaurant_settings rs
  WHERE rs.restaurant_id = NEW.restaurant_id
  LIMIT 1;
  tax := COALESCE(tax, 0);

  IF NEW.delivery_fee < 0 THEN
    NEW.delivery_fee := 0;
  END IF;

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
$function$;

DROP TRIGGER IF EXISTS trg_validate_order_totals ON public.orders;
CREATE TRIGGER trg_validate_order_totals
  BEFORE INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.validate_order_totals();

-- ── Guest order tracking by unguessable order id ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_public_order(_order_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', o.id,
    'status', o.status,
    'order_type', o.order_type,
    'created_at', o.created_at,
    'total_amount', o.total_amount,
    'delivery_fee', o.delivery_fee,
    'discount_amount', o.discount_amount,
    'tax_rate', o.tax_rate,
    'ticket_number', o.ticket_number,
    'customer_name', o.customer_name,
    'delivery_address', o.delivery_address,
    'requested_for', o.requested_for,
    'restaurant_slug', r.slug,
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', oi.id,
        'quantity', oi.quantity,
        'status', oi.status,
        'notes', oi.notes,
        'name', mi.name,
        'price', mi.price
      ) ORDER BY oi.created_at)
      FROM order_items oi
      JOIN menu_items mi ON mi.id = oi.menu_item_id
      WHERE oi.order_id = o.id
    ), '[]'::jsonb)
  )
  FROM orders o
  LEFT JOIN restaurants r ON r.id = o.restaurant_id
  WHERE o.id = _order_id
$function$;

REVOKE ALL ON FUNCTION public.get_public_order(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_public_order(uuid) TO anon, authenticated;