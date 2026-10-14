-- Marketing home page: the live page now renders these rows (it was
-- hard-coded before). Clean up claims that aren't true or can't be verified,
-- and add the new FAQ and live-demo sections.

-- 1. Hide unverified social proof (stats, customer logos, named testimonials).
--    Content is kept so it can be replaced with real data and re-enabled in
--    Platform → Marketing Home.
UPDATE public.marketing_page_sections
SET is_enabled = false
WHERE page_key = 'home' AND section_type IN ('stats_trust', 'testimonials');

-- 2. Hero: there is no AI menu photography feature and no free tier.
UPDATE public.marketing_page_sections
SET content = jsonb_set(content, '{pillText}', '"Kitchen display, POS & analytics in one place"')
WHERE page_key = 'home' AND section_type = 'hero'
  AND content->>'pillText' = 'AI menu photography is here';

UPDATE public.marketing_page_sections
SET content = jsonb_set(
  content, '{trustBadges}',
  COALESCE((
    SELECT jsonb_agg(b)
    FROM jsonb_array_elements(content->'trustBadges') b
    WHERE b #>> '{}' NOT IN ('No card required', 'No credit card required')
  ), '[]'::jsonb)
)
WHERE page_key = 'home' AND section_type = 'hero' AND jsonb_typeof(content->'trustBadges') = 'array';

-- 3. CTA banner: no "hundreds of restaurants" claim, no free tier / free onboarding.
UPDATE public.marketing_page_sections
SET content = jsonb_set(content, '{description}', '"Set up your restaurant and take your first QR order today."')
WHERE page_key = 'home' AND section_type = 'cta_banner'
  AND content->>'description' ILIKE 'Join hundreds%';

UPDATE public.marketing_page_sections
SET content = jsonb_set(
  content, '{trustBadges}',
  COALESCE((
    SELECT jsonb_agg(b)
    FROM jsonb_array_elements(content->'trustBadges') b
    WHERE b #>> '{}' NOT IN ('No credit card required', 'No card required', 'Free onboarding & menu import')
  ), '[]'::jsonb)
)
WHERE page_key = 'home' AND section_type = 'cta_banner' AND jsonb_typeof(content->'trustBadges') = 'array';

-- 4. New sections (only if the page doesn't have them yet).
INSERT INTO public.marketing_page_sections (page_key, section_type, sort_order, is_enabled, content)
SELECT 'home', 'live_demo', 55, true, jsonb_build_object(
  'eyebrow', 'Live demo',
  'title', 'Try a real restaurant — no signup',
  'description', 'Open the demo restaurant and switch between owner, kitchen, waiter and guest views. Place an order as a guest and watch it reach the kitchen.',
  'ctaLabel', 'Open the live demo',
  'ctaHref', '/demo',
  'points', jsonb_build_array('Owner & admin dashboards', 'Live kitchen display', 'QR ordering as a guest')
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_page_sections WHERE page_key = 'home' AND section_type = 'live_demo'
);

INSERT INTO public.marketing_page_sections (page_key, section_type, sort_order, is_enabled, content)
SELECT 'home', 'faq', 75, true, jsonb_build_object(
  'eyebrow', 'FAQ',
  'title', 'Questions, answered',
  'items', jsonb_build_array(
    jsonb_build_object('question', 'Do my guests need to download an app?',
      'answer', 'No. Guests scan the table QR code with their phone camera and order from a web menu in the browser.'),
    jsonb_build_object('question', 'How do I pay for my subscription?',
      'answer', 'Pay with bKash, Nagad or Rocket from your billing page. Your plan is activated once the payment is confirmed.'),
    jsonb_build_object('question', 'What plans are available?',
      'answer', 'Packages run for 1, 3, 6 or 12 months. Longer packages cost less per month. You can see each package’s length and price on the pricing page.'),
    jsonb_build_object('question', 'Can orders print automatically in the kitchen?',
      'answer', 'Yes. A small print agent on a computer at your restaurant prints new orders and receipts to your printer without anyone clicking print.'),
    jsonb_build_object('question', 'Can I use my own domain?',
      'answer', 'Every restaurant gets its own subdomain for its website and menu. You can also connect your own domain on plans that include custom domains.'),
    jsonb_build_object('question', 'Can each staff member have their own login?',
      'answer', 'Yes. Owners, admins, managers, kitchen staff and waiters each get their own login and only see what their role needs.'),
    jsonb_build_object('question', 'Is my restaurant’s data private?',
      'answer', 'Yes. Each restaurant’s menu, orders and customers are kept separate at the database level, so other restaurants can never see them.')
  )
)
WHERE NOT EXISTS (
  SELECT 1 FROM public.marketing_page_sections WHERE page_key = 'home' AND section_type = 'faq'
);

-- 5. Other saved copy that claims features or terms that don't exist.
UPDATE public.marketing_page_sections
SET content = jsonb_set(content, '{description}', '"Pick the package that fits your restaurant. No hidden fees, no per-order charges."')
WHERE page_key = 'home' AND section_type = 'pricing_preview'
  AND content->>'description' ILIKE 'Start free%';

UPDATE public.marketing_page_sections
SET content = jsonb_set(
  content, '{items}',
  (
    SELECT jsonb_agg(
      CASE WHEN i->>'description' LIKE '%AI-powered food photography included.%'
        THEN jsonb_set(i, '{description}', to_jsonb(trim(replace(i->>'description', 'AI-powered food photography included.', ''))))
        ELSE i END
      ORDER BY n)
    FROM jsonb_array_elements(content->'items') WITH ORDINALITY AS t(i, n)
  )
)
WHERE page_key = 'home' AND section_type = 'feature_grid' AND jsonb_typeof(content->'items') = 'array';
