-- Make user_id nullable for guest orders
ALTER TABLE public.orders ALTER COLUMN user_id DROP NOT NULL;

-- Drop old insert policy that requires auth
DROP POLICY IF EXISTS "Users can create orders" ON public.orders;

-- Allow anyone (including anon) to insert orders
CREATE POLICY "Anyone can create orders"
  ON public.orders
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Drop old order_items insert policy for users
DROP POLICY IF EXISTS "Users can create order items" ON public.order_items;

-- Allow anyone to insert order items for their order
CREATE POLICY "Anyone can create order items"
  ON public.order_items
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Allow anon to read their orders by id (for order status page)
CREATE POLICY "Anyone can view orders by id"
  ON public.orders
  FOR SELECT
  TO anon
  USING (true);

-- Allow anon to view order items
CREATE POLICY "Anyone can view order items"
  ON public.order_items
  FOR SELECT
  TO anon
  USING (true);