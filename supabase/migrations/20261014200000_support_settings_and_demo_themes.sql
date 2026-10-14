BEGIN;
-- Restore the singleton removed by the full reset; keep live chat off until configured.
INSERT INTO public.support_settings(id, widget_enabled, timezone) VALUES (true, false, 'Asia/Shanghai') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.platform_themes (key, name, description, sort_order, is_active, tokens) VALUES
('demo-saffron-kitchen', 'Saffron Kitchen', 'Sunlit ivory and saffron tones for regional restaurants, family dining and flavorful menus.', 90, true, '{"colors":{"bg_primary":"#FFF7E5","bg_secondary":"#F3E2B7","accent":"#B65C13","accent_light":"#E4B157","text_primary":"#3A2B16","text_muted":"#857352","nav_bg":"#FFF7E5","nav_text":"#3A2B16","nav_accent":"#B65C13"},"fonts":{"heading_family":"Georgia, serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"0.75rem","button_style":"solid","homepage_template":"bistro"}'::jsonb),
('demo-rose-garden', 'Rose Garden', 'Soft blush and deep rose for bakeries, tea rooms and relaxed celebrations.', 100, true, '{"colors":{"bg_primary":"#FFF3F5","bg_secondary":"#F3DBE1","accent":"#9D385C","accent_light":"#DFA6B7","text_primary":"#4B2933","text_muted":"#8E6974","nav_bg":"#FFF3F5","nav_text":"#4B2933","nav_accent":"#9D385C"},"fonts":{"heading_family":"Palatino Linotype, Palatino, serif","body_family":"Arial, sans-serif","google_fonts":[]},"radius":"1.25rem","button_style":"pill","homepage_template":"cafe"}'::jsonb)
ON CONFLICT (key) DO NOTHING;
COMMIT;
