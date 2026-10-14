-- Custom domain requests: free-tier owners can request a custom domain;
-- platform admins review and approve (which they typically do by upgrading the plan).
CREATE TABLE public.custom_domain_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  requested_domain TEXT NOT NULL,
  requested_by UUID,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_cdr_restaurant ON public.custom_domain_requests(restaurant_id);
CREATE INDEX idx_cdr_status ON public.custom_domain_requests(status);

ALTER TABLE public.custom_domain_requests ENABLE ROW LEVEL SECURITY;

-- Tenant members (owners/staff of a restaurant) can view & create requests for their restaurant
CREATE POLICY "Tenant members view own domain requests"
ON public.custom_domain_requests
FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members create own domain requests"
ON public.custom_domain_requests
FOR INSERT TO authenticated
WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant owners cancel own domain requests"
ON public.custom_domain_requests
FOR DELETE TO authenticated
USING (public.is_restaurant_owner(restaurant_id) AND status = 'pending');

-- Platform admins can do everything
CREATE POLICY "Platform admins manage all domain requests"
ON public.custom_domain_requests
FOR ALL TO authenticated
USING (public.is_platform_admin())
WITH CHECK (public.is_platform_admin());

-- Auto-update updated_at
CREATE TRIGGER trg_cdr_updated_at
BEFORE UPDATE ON public.custom_domain_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();