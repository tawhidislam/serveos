-- Single-row config table for the public /demo marketing page
CREATE TABLE IF NOT EXISTS public.demo_page_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hero jsonb NOT NULL DEFAULT '{}'::jsonb,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  embeds jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.demo_page_config ENABLE ROW LEVEL SECURITY;

-- Public read so visitors to /demo see the content
CREATE POLICY "Demo page config readable by all"
  ON public.demo_page_config FOR SELECT
  USING (true);

-- Only platform super-admins can write
CREATE POLICY "Platform admins manage demo page config"
  ON public.demo_page_config FOR ALL
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- updated_at trigger
CREATE TRIGGER trg_demo_page_config_updated_at
  BEFORE UPDATE ON public.demo_page_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a default row with the current hard-coded content
INSERT INTO public.demo_page_config (hero, credentials, features, embeds, cta)
VALUES (
  jsonb_build_object(
    'eyebrow', 'Live product demo',
    'title', 'Inside a live restaurant',
    'description', 'This is a real restaurant in our system. Every number, ticket, and chart below is rendered from the same database your business would use.'
  ),
  jsonb_build_object(
    'heading', 'Sign in as the Bella Cucina demo owner',
    'subheading', 'Use the credentials below to log in and explore every screen — admin dashboard, kitchen display, POS, orders, analytics, settings. It''s a real account on a real restaurant.',
    'email', 'owner@bellacucina.demo',
    'password', 'DemoOwner2025!',
    'primaryCtaLabel', 'Open admin login',
    'primaryCtaHref', '/login',
    'secondaryCtaLabel', 'View guest site',
    'secondaryCtaHref', '/r/demo'
  ),
  '[]'::jsonb,
  jsonb_build_array(
    jsonb_build_object('title','Guest homepage','description','Every restaurant gets a polished, branded public website auto-generated from their settings — hero, story, featured menu, and contact.','iframeSrc','/r/demo','ctaLabel','View Demo','ctaHref','/r/demo','icon','Sparkles','badge','Live'),
    jsonb_build_object('title','Digital menu','description','Customers browse the full menu by category with photos, descriptions, prices, and dietary tags — works on any device, no app required.','iframeSrc','/r/demo/menu','ctaLabel','View Demo','ctaHref','/r/demo/menu','icon','UtensilsCrossed','badge',''),
    jsonb_build_object('title','Gallery page','description','A beautiful image gallery showcasing the restaurant''s ambiance, dishes, and behind-the-scenes moments — drag-and-drop managed by the owner.','iframeSrc','/r/demo/gallery','ctaLabel','View Demo','ctaHref','/r/demo/gallery','icon','Star','badge',''),
    jsonb_build_object('title','Contact & reservations','description','Customers can book a table, get directions, or send a message — all submissions land in the admin dashboard for the team to action.','iframeSrc','/r/demo/contact','ctaLabel','View Demo','ctaHref','/r/demo/contact','icon','ClipboardList','badge','')
  ),
  jsonb_build_object(
    'heading', 'Ready to run your own?',
    'subheading', 'Spin up your restaurant in under 5 minutes. No credit card required.',
    'primaryLabel', 'Start free trial',
    'primaryHref', '/signup',
    'secondaryLabel', 'See pricing',
    'secondaryHref', '/pricing'
  )
)
ON CONFLICT DO NOTHING;