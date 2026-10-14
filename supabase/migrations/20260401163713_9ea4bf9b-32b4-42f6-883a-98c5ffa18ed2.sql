ALTER TABLE public.restaurant_settings
ADD COLUMN primary_color TEXT NOT NULL DEFAULT '#e87c1e',
ADD COLUMN accent_color TEXT NOT NULL DEFAULT '#c8a855',
ADD COLUMN tagline TEXT DEFAULT NULL;