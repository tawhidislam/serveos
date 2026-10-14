ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS order_page_logo_url text,
  ADD COLUMN IF NOT EXISTS order_page_primary_color text,
  ADD COLUMN IF NOT EXISTS order_page_header_text text,
  ADD COLUMN IF NOT EXISTS order_page_subtext text;