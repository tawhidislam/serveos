
-- Manager policies for orders
CREATE POLICY "Managers can view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can view order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can update order items" ON public.order_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'manager'));

-- Waiter policies for orders
CREATE POLICY "Waiters can view all orders" ON public.orders
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Waiters can update orders" ON public.orders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Waiters can view order items" ON public.order_items
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'waiter'));

CREATE POLICY "Waiters can update order items" ON public.order_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'waiter'));

-- Manager management policies
CREATE POLICY "Manager can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Manager can manage categories" ON public.categories
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Manager can manage menu items" ON public.menu_items
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'));
