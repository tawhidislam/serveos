-- Starter styles. Preserve any existing themes with these identifiers.
BEGIN;
GRANT SELECT ON public.platform_themes TO anon, authenticated;
-- Existing RLS permits writes only for is_platform_admin().
GRANT INSERT, UPDATE, DELETE ON public.platform_themes TO authenticated;
INSERT INTO public.platform_themes (key, name, description, sort_order, is_active, tokens) VALUES
('demo-midnight-amber', 'Midnight Amber', 'Warm gold on charcoal. Made for steakhouses, lounges and evening dining.', 10, true, '{"colors":{"bg_primary":"#141210","bg_secondary":"#24201B","accent":"#E9B868","accent_light":"#F5D8A8","text_primary":"#F8F2E8","text_muted":"#B8ADA0","nav_bg":"#141210","nav_text":"#F8F2E8","nav_accent":"#E9B868"},"fonts":{"heading_family":"Georgia, serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.5rem","button_style":"solid","homepage_template":"classic"}'::jsonb),
('demo-garden-bistro', 'Garden Bistro', 'Forest green and cream for garden cafés and fresh, seasonal menus.', 20, true, '{"colors":{"bg_primary":"#132D23","bg_secondary":"#204334","accent":"#D7DEAE","accent_light":"#EFF2D8","text_primary":"#F4F3E7","text_muted":"#BACCBF","nav_bg":"#132D23","nav_text":"#F4F3E7","nav_accent":"#D7DEAE"},"fonts":{"heading_family":"Georgia, serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.75rem","button_style":"outline","homepage_template":"bistro"}'::jsonb),
('demo-terracotta-cafe', 'Terracotta Café', 'Soft peach and terracotta for neighborhood cafés, bakeries and brunch.', 30, true, '{"colors":{"bg_primary":"#FFF5EC","bg_secondary":"#F2DFCE","accent":"#A44729","accent_light":"#DEA684","text_primary":"#40261E","text_muted":"#8B6D5F","nav_bg":"#FFF5EC","nav_text":"#40261E","nav_accent":"#A44729"},"fonts":{"heading_family":"Trebuchet MS, sans-serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"1.25rem","button_style":"pill","homepage_template":"cafe"}'::jsonb),
('demo-coastal-blue', 'Coastal Blue', 'Deep blue and fresh aqua for seafood restaurants and relaxed coastal dining.', 40, true, '{"colors":{"bg_primary":"#102C3B","bg_secondary":"#1C4255","accent":"#7DD8D0","accent_light":"#BFEDE8","text_primary":"#F1FAFC","text_muted":"#ABC4CE","nav_bg":"#102C3B","nav_text":"#F1FAFC","nav_accent":"#7DD8D0"},"fonts":{"heading_family":"Trebuchet MS, sans-serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.75rem","button_style":"pill","homepage_template":"modern"}'::jsonb),
('demo-ivory-minimal', 'Ivory Minimal', 'An airy, understated look for modern restaurants and simple, focused menus.', 50, true, '{"colors":{"bg_primary":"#FAFAF7","bg_secondary":"#EBECE6","accent":"#313D32","accent_light":"#A6B59D","text_primary":"#202720","text_muted":"#757D73","nav_bg":"#FAFAF7","nav_text":"#202720","nav_accent":"#313D32"},"fonts":{"heading_family":"Arial, sans-serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.25rem","button_style":"sharp","homepage_template":"minimal"}'::jsonb),
('demo-royal-plum', 'Royal Plum', 'Rich plum and champagne accents for fine dining and special occasions.', 60, true, '{"colors":{"bg_primary":"#291B2C","bg_secondary":"#3D2B42","accent":"#E8C9AB","accent_light":"#F6E4D2","text_primary":"#FCF5EF","text_muted":"#C8B4C6","nav_bg":"#291B2C","nav_text":"#FCF5EF","nav_accent":"#E8C9AB"},"fonts":{"heading_family":"Palatino Linotype, Palatino, serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.25rem","button_style":"outline","homepage_template":"elegant"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
-- Public theme resolution is scoped by the URL's restaurant. Keep inactive
-- themes readable when already assigned, while hiding them from new choices.
GRANT SELECT ON public.restaurants TO anon;
CREATE POLICY "Assigned themes readable for active restaurants" ON public.platform_themes
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.restaurants r WHERE r.theme_id = platform_themes.id AND r.is_active)
);
COMMIT;
