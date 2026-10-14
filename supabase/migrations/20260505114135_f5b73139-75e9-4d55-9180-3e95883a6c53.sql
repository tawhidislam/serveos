
CREATE TABLE public.tenant_contact_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'new',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_tenant_contact_submissions_restaurant ON public.tenant_contact_submissions(restaurant_id, created_at DESC);

ALTER TABLE public.tenant_contact_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit tenant contact form"
  ON public.tenant_contact_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    length(trim(name)) BETWEEN 1 AND 120
    AND length(trim(email)) BETWEEN 3 AND 200
    AND length(trim(message)) BETWEEN 5 AND 5000
    AND (subject IS NULL OR length(subject) <= 200)
    AND (user_agent IS NULL OR length(user_agent) <= 500)
  );

CREATE POLICY "Tenant members view submissions"
  ON public.tenant_contact_submissions
  FOR SELECT
  TO authenticated
  USING (restaurant_id = current_restaurant_id() OR is_platform_admin());

CREATE POLICY "Tenant members update submissions"
  ON public.tenant_contact_submissions
  FOR UPDATE
  TO authenticated
  USING (restaurant_id = current_restaurant_id() OR is_platform_admin())
  WITH CHECK (restaurant_id = current_restaurant_id() OR is_platform_admin());

CREATE POLICY "Tenant members delete submissions"
  ON public.tenant_contact_submissions
  FOR DELETE
  TO authenticated
  USING (restaurant_id = current_restaurant_id() OR is_platform_admin());

CREATE TRIGGER trg_tenant_contact_submissions_updated_at
  BEFORE UPDATE ON public.tenant_contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
