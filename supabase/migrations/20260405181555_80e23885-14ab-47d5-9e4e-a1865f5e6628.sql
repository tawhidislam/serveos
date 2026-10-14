
-- 1. Fix: Remove overly permissive anon SELECT on orders
DROP POLICY IF EXISTS "Anyone can view orders by id" ON public.orders;

-- 2. Fix: Remove overly permissive anon SELECT on order_items  
DROP POLICY IF EXISTS "Anyone can view order items" ON public.order_items;

-- 3. Fix: Restrict manager role management to non-admin/non-manager roles only
DROP POLICY IF EXISTS "Managers can manage roles" ON public.user_roles;

CREATE POLICY "Managers can read roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Managers can insert non-admin roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role)
  AND role IN ('kitchen'::app_role, 'waiter'::app_role, 'server'::app_role, 'customer'::app_role)
);

CREATE POLICY "Managers can delete non-admin roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  has_role(auth.uid(), 'manager'::app_role)
  AND role IN ('kitchen'::app_role, 'waiter'::app_role, 'server'::app_role, 'customer'::app_role)
);

-- 4. Fix: Add server-side order total validation trigger
-- This recalculates total_amount from order_items when the order is updated
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  calc_total NUMERIC;
  tax NUMERIC;
BEGIN
  -- On INSERT, totals are 0 initially (items added after), so skip validation
  IF TG_OP = 'INSERT' THEN
    -- Force discount_amount to be non-negative and capped
    IF NEW.discount_amount < 0 THEN
      NEW.discount_amount := 0;
    END IF;
    RETURN NEW;
  END IF;

  -- On UPDATE, recalculate total from line items
  SELECT COALESCE(SUM(mi.price * oi.quantity), 0)
  INTO calc_total
  FROM order_items oi
  JOIN menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = NEW.id;

  -- Get configured tax rate
  SELECT COALESCE(rs.tax_percentage, 0) INTO tax
  FROM restaurant_settings rs LIMIT 1;

  -- Enforce calculated total (with tax applied)
  NEW.tax_rate := tax;
  NEW.total_amount := ROUND(calc_total * (1 + tax / 100), 2) - COALESCE(NEW.discount_amount, 0);
  
  IF NEW.total_amount < 0 THEN
    NEW.total_amount := 0;
  END IF;

  -- Cap discount
  IF NEW.discount_amount > calc_total THEN
    NEW.discount_amount := calc_total;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_order_totals
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.validate_order_totals();
