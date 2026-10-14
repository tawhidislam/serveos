
CREATE TABLE public.homepage_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

-- Everyone can read homepage content
CREATE POLICY "Homepage content viewable by all"
  ON public.homepage_content FOR SELECT TO public
  USING (true);

-- Only admins can edit
CREATE POLICY "Admin can manage homepage content"
  ON public.homepage_content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Managers too
CREATE POLICY "Manager can manage homepage content"
  ON public.homepage_content FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Seed default content
INSERT INTO public.homepage_content (section_key, content) VALUES
('hero', '{
  "overline": "Award-Winning Dining",
  "heading_line1": "Elevate Your",
  "heading_line2": "Dining Experience",
  "description": "Where culinary artistry meets modern elegance. Every dish crafted to perfection with the finest ingredients.",
  "cta_primary_text": "View Menu",
  "cta_primary_link": "/menu",
  "cta_secondary_text": "Our Story",
  "cta_secondary_link": "/about",
  "show_rating": true,
  "show_stats": true
}'::jsonb),
('stats', '{
  "items": [
    {"value": "4.9", "label": "Google Rating", "icon": "★"},
    {"value": "10K+", "label": "Happy Guests", "icon": "♥"},
    {"value": "2020", "label": "Established", "icon": "◆"},
    {"value": "50+", "label": "Signature Dishes", "icon": "✦"}
  ]
}'::jsonb),
('story', '{
  "overline": "Our Story",
  "heading_line1": "A Legacy of",
  "heading_line2": "Culinary Excellence",
  "paragraph1": "Founded with a vision to redefine dining, our restaurant brings together the world''s finest ingredients with innovative technique and timeless tradition.",
  "paragraph2": "Every dish is a masterpiece — thoughtfully composed, beautifully presented, and crafted to create moments that linger long after the last bite.",
  "cta_text": "Learn More",
  "cta_link": "/about",
  "badge_value": "5+",
  "badge_label": "Years"
}'::jsonb),
('cta', '{
  "overline": "Reserve Your Table",
  "heading_line1": "Ready for an",
  "heading_line2": "Unforgettable Evening?",
  "description": "Browse our menu and place your order online for an unforgettable dine-in or takeout experience.",
  "cta_primary_text": "Order Online",
  "cta_primary_link": "/menu",
  "cta_secondary_text": "Find Us",
  "cta_secondary_link": "/contact"
}'::jsonb);
