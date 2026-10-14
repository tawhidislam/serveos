-- Marketing footer settings (single row, edited by platform admin)
CREATE TABLE public.marketing_footer_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tagline TEXT NOT NULL DEFAULT 'The all-in-one restaurant management system. QR ordering, kitchen displays, billing, and analytics — built for modern hospitality.',
  social_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  copyright_text TEXT NOT NULL DEFAULT '© {year} {siteName}. All rights reserved.',
  bottom_tagline TEXT NOT NULL DEFAULT 'Built for restaurants that move fast.',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_footer_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Footer settings are publicly readable"
ON public.marketing_footer_settings
FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Platform admins manage footer settings"
ON public.marketing_footer_settings
FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER update_marketing_footer_settings_updated_at
BEFORE UPDATE ON public.marketing_footer_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default row
INSERT INTO public.marketing_footer_settings (tagline, social_links, columns, copyright_text, bottom_tagline)
VALUES (
  'The all-in-one restaurant management system. QR ordering, kitchen displays, billing, and analytics — built for modern hospitality.',
  '[
    {"icon":"twitter","href":"#","label":"Twitter"},
    {"icon":"github","href":"#","label":"GitHub"},
    {"icon":"linkedin","href":"#","label":"LinkedIn"}
  ]'::jsonb,
  '[
    {"title":"Product","links":[{"label":"Features","to":"/features"},{"label":"Pricing","to":"/pricing"},{"label":"Demo","to":"/demo"}]},
    {"title":"Company","links":[{"label":"About","to":"/about"},{"label":"Contact","to":"/contact"}]},
    {"title":"Account","links":[{"label":"Sign in","to":"/login"},{"label":"Get started","to":"/signup"}]},
    {"title":"Legal","links":[{"label":"Terms & Conditions","to":"/terms"}]}
  ]'::jsonb,
  '© {year} {siteName}. All rights reserved.',
  'Built for restaurants that move fast.'
);