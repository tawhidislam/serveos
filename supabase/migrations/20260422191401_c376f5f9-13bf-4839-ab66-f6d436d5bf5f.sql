-- Platform-managed theme presets that the SaaS admin can assign per restaurant.
-- A theme is a "full visual kit": colors, fonts, radius, button style, and a
-- default homepage template. Restaurants opt into a theme via restaurants.theme_id.

CREATE TABLE public.platform_themes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key           text NOT NULL UNIQUE,
  name          text NOT NULL,
  description   text,
  preview_image text,
  -- Full visual kit, stored as JSONB so we can evolve without migrations.
  -- Expected shape:
  -- {
  --   colors: { bg_primary, bg_secondary, accent, accent_light, text_primary, text_muted, nav_bg, nav_text, nav_accent },
  --   fonts:  { heading_family, body_family, google_fonts: ["Family:wght@400;700", ...] },
  --   radius: "0.5rem",
  --   button_style: "solid" | "outline" | "pill" | "sharp",
  --   homepage_template: "classic" | "modern" | "bistro" | "elegant" | "cafe" | "minimal" | "default"
  -- }
  tokens        jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active     boolean NOT NULL DEFAULT true,
  sort_order    integer NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_themes ENABLE ROW LEVEL SECURITY;

-- Anyone (anon + authenticated) can read active themes (public website needs them).
CREATE POLICY "Active themes readable by everyone"
  ON public.platform_themes
  FOR SELECT
  USING (is_active = true);

-- Platform admins can read every theme (active + inactive) and manage them.
CREATE POLICY "Platform admins manage all themes"
  ON public.platform_themes
  FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_platform_themes_updated_at
  BEFORE UPDATE ON public.platform_themes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Restaurant -> theme link (nullable: tenant can be unthemed and fall back to defaults).
ALTER TABLE public.restaurants
  ADD COLUMN theme_id uuid REFERENCES public.platform_themes(id) ON DELETE SET NULL;

CREATE INDEX idx_restaurants_theme_id ON public.restaurants(theme_id);

-- Seed 6 starter presets covering distinct moods.
INSERT INTO public.platform_themes (key, name, description, sort_order, tokens) VALUES
('midnight-amber', 'Midnight Amber', 'Pure black with warm amber accents. Premium steakhouse / lounge vibe.', 10, '{
  "colors": {
    "bg_primary": "#0A0A0A", "bg_secondary": "#141414",
    "accent": "#F59E0B", "accent_light": "#FCD34D",
    "text_primary": "#FAFAF9", "text_muted": "rgba(250,250,249,0.6)",
    "nav_bg": "rgba(0,0,0,0.7)", "nav_text": "#FAFAF9", "nav_accent": "#F59E0B"
  },
  "fonts": { "heading_family": "Playfair Display, serif", "body_family": "Inter, sans-serif",
             "google_fonts": ["Playfair+Display:wght@400;600;700", "Inter:wght@400;500;600;700"] },
  "radius": "0.5rem", "button_style": "solid", "homepage_template": "classic"
}'::jsonb),

('emerald-grove', 'Emerald Grove', 'Forest green with cream highlights. Botanical, garden-to-table feel.', 20, '{
  "colors": {
    "bg_primary": "#0E1F17", "bg_secondary": "#15291F",
    "accent": "#10B981", "accent_light": "#6EE7B7",
    "text_primary": "#F5F1E8", "text_muted": "rgba(245,241,232,0.65)",
    "nav_bg": "rgba(14,31,23,0.85)", "nav_text": "#F5F1E8", "nav_accent": "#6EE7B7"
  },
  "fonts": { "heading_family": "Cormorant Garamond, serif", "body_family": "Lato, sans-serif",
             "google_fonts": ["Cormorant+Garamond:wght@400;500;700", "Lato:wght@400;700"] },
  "radius": "0.25rem", "button_style": "outline", "homepage_template": "elegant"
}'::jsonb),

('sunset-coral', 'Sunset Coral', 'Warm coral and peach palette. Bright, casual, mediterranean.', 30, '{
  "colors": {
    "bg_primary": "#FFF7F2", "bg_secondary": "#FFE8DA",
    "accent": "#F97316", "accent_light": "#FDBA74",
    "text_primary": "#3F1D0E", "text_muted": "rgba(63,29,14,0.65)",
    "nav_bg": "rgba(255,247,242,0.9)", "nav_text": "#3F1D0E", "nav_accent": "#F97316"
  },
  "fonts": { "heading_family": "Fraunces, serif", "body_family": "Nunito, sans-serif",
             "google_fonts": ["Fraunces:wght@400;600;800", "Nunito:wght@400;600;800"] },
  "radius": "1rem", "button_style": "pill", "homepage_template": "cafe"
}'::jsonb),

('royal-sapphire', 'Royal Sapphire', 'Deep navy with gold accents. Refined, fine-dining.', 40, '{
  "colors": {
    "bg_primary": "#0B1437", "bg_secondary": "#121E4A",
    "accent": "#D4AF37", "accent_light": "#F0D77A",
    "text_primary": "#F8F4E3", "text_muted": "rgba(248,244,227,0.65)",
    "nav_bg": "rgba(11,20,55,0.85)", "nav_text": "#F8F4E3", "nav_accent": "#D4AF37"
  },
  "fonts": { "heading_family": "Cinzel, serif", "body_family": "Lora, serif",
             "google_fonts": ["Cinzel:wght@400;600;800", "Lora:wght@400;500;700"] },
  "radius": "0.125rem", "button_style": "sharp", "homepage_template": "elegant"
}'::jsonb),

('minimal-mono', 'Minimal Mono', 'Clean white + ink. Editorial, modern, no-nonsense.', 50, '{
  "colors": {
    "bg_primary": "#FFFFFF", "bg_secondary": "#F4F4F5",
    "accent": "#111111", "accent_light": "#525252",
    "text_primary": "#0A0A0A", "text_muted": "rgba(10,10,10,0.6)",
    "nav_bg": "rgba(255,255,255,0.9)", "nav_text": "#0A0A0A", "nav_accent": "#111111"
  },
  "fonts": { "heading_family": "Space Grotesk, sans-serif", "body_family": "Inter, sans-serif",
             "google_fonts": ["Space+Grotesk:wght@400;500;700", "Inter:wght@400;500;700"] },
  "radius": "0", "button_style": "sharp", "homepage_template": "minimal"
}'::jsonb),

('rustic-terracotta', 'Rustic Terracotta', 'Earthy clay and cream. Trattoria, wood-fired, hand-made.', 60, '{
  "colors": {
    "bg_primary": "#1F1410", "bg_secondary": "#2B1C16",
    "accent": "#C2410C", "accent_light": "#FB923C",
    "text_primary": "#F5E6D3", "text_muted": "rgba(245,230,211,0.65)",
    "nav_bg": "rgba(31,20,16,0.85)", "nav_text": "#F5E6D3", "nav_accent": "#FB923C"
  },
  "fonts": { "heading_family": "DM Serif Display, serif", "body_family": "Karla, sans-serif",
             "google_fonts": ["DM+Serif+Display:wght@400", "Karla:wght@400;500;700"] },
  "radius": "0.75rem", "button_style": "solid", "homepage_template": "bistro"
}'::jsonb);
