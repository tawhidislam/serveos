ALTER TABLE public.restaurant_settings 
ADD COLUMN qr_template text NOT NULL DEFAULT 'classic',
ADD COLUMN qr_color_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;