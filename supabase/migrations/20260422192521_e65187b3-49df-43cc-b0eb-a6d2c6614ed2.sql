
-- Settings (singleton)
CREATE TABLE public.marketing_contact_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eyebrow TEXT NOT NULL DEFAULT 'Contact',
  title TEXT NOT NULL DEFAULT 'Let''s talk',
  description TEXT NOT NULL DEFAULT 'Questions about pricing, demos, or onboarding? Drop us a note and we''ll get back within one business day.',
  contact_info JSONB NOT NULL DEFAULT '[]'::jsonb,
  reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
  response_time_text TEXT NOT NULL DEFAULT 'We typically respond within one business day.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_contact_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contact settings are publicly readable"
ON public.marketing_contact_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Platform admins manage contact settings"
ON public.marketing_contact_settings FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER update_marketing_contact_settings_updated_at
BEFORE UPDATE ON public.marketing_contact_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default singleton row
INSERT INTO public.marketing_contact_settings (contact_info, reasons)
VALUES (
  '[
    {"icon":"mail","label":"Email","value":"hello@serveos.com"},
    {"icon":"phone","label":"Phone","value":"+1 (555) 010-2024"},
    {"icon":"map","label":"Office","value":"124 Restaurant Row\nNew York, NY 10013"}
  ]'::jsonb,
  '["General inquiry","Sales / pricing","Book a demo","Partnership","Support","Other"]'::jsonb
);

-- Submissions
CREATE TABLE public.marketing_contact_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT,
  reason TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketing_contact_submissions_created_at
  ON public.marketing_contact_submissions (created_at DESC);
CREATE INDEX idx_marketing_contact_submissions_status
  ON public.marketing_contact_submissions (status);

ALTER TABLE public.marketing_contact_submissions ENABLE ROW LEVEL SECURITY;

-- Anyone (incl. anonymous visitors) can submit the public form
CREATE POLICY "Anyone can submit contact form"
ON public.marketing_contact_submissions FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(name)) BETWEEN 1 AND 120
  AND length(trim(email)) BETWEEN 3 AND 200
  AND length(trim(message)) BETWEEN 10 AND 5000
  AND (company IS NULL OR length(company) <= 200)
  AND (reason IS NULL OR length(reason) <= 100)
);

-- Only platform admins can read / manage submissions
CREATE POLICY "Platform admins read submissions"
ON public.marketing_contact_submissions FOR SELECT
TO authenticated
USING (is_platform_admin());

CREATE POLICY "Platform admins update submissions"
ON public.marketing_contact_submissions FOR UPDATE
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE POLICY "Platform admins delete submissions"
ON public.marketing_contact_submissions FOR DELETE
TO authenticated
USING (is_platform_admin());

CREATE TRIGGER update_marketing_contact_submissions_updated_at
BEFORE UPDATE ON public.marketing_contact_submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
