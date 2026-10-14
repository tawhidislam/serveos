-- Scope staff_branches admin/manager policies to current restaurant
DROP POLICY IF EXISTS "Admin can manage staff branches" ON public.staff_branches;
DROP POLICY IF EXISTS "Manager can manage staff branches" ON public.staff_branches;

CREATE POLICY "Admin can manage staff branches"
ON public.staff_branches
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());

CREATE POLICY "Manager can manage staff branches"
ON public.staff_branches
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());