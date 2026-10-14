CREATE TABLE public.cta_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  destination text NOT NULL,
  destination_type text NOT NULL DEFAULT 'other',
  fulfillment text,
  label text,
  source text,
  page_path text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cta_clicks_restaurant_created ON public.cta_clicks (restaurant_id, created_at DESC);

GRANT INSERT ON public.cta_clicks TO anon, authenticated;
GRANT SELECT ON public.cta_clicks TO authenticated;
GRANT ALL ON public.cta_clicks TO service_role;

ALTER TABLE public.cta_clicks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a CTA click for an active restaurant"
ON public.cta_clicks FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = cta_clicks.restaurant_id AND r.is_active = true));

CREATE POLICY "Tenant members view own cta_clicks"
ON public.cta_clicks FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Platform admins view all cta_clicks"
ON public.cta_clicks FOR SELECT TO authenticated
USING (public.is_platform_admin());