
-- Marketing About page settings (singleton)
CREATE TABLE public.marketing_about_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Hero
  hero_eyebrow TEXT NOT NULL DEFAULT 'About us',
  hero_title TEXT NOT NULL DEFAULT 'Built for restaurants, by people who love them',
  hero_description TEXT NOT NULL DEFAULT 'We started ServeOS because every great restaurant we knew was being held back by clunky, expensive software. So we built something better.',
  -- Mission / vision (array of {icon,title,body})
  pillars JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Why-choose
  why_eyebrow TEXT NOT NULL DEFAULT 'Why choose ServeOS',
  why_title TEXT NOT NULL DEFAULT 'What makes us different',
  values_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Story
  story_eyebrow TEXT NOT NULL DEFAULT 'Our story',
  story_title TEXT NOT NULL DEFAULT 'From the line to the laptop',
  story_paragraphs JSONB NOT NULL DEFAULT '[]'::jsonb,
  story_image_url TEXT,
  hero_image_url TEXT,
  -- CTA
  cta_title TEXT NOT NULL DEFAULT 'Ready to join us?',
  cta_primary_label TEXT NOT NULL DEFAULT 'Get Started',
  cta_primary_href TEXT NOT NULL DEFAULT '/signup',
  cta_secondary_label TEXT NOT NULL DEFAULT 'Get in touch',
  cta_secondary_href TEXT NOT NULL DEFAULT '/contact',
  -- SEO
  meta_title TEXT NOT NULL DEFAULT 'About — Built for restaurants, by restaurant people',
  meta_description TEXT NOT NULL DEFAULT 'ServeOS was built to give independent restaurants the same tools as the big chains. Our mission, vision, and why we exist.',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_about_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "About settings are publicly readable"
ON public.marketing_about_settings FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Platform admins manage about settings"
ON public.marketing_about_settings FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER update_marketing_about_settings_updated_at
BEFORE UPDATE ON public.marketing_about_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed singleton with current static content
INSERT INTO public.marketing_about_settings (pillars, values_items, story_paragraphs)
VALUES (
  '[
    {"icon":"target","title":"Our mission","body":"Give every restaurant — from the corner trattoria to a 50-location chain — the operating system they deserve. Beautiful, fast, and priced fairly."},
    {"icon":"eye","title":"Our vision","body":"A world where running a restaurant is about food and hospitality, not paperwork and patched-together apps. Where the tech disappears and great service shines."}
  ]'::jsonb,
  '[
    {"icon":"zap","title":"All-in-one","body":"No more juggling QR menu apps, KDS hardware, accounting tools, and POS. One platform, one bill."},
    {"icon":"heart","title":"Made with care","body":"Built by people who have worked the line. Every feature solves a real problem we''ve seen on a busy Saturday."},
    {"icon":"shield","title":"Enterprise-grade","body":"Tenant isolation, audit logs, RLS, and SOC 2-ready architecture. Your data stays yours."},
    {"icon":"users","title":"Fair pricing","body":"Flat monthly fee. No per-order charges. No surprise bills when you have a great month."},
    {"icon":"target","title":"Fast setup","body":"Most restaurants are taking orders within an hour of signing up. No installer required."},
    {"icon":"eye","title":"Transparent","body":"Open about how we build, what we charge, and what''s on the roadmap."}
  ]'::jsonb,
  '[
    "ServeOS started in 2024 when our founder spent six months helping a friend''s bistro untangle their tech stack. They had a tablet for QR menus, a separate KDS, a POS that didn''t talk to anything, and an accountant demanding spreadsheets every week.",
    "We kept asking: why is this so hard? Big chains had it figured out — but their software cost tens of thousands and took months to install. Independent restaurants deserved better.",
    "So we built ServeOS: one platform that handles everything from the customer scan to the closing books, priced for restaurants that actually exist."
  ]'::jsonb
);

-- Allow image uploads to existing platform-assets bucket for about page (already public)
CREATE POLICY "Platform admins upload about images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-assets' AND is_platform_admin());

CREATE POLICY "Platform admins update about images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-assets' AND is_platform_admin());

CREATE POLICY "Platform admins delete about images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'platform-assets' AND is_platform_admin());
