ALTER TABLE public.restaurant_settings
ADD COLUMN IF NOT EXISTS order_page_template text NOT NULL DEFAULT 'classic';