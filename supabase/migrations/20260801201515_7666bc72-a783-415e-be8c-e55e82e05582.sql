CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  branch_id uuid,
  name text NOT NULL,
  contact_name text,
  phone text,
  email text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage own suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  branch_id uuid,
  supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name text,
  reference text,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  total_cost numeric NOT NULL DEFAULT 0,
  notes text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_receipts TO authenticated;
GRANT ALL ON public.stock_receipts TO service_role;
ALTER TABLE public.stock_receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage own stock_receipts" ON public.stock_receipts
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE TABLE public.stock_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id uuid NOT NULL REFERENCES public.stock_receipts(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  expiry_date date,
  batch_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_receipt_lines TO authenticated;
GRANT ALL ON public.stock_receipt_lines TO service_role;
ALTER TABLE public.stock_receipt_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenant members manage own stock_receipt_lines" ON public.stock_receipt_lines
  FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE INDEX idx_stock_receipts_restaurant ON public.stock_receipts(restaurant_id, received_date DESC);
CREATE INDEX idx_stock_receipt_lines_receipt ON public.stock_receipt_lines(receipt_id);
CREATE INDEX idx_stock_receipt_lines_expiry ON public.stock_receipt_lines(restaurant_id, expiry_date);

CREATE TRIGGER trg_suppliers_updated_at BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_stock_receipts_updated_at BEFORE UPDATE ON public.stock_receipts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.receive_stock_batch(
  _restaurant_id uuid,
  _supplier_id uuid,
  _supplier_name text,
  _reference text,
  _received_date date,
  _notes text,
  _lines jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_receipt_id uuid;
  v_line jsonb;
  v_item public.inventory_items%ROWTYPE;
  v_qty numeric;
  v_cost numeric;
  v_total numeric := 0;
BEGIN
  IF _restaurant_id IS NULL OR _restaurant_id <> public.current_restaurant_id() THEN
    RAISE EXCEPTION 'Not authorized for this restaurant';
  END IF;
  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line item';
  END IF;

  INSERT INTO public.stock_receipts (restaurant_id, supplier_id, supplier_name, reference, received_date, notes, recorded_by)
  VALUES (_restaurant_id, _supplier_id, NULLIF(trim(COALESCE(_supplier_name,'')),''), NULLIF(trim(COALESCE(_reference,'')),''),
          COALESCE(_received_date, CURRENT_DATE), NULLIF(trim(COALESCE(_notes,'')),''), auth.uid())
  RETURNING id INTO v_receipt_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO v_item FROM public.inventory_items
      WHERE id = (v_line->>'item_id')::uuid AND restaurant_id = _restaurant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found for this restaurant';
    END IF;

    v_qty := COALESCE((v_line->>'quantity')::numeric, 0);
    v_cost := COALESCE((v_line->>'unit_cost')::numeric, 0);
    IF v_qty <= 0 THEN
      RAISE EXCEPTION 'Quantity must be greater than zero for %', v_item.name;
    END IF;
    IF v_cost < 0 THEN
      RAISE EXCEPTION 'Unit cost cannot be negative for %', v_item.name;
    END IF;

    INSERT INTO public.stock_receipt_lines (receipt_id, restaurant_id, item_id, quantity, unit_cost, total_cost, expiry_date, batch_code)
    VALUES (v_receipt_id, _restaurant_id, v_item.id, v_qty, v_cost, v_qty * v_cost,
            NULLIF(v_line->>'expiry_date','')::date, NULLIF(trim(COALESCE(v_line->>'batch_code','')),''));

    UPDATE public.inventory_items
    SET current_stock = current_stock + v_qty,
        cost_per_unit = CASE WHEN v_cost > 0 THEN v_cost ELSE cost_per_unit END,
        updated_at = now()
    WHERE id = v_item.id;

    INSERT INTO public.inventory_transactions (item_id, type, quantity, unit_cost, total_cost, transaction_date, notes, recorded_by, branch_id, restaurant_id)
    VALUES (v_item.id, 'purchase', v_qty, v_cost, v_qty * v_cost, COALESCE(_received_date, CURRENT_DATE),
            'Restock' || COALESCE(' · ' || NULLIF(trim(COALESCE(_supplier_name,'')),''), '') || COALESCE(' · Ref ' || NULLIF(trim(COALESCE(_reference,'')),''), ''),
            auth.uid(), v_item.branch_id, _restaurant_id);

    v_total := v_total + (v_qty * v_cost);
  END LOOP;

  UPDATE public.stock_receipts SET total_cost = v_total WHERE id = v_receipt_id;

  RETURN v_receipt_id;
END;
$$;