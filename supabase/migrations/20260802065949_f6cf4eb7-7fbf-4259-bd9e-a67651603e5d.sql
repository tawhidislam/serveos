CREATE TABLE public.customer_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  address text NOT NULL,
  instructions text,
  phone text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_customer_addresses_customer ON public.customer_addresses(customer_id);
CREATE INDEX idx_customer_addresses_restaurant ON public.customer_addresses(restaurant_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_addresses TO authenticated;
GRANT ALL ON public.customer_addresses TO service_role;

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers manage their own addresses"
ON public.customer_addresses FOR ALL TO authenticated
USING (customer_id = public.current_restaurant_customer_id(restaurant_id))
WITH CHECK (customer_id = public.current_restaurant_customer_id(restaurant_id));

CREATE POLICY "Restaurant staff can view addresses"
ON public.customer_addresses FOR SELECT TO authenticated
USING (
  restaurant_id = public.current_restaurant_id()
  AND (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
);

CREATE TRIGGER update_customer_addresses_updated_at
BEFORE UPDATE ON public.customer_addresses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();