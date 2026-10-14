-- 1) New table: one row per custom domain per restaurant
CREATE TABLE public.restaurant_custom_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT restaurant_custom_domains_domain_unique UNIQUE (domain)
);

CREATE INDEX idx_restaurant_custom_domains_restaurant ON public.restaurant_custom_domains(restaurant_id);
CREATE INDEX idx_restaurant_custom_domains_verified ON public.restaurant_custom_domains(domain) WHERE verified = true;

-- 2) Normalize + validate domain on insert/update
CREATE OR REPLACE FUNCTION public.normalize_restaurant_custom_domain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.domain IS NULL THEN
    RAISE EXCEPTION 'Domain is required';
  END IF;

  NEW.domain := LOWER(TRIM(NEW.domain));
  NEW.domain := regexp_replace(NEW.domain, '^https?://', '');
  NEW.domain := regexp_replace(NEW.domain, '/.*$', '');

  IF NEW.domain = '' THEN
    RAISE EXCEPTION 'Domain is required';
  END IF;

  IF length(NEW.domain) > 253
     OR NEW.domain !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid custom domain: %', NEW.domain;
  END IF;

  -- If domain string changed on update, reset verification
  IF TG_OP = 'UPDATE' AND NEW.domain IS DISTINCT FROM OLD.domain THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_restaurant_custom_domain
  BEFORE INSERT OR UPDATE ON public.restaurant_custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.normalize_restaurant_custom_domain();

-- 3) RLS
ALTER TABLE public.restaurant_custom_domains ENABLE ROW LEVEL SECURITY;

-- Public can read VERIFIED domains so anonymous visitors can resolve the hostname
CREATE POLICY "Verified domains readable by anyone"
  ON public.restaurant_custom_domains
  FOR SELECT
  TO anon, authenticated
  USING (verified = true);

-- Tenant members can view all their own restaurant's domains (verified or not)
CREATE POLICY "Tenant members view own domains"
  ON public.restaurant_custom_domains
  FOR SELECT
  TO authenticated
  USING (restaurant_id = current_restaurant_id());

-- Tenant members can add/remove/update domains for their own restaurant
CREATE POLICY "Tenant members manage own domains"
  ON public.restaurant_custom_domains
  FOR ALL
  TO authenticated
  USING (restaurant_id = current_restaurant_id())
  WITH CHECK (restaurant_id = current_restaurant_id());

-- Platform admins manage everything
CREATE POLICY "Platform admins manage all domains"
  ON public.restaurant_custom_domains
  FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- 4) Backfill existing single-domain values into the new table
INSERT INTO public.restaurant_custom_domains (restaurant_id, domain, verified, verified_at)
SELECT id, custom_domain, COALESCE(custom_domain_verified, false), custom_domain_verified_at
FROM public.restaurants
WHERE custom_domain IS NOT NULL
  AND custom_domain <> ''
ON CONFLICT (domain) DO NOTHING;