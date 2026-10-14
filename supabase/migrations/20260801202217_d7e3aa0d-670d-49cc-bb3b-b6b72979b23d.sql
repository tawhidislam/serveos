CREATE TABLE public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL,
  branch_id uuid,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('waste','damage','cycle_count','theft','expiry','correction')),
  quantity_before numeric NOT NULL DEFAULT 0,
  quantity_after numeric NOT NULL DEFAULT 0,
  delta numeric NOT NULL DEFAULT 0,
  unit_cost numeric NOT NULL DEFAULT 0,
  cost_impact numeric NOT NULL DEFAULT 0,
  notes text,
  reference text,
  adjusted_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.inventory_adjustments TO authenticated;
GRANT ALL ON public.inventory_adjustments TO service_role;

ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their restaurant adjustments"
ON public.inventory_adjustments FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Managers can record adjustments"
ON public.inventory_adjustments FOR INSERT TO authenticated
WITH CHECK (
  restaurant_id = public.current_restaurant_id()
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE INDEX idx_inventory_adjustments_restaurant_created
  ON public.inventory_adjustments (restaurant_id, created_at DESC);

CREATE TRIGGER trg_inventory_adjustments_updated_at
BEFORE UPDATE ON public.inventory_adjustments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.apply_inventory_adjustments(
  _restaurant_id uuid,
  _reason text,
  _notes text,
  _reference text,
  _lines jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_line jsonb;
  v_item public.inventory_items%ROWTYPE;
  v_after numeric;
  v_delta numeric;
  v_count integer := 0;
  v_line_notes text;
BEGIN
  IF _restaurant_id IS NULL OR _restaurant_id <> public.current_restaurant_id() THEN
    RAISE EXCEPTION 'Not authorized for this restaurant';
  END IF;

  IF NOT (public.has_role(auth.uid(), 'owner')
       OR public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'manager')) THEN
    RAISE EXCEPTION 'You do not have permission to adjust inventory';
  END IF;

  IF _reason NOT IN ('waste','damage','cycle_count','theft','expiry','correction') THEN
    RAISE EXCEPTION 'Invalid adjustment reason';
  END IF;

  IF _lines IS NULL OR jsonb_array_length(_lines) = 0 THEN
    RAISE EXCEPTION 'Add at least one line item';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(_lines) LOOP
    SELECT * INTO v_item FROM public.inventory_items
      WHERE id = (v_line->>'item_id')::uuid AND restaurant_id = _restaurant_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Inventory item not found for this restaurant';
    END IF;

    IF (v_line->>'counted_quantity') IS NOT NULL AND length(trim(v_line->>'counted_quantity')) > 0 THEN
      v_after := (v_line->>'counted_quantity')::numeric;
      v_delta := v_after - v_item.current_stock;
    ELSE
      v_delta := COALESCE((v_line->>'delta')::numeric, 0);
      v_after := v_item.current_stock + v_delta;
    END IF;

    IF v_after < 0 THEN
      RAISE EXCEPTION 'Adjustment would make % negative', v_item.name;
    END IF;

    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.inventory_items
    SET current_stock = v_after, updated_at = now()
    WHERE id = v_item.id;

    v_line_notes := NULLIF(trim(COALESCE(v_line->>'notes','')), '');

    INSERT INTO public.inventory_adjustments (
      restaurant_id, branch_id, item_id, reason, quantity_before, quantity_after,
      delta, unit_cost, cost_impact, notes, reference, adjusted_by
    ) VALUES (
      _restaurant_id, v_item.branch_id, v_item.id, _reason, v_item.current_stock, v_after,
      v_delta, COALESCE(v_item.cost_per_unit, 0), ROUND(ABS(v_delta) * COALESCE(v_item.cost_per_unit, 0), 2),
      COALESCE(v_line_notes, NULLIF(trim(COALESCE(_notes,'')), '')),
      NULLIF(trim(COALESCE(_reference,'')), ''), auth.uid()
    );

    INSERT INTO public.inventory_transactions (
      item_id, type, quantity, unit_cost, total_cost, transaction_date, notes, recorded_by, branch_id, restaurant_id
    ) VALUES (
      v_item.id,
      CASE WHEN _reason IN ('waste','damage','expiry','theft') THEN 'waste' ELSE 'adjustment' END,
      ABS(v_delta),
      COALESCE(v_item.cost_per_unit, 0),
      ROUND(ABS(v_delta) * COALESCE(v_item.cost_per_unit, 0), 2),
      CURRENT_DATE,
      initcap(replace(_reason, '_', ' ')) || ' adjustment'
        || CASE WHEN v_delta > 0 THEN ' (+' ELSE ' (' END || v_delta::text || ')'
        || COALESCE(' · ' || COALESCE(v_line_notes, NULLIF(trim(COALESCE(_notes,'')), '')), ''),
      auth.uid(), v_item.branch_id, _restaurant_id
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;