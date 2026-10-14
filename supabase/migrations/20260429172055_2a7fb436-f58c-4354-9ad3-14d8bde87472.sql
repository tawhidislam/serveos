INSERT INTO public.marketing_page_sections (page_key, section_type, sort_order, content) VALUES
('home', 'hero', 10, '{
  "pillBadge": "New",
  "pillText": "AI menu photography is here",
  "pillHref": "/features",
  "title": "The operating system",
  "titleHighlight": "modern restaurants",
  "titleConnector": "for",
  "description": "From QR ordering to kitchen tickets to financial reports — run every shift on one calm, fast platform your team will actually love.",
  "primaryCtaLabel": "Get started",
  "primaryCtaHref": "/signup",
  "secondaryCtaLabel": "Live demo",
  "secondaryCtaHref": "/demo",
  "trustBadges": ["Setup in under 15 minutes", "No card required", "Cancel anytime"],
  "showAppPreview": true
}'::jsonb),
('home', 'stats_trust', 20, '{
  "stats": [
    {"value": "500+", "label": "Restaurants"},
    {"value": "2.4M", "label": "Orders processed"},
    {"value": "34%", "label": "Faster table turn"},
    {"value": "99.9%", "label": "Uptime SLA"}
  ],
  "trustHeading": "Trusted by independent cafés, multi-branch chains and cloud kitchens",
  "logos": ["Bistro 21", "Urban Spice", "Daily Grind", "Saffron House", "Pier & Pine", "North Kitchen"]
}'::jsonb),
('home', 'bento_features', 30, '{
  "eyebrow": "Platform",
  "title": "Everything you need. Nothing you don''t.",
  "description": "One platform replaces five different apps — ordering, kitchen, billing, analytics, and team management.",
  "qrTitle": "QR ordering, in seconds",
  "qrDescription": "Each table gets a branded QR code. Guests scan, browse photos, customize, and pay — without ever waiting on a waiter.",
  "kdsTitle": "Kitchen display",
  "kdsDescription": "Live tickets with audio alerts. Bump orders with one tap. No paper, no errors.",
  "analyticsTitle": "Live analytics",
  "analyticsDescription": "Revenue, top items, server performance — updated in real time.",
  "billingTitle": "Integrated POS & billing",
  "billingDescription": "Split bills, merge tabs, accept cash or card, and print thermal receipts without leaving the order screen."
}'::jsonb),
('home', 'feature_grid', 40, '{
  "items": [
    {"icon": "BarChart3", "title": "Analytics & Reports", "description": "Real-time revenue, top items, server performance, and accounting-grade financial reports."},
    {"icon": "ClipboardList", "title": "Menu Management", "description": "Update menus instantly across every QR code, every device. AI-powered food photography included."},
    {"icon": "Users", "title": "Staff & Branches", "description": "Role-based access for kitchen, waiters, managers — plus full multi-branch support."}
  ],
  "ctaLabel": "Explore all features",
  "ctaHref": "/features"
}'::jsonb),
('home', 'how_it_works', 50, '{
  "eyebrow": "How it works",
  "title": "From scan to served, in three steps",
  "description": "Setup takes an afternoon. Your team is up and running by dinner service.",
  "steps": [
    {"number": "01", "icon": "Smartphone", "title": "Customer scans QR", "description": "Each table has a unique QR code that opens your branded menu instantly."},
    {"number": "02", "icon": "ChefHat", "title": "Order hits the kitchen", "description": "Tickets appear on the KDS in real time with audio alerts."},
    {"number": "03", "icon": "TrendingUp", "title": "Serve and grow", "description": "Watch orders flow to the kitchen in real time, and track every metric from the owner dashboard."}
  ]
}'::jsonb),
('home', 'testimonials', 60, '{
  "eyebrow": "Loved by operators",
  "title": "What restaurant owners are saying",
  "items": [
    {"name": "Sara Maleki", "role": "Owner, Bistro Olive", "quote": "We cut order errors by 80% in our first month. The kitchen display alone paid for the whole subscription."},
    {"name": "Marco Rossi", "role": "Manager, Trattoria Sole", "quote": "Setup took an afternoon. Our waiters now handle 30% more tables thanks to QR ordering."},
    {"name": "Priya Shah", "role": "Founder, Daily Grind (3 branches)", "quote": "Seeing live revenue across all three locations on one screen has been a game changer for how we plan staffing."}
  ]
}'::jsonb),
('home', 'pricing_preview', 70, '{
  "eyebrow": "Simple pricing",
  "title": "Plans that grow with you",
  "description": "Start free, upgrade when you need more. No hidden fees, no per-order charges.",
  "compareLabel": "Compare all plans",
  "compareHref": "/pricing"
}'::jsonb),
('home', 'cta_banner', 80, '{
  "title": "Ready to upgrade your restaurant?",
  "description": "Join hundreds of restaurants running smoother shifts with ServeOS.",
  "primaryCtaLabel": "Get started",
  "primaryCtaHref": "/signup",
  "secondaryCtaLabel": "Talk to sales",
  "secondaryCtaHref": "/contact",
  "trustBadges": ["No credit card required", "Free onboarding & menu import", "Cancel anytime"]
}'::jsonb)
ON CONFLICT DO NOTHING;