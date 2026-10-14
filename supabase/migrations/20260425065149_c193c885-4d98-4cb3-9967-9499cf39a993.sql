
UPDATE public.marketing_page_sections SET content = '{
  "pillBadge": "New",
  "pillText": "QR ordering + KDS now in one platform",
  "pillHref": "/features",
  "title": "Run a smarter restaurant",
  "titleConnector": "with",
  "titleHighlight": "one connected platform",
  "description": "ServeJoy combines QR ordering, kitchen display, POS, billing and analytics so your team serves faster, your kitchen never misses a ticket, and your owners see every number in real time.",
  "primaryCtaLabel": "Start free trial",
  "primaryCtaHref": "/signup",
  "secondaryCtaLabel": "Book a live demo",
  "secondaryCtaHref": "/demo",
  "trustBadges": ["Setup in under 15 minutes", "No card required", "Cancel anytime"],
  "showAppPreview": true
}'::jsonb WHERE page_key='home' AND section_type='hero';

UPDATE public.marketing_page_sections SET content = '{
  "stats": [
    {"value": "1,200+", "label": "Restaurants served"},
    {"value": "8M+", "label": "Orders processed"},
    {"value": "37%", "label": "Avg. faster table turnover"},
    {"value": "99.98%", "label": "Platform uptime"}
  ],
  "trustHeading": "Trusted by independent cafés, multi-branch chains and cloud kitchens",
  "logos": ["Bistro 21", "Urban Spice", "Daily Grind", "Saffron House", "Pier & Pine", "North Kitchen"]
}'::jsonb WHERE page_key='home' AND section_type='stats_trust';

UPDATE public.marketing_page_sections SET content = '{
  "eyebrow": "Built for modern restaurants",
  "title": "Everything you need to run service",
  "description": "From the moment a guest scans a QR code to the moment your accountant closes the books, ServeJoy keeps every step in sync.",
  "qrTitle": "Contactless QR ordering",
  "qrDescription": "Guests browse your live menu, customize items, pay or open a tab — all from their phone, no app install required.",
  "kdsTitle": "Real-time kitchen display",
  "kdsDescription": "Tickets stream to the KDS the second they’re placed, with audio alerts, course timing, and one-tap mark-ready for waiters.",
  "analyticsTitle": "Owner analytics",
  "analyticsDescription": "Live revenue, top items, peak hours and staff performance — across every branch, on any device.",
  "billingTitle": "Integrated POS & billing",
  "billingDescription": "Split bills, merge tabs, accept cash or card, and print thermal receipts without leaving the order screen."
}'::jsonb WHERE page_key='home' AND section_type='bento_features';

UPDATE public.marketing_page_sections SET content = '{
  "items": [
    {"icon": "QrCode", "title": "QR menus", "description": "Branded, multi-language menus that update the moment you change a price or 86 an item."},
    {"icon": "ChefHat", "title": "Kitchen display", "description": "Color-coded tickets, prep timers and audio cues keep the line moving during the rush."},
    {"icon": "Receipt", "title": "POS & invoicing", "description": "Take dine-in, takeaway and pay-later orders with itemized invoices and tax handling."},
    {"icon": "BarChart3", "title": "Analytics", "description": "Drill into sales by hour, item, category, waiter or branch — exportable in one click."},
    {"icon": "Users", "title": "Staff & roles", "description": "Granular permissions for managers, waiters, kitchen and accountants with full audit trail."},
    {"icon": "Gift", "title": "Promotions & loyalty", "description": "Run promo codes, happy hours and points-based loyalty without a third-party tool."}
  ],
  "ctaLabel": "Explore all features",
  "ctaHref": "/features"
}'::jsonb WHERE page_key='home' AND section_type='feature_grid';

UPDATE public.marketing_page_sections SET content = '{
  "eyebrow": "How it works",
  "title": "Live in three steps",
  "description": "Most restaurants are taking real orders the same day they sign up.",
  "steps": [
    {"number": "01", "icon": "Smartphone", "title": "Add your menu", "description": "Import items, set prices and tax, and upload photos — or let our AI generate them for you."},
    {"number": "02", "icon": "QrCode", "title": "Print your QR codes", "description": "Generate branded table QR codes and floor-plan signage in seconds, ready for the printer."},
    {"number": "03", "icon": "TrendingUp", "title": "Serve and grow", "description": "Watch orders flow to the kitchen in real time, and track every metric from the owner dashboard."}
  ]
}'::jsonb WHERE page_key='home' AND section_type='how_it_works';

UPDATE public.marketing_page_sections SET content = '{
  "eyebrow": "Loved by restaurant teams",
  "title": "Owners and operators choose ServeJoy",
  "items": [
    {"name": "Aisha Rahman", "role": "Owner, Saffron House", "quote": "We cut order errors to almost zero in the first week. The kitchen team finally has a single source of truth."},
    {"name": "Marco Lenzi", "role": "GM, Bistro 21", "quote": "Setup took an afternoon. By dinner service we were taking QR orders and the waiters were free to actually talk to guests."},
    {"name": "Priya Shah", "role": "Founder, Daily Grind (3 branches)", "quote": "Seeing live revenue across all three locations on one screen has been a game changer for how we plan staffing."}
  ]
}'::jsonb WHERE page_key='home' AND section_type='testimonials';

UPDATE public.marketing_page_sections SET content = '{
  "eyebrow": "Pricing",
  "title": "Simple plans that scale with you",
  "description": "Start free, upgrade when you’re ready. Every plan includes QR ordering, KDS, POS, analytics and unlimited menu items.",
  "compareLabel": "Compare all plans",
  "compareHref": "/pricing"
}'::jsonb WHERE page_key='home' AND section_type='pricing_preview';

UPDATE public.marketing_page_sections SET content = '{
  "title": "Ready to give your restaurant an upgrade?",
  "description": "Join hundreds of restaurants running faster service, cleaner kitchens and clearer numbers with ServeJoy.",
  "primaryCtaLabel": "Start free trial",
  "primaryCtaHref": "/signup",
  "secondaryCtaLabel": "Talk to sales",
  "secondaryCtaHref": "/contact",
  "trustBadges": ["No credit card required", "Free onboarding & menu import", "Cancel anytime"]
}'::jsonb WHERE page_key='home' AND section_type='cta_banner';
