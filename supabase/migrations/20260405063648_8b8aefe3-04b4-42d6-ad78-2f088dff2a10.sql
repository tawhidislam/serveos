
-- Allow admins to delete orders
CREATE POLICY "Admin can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to delete orders
CREATE POLICY "Manager can delete orders"
ON public.orders
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));

-- Allow admins to delete order items
CREATE POLICY "Admin can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to delete order items
CREATE POLICY "Manager can delete order items"
ON public.order_items
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role));
