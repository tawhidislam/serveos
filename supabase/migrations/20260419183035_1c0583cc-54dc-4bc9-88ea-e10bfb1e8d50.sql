-- Custom domain support per restaurant
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS custom_domain TEXT,
  ADD COLUMN IF NOT EXISTS custom_domain_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain_verified_at TIMESTAMPTZ;

-- Normalize + uniqueness (case-insensitive, ignore NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_custom_domain_unique_idx
  ON public.restaurants (LOWER(custom_domain))
  WHERE custom_domain IS NOT NULL;

-- Validation: lowercase, basic hostname shape, length cap, auto-clear verification on change
CREATE OR REPLACE FUNCTION public.normalize_custom_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_domain IS NOT NULL THEN
    NEW.custom_domain := LOWER(TRIM(NEW.custom_domain));
    -- strip protocol/path if pasted in
    NEW.custom_domain := regexp_replace(NEW.custom_domain, '^https?://', '');
    NEW.custom_domain := regexp_replace(NEW.custom_domain, '/.*$', '');

    IF NEW.custom_domain = '' THEN
      NEW.custom_domain := NULL;
    ELSIF length(NEW.custom_domain) > 253
       OR NEW.custom_domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' THEN
      RAISE EXCEPTION 'Invalid custom domain: %', NEW.custom_domain;
    END IF;
  END IF;

  -- If domain changed, reset verification
  IF TG_OP = 'UPDATE' AND COALESCE(NEW.custom_domain,'') IS DISTINCT FROM COALESCE(OLD.custom_domain,'') THEN
    NEW.custom_domain_verified := false;
    NEW.custom_domain_verified_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_custom_domain ON public.restaurants;
CREATE TRIGGER trg_normalize_custom_domain
BEFORE INSERT OR UPDATE ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.normalize_custom_domain();