
-- ============================================================
-- 1. Platform admins table (hardcoded allowlist by email)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.platform_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

-- Helper: is the current authenticated user a platform admin?
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.platform_admins pa
    JOIN auth.users u ON LOWER(u.email) = LOWER(pa.email)
    WHERE u.id = auth.uid()
  )
$$;

-- Only platform admins can manage the allowlist
CREATE POLICY "Platform admins manage allowlist"
  ON public.platform_admins
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- ============================================================
-- 2. Auto-setup tenant when a restaurant is inserted
--    Guarantees membership + owner role are created atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_restaurant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    -- Link owner as a member
    INSERT INTO public.restaurant_members (user_id, restaurant_id)
    VALUES (NEW.owner_id, NEW.id)
    ON CONFLICT DO NOTHING;

    -- Grant owner role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.owner_id, 'owner')
    ON CONFLICT DO NOTHING;

    -- Create a default branch
    INSERT INTO public.branches (name, restaurant_id)
    VALUES ('Main Branch', NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_restaurant_created ON public.restaurants;
CREATE TRIGGER on_restaurant_created
  AFTER INSERT ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_restaurant();

-- ============================================================
-- 3. Make user_roles unique on (user_id, role) to support ON CONFLICT
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_roles_user_id_role_key'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
  END IF;
END $$;

-- restaurant_members already has unique (user_id, restaurant_id) implicitly?
-- Add it to be safe.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_members_user_restaurant_key'
  ) THEN
    ALTER TABLE public.restaurant_members
      ADD CONSTRAINT restaurant_members_user_restaurant_key UNIQUE (user_id, restaurant_id);
  END IF;
END $$;
