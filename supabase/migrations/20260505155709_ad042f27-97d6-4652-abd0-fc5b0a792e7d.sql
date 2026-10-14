
-- 1. restaurant_customers table
CREATE TABLE public.restaurant_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  auth_user_id uuid NOT NULL,
  email text NOT NULL,
  display_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX restaurant_customers_restaurant_email_uidx
  ON public.restaurant_customers (restaurant_id, lower(email));
CREATE UNIQUE INDEX restaurant_customers_restaurant_auth_uidx
  ON public.restaurant_customers (restaurant_id, auth_user_id);
CREATE INDEX restaurant_customers_auth_user_idx
  ON public.restaurant_customers (auth_user_id);

ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;

-- Customer can read/update own row
CREATE POLICY "Customer reads own row"
  ON public.restaurant_customers FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

CREATE POLICY "Customer updates own row"
  ON public.restaurant_customers FOR UPDATE
  TO authenticated
  USING (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Staff of the restaurant can read all customers
CREATE POLICY "Restaurant staff read customers"
  ON public.restaurant_customers FOR SELECT
  TO authenticated
  USING (
    restaurant_id = current_restaurant_id()
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'manager'::app_role)
      OR has_role(auth.uid(), 'waiter'::app_role)
      OR has_role(auth.uid(), 'server'::app_role)
      OR has_role(auth.uid(), 'owner'::app_role)
    )
  );

-- Restaurant owner can manage customers
CREATE POLICY "Restaurant owner manages customers"
  ON public.restaurant_customers FOR ALL
  TO authenticated
  USING (is_restaurant_owner(restaurant_id))
  WITH CHECK (is_restaurant_owner(restaurant_id));

-- Updated_at trigger
CREATE TRIGGER restaurant_customers_set_updated_at
BEFORE UPDATE ON public.restaurant_customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. customer_id columns on dependent tables
ALTER TABLE public.orders
  ADD COLUMN customer_id uuid REFERENCES public.restaurant_customers(id) ON DELETE SET NULL;
CREATE INDEX orders_customer_id_idx ON public.orders (customer_id);

ALTER TABLE public.loyalty_transactions
  ADD COLUMN customer_id uuid REFERENCES public.restaurant_customers(id) ON DELETE SET NULL;
CREATE INDEX loyalty_transactions_customer_id_idx ON public.loyalty_transactions (customer_id);

ALTER TABLE public.reservations
  ADD COLUMN customer_id uuid REFERENCES public.restaurant_customers(id) ON DELETE SET NULL;
CREATE INDEX reservations_customer_id_idx ON public.reservations (customer_id);

-- 3. Helper to resolve current customer in a restaurant
CREATE OR REPLACE FUNCTION public.current_restaurant_customer_id(_restaurant_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.restaurant_customers
  WHERE auth_user_id = auth.uid() AND restaurant_id = _restaurant_id
  LIMIT 1
$$;

-- 4. Allow customers to read their own orders / loyalty / reservations via customer_id
CREATE POLICY "Customers read own orders"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    customer_id IS NOT NULL
    AND customer_id IN (
      SELECT id FROM public.restaurant_customers WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers read own loyalty"
  ON public.loyalty_transactions FOR SELECT
  TO authenticated
  USING (
    customer_id IS NOT NULL
    AND customer_id IN (
      SELECT id FROM public.restaurant_customers WHERE auth_user_id = auth.uid()
    )
  );

CREATE POLICY "Customers read own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    customer_id IS NOT NULL
    AND customer_id IN (
      SELECT id FROM public.restaurant_customers WHERE auth_user_id = auth.uid()
    )
  );
