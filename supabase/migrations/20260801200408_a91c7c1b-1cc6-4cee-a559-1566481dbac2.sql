
CREATE TABLE public.menu_item_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid,
  branch_id uuid,
  menu_item_id uuid NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  quantity_per_unit numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (menu_item_id, inventory_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_item_ingredients TO authenticated;
GRANT ALL ON public.menu_item_ingredients TO service_role;

ALTER TABLE public.menu_item_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view recipes"
ON public.menu_item_ingredients FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Managers can manage recipes"
ON public.menu_item_ingredients FOR ALL TO authenticated
USING (restaurant_id = public.current_restaurant_id() AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)))
WITH CHECK (restaurant_id = public.current_restaurant_id() AND (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'manager'::public.app_role)));

CREATE INDEX idx_menu_item_ingredients_menu_item ON public.menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_ingredients_inventory_item ON public.menu_item_ingredients(inventory_item_id);

CREATE TRIGGER trg_menu_item_ingredients_updated_at
BEFORE UPDATE ON public.menu_item_ingredients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Fill restaurant_id / branch_id from the menu item automatically
CREATE OR REPLACE FUNCTION public.set_menu_item_ingredient_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.restaurant_id IS NULL OR NEW.branch_id IS NULL THEN
    SELECT COALESCE(NEW.restaurant_id, mi.restaurant_id), COALESCE(NEW.branch_id, mi.branch_id)
    INTO NEW.restaurant_id, NEW.branch_id
    FROM public.menu_items mi WHERE mi.id = NEW.menu_item_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_menu_item_ingredients_scope
BEFORE INSERT OR UPDATE ON public.menu_item_ingredients
FOR EACH ROW EXECUTE FUNCTION public.set_menu_item_ingredient_scope();

-- Deduct / restore inventory when order items are created or removed
CREATE OR REPLACE FUNCTION public.apply_order_item_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sign numeric;
  v_item record;
  v_qty integer;
  v_menu_item uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_sign := -1; v_qty := NEW.quantity; v_menu_item := NEW.menu_item_id;
  ELSE
    v_sign := 1; v_qty := OLD.quantity; v_menu_item := OLD.menu_item_id;
  END IF;

  FOR v_item IN
    SELECT mii.inventory_item_id, mii.quantity_per_unit, inv.cost_per_unit, inv.branch_id, inv.restaurant_id
    FROM public.menu_item_ingredients mii
    JOIN public.inventory_items inv ON inv.id = mii.inventory_item_id
    WHERE mii.menu_item_id = v_menu_item AND mii.quantity_per_unit > 0
  LOOP
    UPDATE public.inventory_items
    SET current_stock = current_stock + (v_sign * v_item.quantity_per_unit * v_qty),
        updated_at = now()
    WHERE id = v_item.inventory_item_id;

    INSERT INTO public.inventory_transactions (item_id, type, quantity, unit_cost, total_cost, notes, branch_id, restaurant_id)
    VALUES (
      v_item.inventory_item_id,
      CASE WHEN v_sign < 0 THEN 'usage' ELSE 'adjustment' END,
      v_item.quantity_per_unit * v_qty,
      v_item.cost_per_unit,
      v_item.quantity_per_unit * v_qty * v_item.cost_per_unit,
      CASE WHEN v_sign < 0 THEN 'Auto usage from order item' ELSE 'Auto restock from removed order item' END,
      v_item.branch_id,
      v_item.restaurant_id
    );
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_order_items_stock_insert
AFTER INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.apply_order_item_stock();

CREATE TRIGGER trg_order_items_stock_delete
AFTER DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.apply_order_item_stock();
