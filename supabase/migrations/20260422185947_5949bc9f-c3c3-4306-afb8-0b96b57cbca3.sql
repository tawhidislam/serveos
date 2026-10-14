-- =============================================================
-- Add-on services system
-- =============================================================

-- ---- 1. Catalog -------------------------------------------------
CREATE TABLE public.platform_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,                       -- stable identifier, e.g. 'ai_images'
  name TEXT NOT NULL,
  description TEXT,
  badge TEXT,                                     -- e.g. "Popular", "New"
  billing_type TEXT NOT NULL DEFAULT 'monthly'    -- 'monthly' | 'one_time'
    CHECK (billing_type IN ('monthly', 'one_time')),
  price_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  feature_key TEXT,                               -- maps to PlanLimits key, e.g. 'aiImages'
  icon TEXT,                                      -- lucide icon name
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT true,        -- show on /pricing
  is_active BOOLEAN NOT NULL DEFAULT true,        -- available for purchase
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_addons_active ON public.platform_addons(is_active, is_public, sort_order);

ALTER TABLE public.platform_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Add-on catalog is publicly readable"
  ON public.platform_addons FOR SELECT
  USING (true);

CREATE POLICY "Platform admins manage add-on catalog"
  ON public.platform_addons FOR ALL
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_platform_addons_updated_at
  BEFORE UPDATE ON public.platform_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- 2. Purchase requests --------------------------------------
CREATE TABLE public.addon_purchase_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES public.platform_addons(id) ON DELETE RESTRICT,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_by UUID,                              -- auth.users.id (no FK; matches custom_domain_requests pattern)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','cancelled')),
  payment_method TEXT,                            -- e.g. 'bkash', 'manual'
  payment_reference TEXT,                         -- TrxID etc.
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_type TEXT NOT NULL DEFAULT 'monthly'
    CHECK (billing_type IN ('monthly','one_time')),
  notes TEXT,
  admin_notes TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_addon_requests_tenant ON public.addon_purchase_requests(restaurant_id, status);
CREATE INDEX idx_addon_requests_status ON public.addon_purchase_requests(status, created_at DESC);

ALTER TABLE public.addon_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own addon requests"
  ON public.addon_purchase_requests FOR SELECT
  TO authenticated
  USING (restaurant_id = current_restaurant_id());

CREATE POLICY "Tenant members create own addon requests"
  ON public.addon_purchase_requests FOR INSERT
  TO authenticated
  WITH CHECK (restaurant_id = current_restaurant_id());

CREATE POLICY "Tenant owners cancel own pending addon requests"
  ON public.addon_purchase_requests FOR DELETE
  TO authenticated
  USING (is_restaurant_owner(restaurant_id) AND status = 'pending');

CREATE POLICY "Platform admins manage all addon requests"
  ON public.addon_purchase_requests FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_addon_requests_updated_at
  BEFORE UPDATE ON public.addon_purchase_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- 3. Active add-on grants ------------------------------------
CREATE TABLE public.restaurant_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES public.platform_addons(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'purchase'
    CHECK (source IN ('purchase','grant','trial')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','expired','revoked')),
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,                         -- null = perpetual
  granted_by UUID,                                -- auth.users.id
  granted_via_request_id UUID REFERENCES public.addon_purchase_requests(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, addon_id)
);

CREATE INDEX idx_restaurant_addons_lookup
  ON public.restaurant_addons(restaurant_id, status, expires_at);

ALTER TABLE public.restaurant_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members view own active addons"
  ON public.restaurant_addons FOR SELECT
  TO authenticated
  USING (restaurant_id = current_restaurant_id());

CREATE POLICY "Active addons publicly readable for feature gating"
  ON public.restaurant_addons FOR SELECT
  TO anon
  USING (status = 'active');

CREATE POLICY "Platform admins manage all addon grants"
  ON public.restaurant_addons FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_restaurant_addons_updated_at
  BEFORE UPDATE ON public.restaurant_addons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- 4. Helper: check active addon by feature key --------------
CREATE OR REPLACE FUNCTION public.has_active_addon(_restaurant_id UUID, _feature_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurant_addons ra
    JOIN public.platform_addons pa ON pa.id = ra.addon_id
    WHERE ra.restaurant_id = _restaurant_id
      AND ra.status = 'active'
      AND (ra.expires_at IS NULL OR ra.expires_at > now())
      AND pa.feature_key = _feature_key
      AND pa.is_active = true
  )
$$;