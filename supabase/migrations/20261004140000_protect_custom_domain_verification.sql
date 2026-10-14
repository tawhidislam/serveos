-- Tenants could set `verified = true` on their own custom domains directly
-- (the "Tenant members manage own domains" policy allows ALL), skipping DNS
-- verification and Cloudflare registration. Only the verification edge
-- function (service role) and platform admins may change verification state.

CREATE OR REPLACE FUNCTION public.guard_custom_domain_verification()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  trusted boolean :=
    COALESCE(current_setting('request.jwt.claims', true), '') = ''
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    OR public.is_platform_admin();
BEGIN
  IF trusted THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.verified := false;
    NEW.verified_at := NULL;
    NEW.last_check_at := NULL;
    NEW.last_check_error := NULL;
  ELSE
    NEW.verified := OLD.verified;
    NEW.verified_at := OLD.verified_at;
    NEW.last_check_at := OLD.last_check_at;
    NEW.last_check_error := OLD.last_check_error;
    -- Changing the domain or its token would let a verified row be repointed.
    NEW.domain := OLD.domain;
    NEW.verification_token := OLD.verification_token;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_custom_domain_verification ON public.restaurant_custom_domains;
CREATE TRIGGER trg_guard_custom_domain_verification
BEFORE INSERT OR UPDATE ON public.restaurant_custom_domains
FOR EACH ROW EXECUTE FUNCTION public.guard_custom_domain_verification();
