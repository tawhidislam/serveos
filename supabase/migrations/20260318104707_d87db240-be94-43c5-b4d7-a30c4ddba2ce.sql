
CREATE TABLE public.restaurant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_name text NOT NULL DEFAULT 'My Restaurant',
  logo_url text,
  tax_percentage numeric NOT NULL DEFAULT 10,
  currency text NOT NULL DEFAULT 'USD',
  qr_ordering_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings viewable by all" ON public.restaurant_settings
  FOR SELECT TO public USING (true);

-- Only admin/manager can update
CREATE POLICY "Admin can manage settings" ON public.restaurant_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage settings" ON public.restaurant_settings
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Insert default row
INSERT INTO public.restaurant_settings (restaurant_name, tax_percentage, currency, qr_ordering_enabled)
VALUES ('My Restaurant', 10, 'USD', true);

-- Updated_at trigger
CREATE TRIGGER update_restaurant_settings_updated_at
  BEFORE UPDATE ON public.restaurant_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
