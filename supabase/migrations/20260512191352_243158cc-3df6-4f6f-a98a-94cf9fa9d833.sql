-- Idempotent: ensures the column exists for any environment that missed the prior migration.
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS favicon_url TEXT;

-- Make the "no custom favicon" state explicit so the app's fallback kicks in.
ALTER TABLE public.restaurants ALTER COLUMN favicon_url DROP NOT NULL;
ALTER TABLE public.restaurants ALTER COLUMN favicon_url SET DEFAULT NULL;

-- Backfill: normalize empty strings to NULL so the injector's null-check
-- treats them as "no favicon set" and uses the bundled default.
UPDATE public.restaurants
SET favicon_url = NULL
WHERE favicon_url IS NOT NULL AND length(trim(favicon_url)) = 0;

COMMENT ON COLUMN public.restaurants.favicon_url IS
  'Public URL of the tenant browser-tab icon. NULL means use the platform default favicon (/favicon.png).';