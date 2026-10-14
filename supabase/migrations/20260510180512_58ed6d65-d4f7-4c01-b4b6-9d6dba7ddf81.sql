-- Subdomain pool managed by platform admins
CREATE TABLE public.subdomain_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subdomain text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'available',
  assigned_restaurant_id uuid,
  assigned_at timestamptz,
  assigned_by uuid,
  created_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subdomain_pool_status_check CHECK (status IN ('available','assigned','reserved','retired')),
  CONSTRAINT subdomain_pool_subdomain_format CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);

CREATE INDEX idx_subdomain_pool_status ON public.subdomain_pool(status);
CREATE INDEX idx_subdomain_pool_assigned_restaurant ON public.subdomain_pool(assigned_restaurant_id);

ALTER TABLE public.subdomain_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage subdomain pool"
ON public.subdomain_pool
FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER update_subdomain_pool_updated_at
BEFORE UPDATE ON public.subdomain_pool
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();