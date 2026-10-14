DROP POLICY IF EXISTS "Staff can update waiter calls" ON public.waiter_calls;

CREATE POLICY "Staff can update waiter calls"
ON public.waiter_calls
FOR UPDATE
TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role)
   OR has_role(auth.uid(), 'manager'::app_role)
   OR has_role(auth.uid(), 'waiter'::app_role)
   OR has_role(auth.uid(), 'server'::app_role))
  AND restaurant_id = current_restaurant_id()
);