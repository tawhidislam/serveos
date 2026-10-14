-- Allow waiters to insert order items (for modifying orders)
CREATE POLICY "Waiters can insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'waiter'::app_role));

-- Allow admins to insert order items
CREATE POLICY "Admins can insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to insert order items
CREATE POLICY "Managers can insert order items"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'manager'::app_role));