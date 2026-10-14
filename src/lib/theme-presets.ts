import type { ThemeColors, ThemeTokens } from '@/hooks/usePlatformThemes';

export const THEME_TEMPLATES = ['classic', 'modern', 'bistro', 'elegant', 'cafe', 'minimal', 'default', 'grand'] as const;
export const THEME_FONTS = [
  { label: 'Clean sans serif', family: 'Arial, sans-serif' },
  { label: 'Classic serif', family: 'Georgia, serif' },
  { label: 'Elegant serif', family: 'Palatino Linotype, Palatino, serif' },
  { label: 'Friendly sans serif', family: 'Trebuchet MS, sans-serif' },
  { label: 'Inter', family: 'Inter, sans-serif', google: 'Inter:wght@400;500;600;700' },
  { label: 'Playfair Display', family: 'Playfair Display, serif', google: 'Playfair+Display:wght@400;600;700' },
];
export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  colors: { bg_primary: '#FAF7F2', bg_secondary: '#F0E9DE', accent: '#9C4F2E', accent_light: '#E2B99C', text_primary: '#28231D', text_muted: '#71685F', nav_bg: '#FAF7F2', nav_text: '#28231D', nav_accent: '#9C4F2E' },
  fonts: { heading_family: 'Georgia, serif', body_family: 'Arial, sans-serif', google_fonts: [] },
  radius: '0.75rem', button_style: 'solid', homepage_template: 'cafe',
};

export function normalizeThemeTokens(tokens?: ThemeTokens): ThemeTokens {
  return { ...DEFAULT_THEME_TOKENS, ...tokens, colors: { ...DEFAULT_THEME_TOKENS.colors, ...tokens?.colors }, fonts: { ...DEFAULT_THEME_TOKENS.fonts, ...tokens?.fonts } };
}

/** Pick a readable foreground for the sample CTA's solid accent color. */
export function accentForeground(hex: string): string {
  const expanded = /^#[a-f0-9]{3}$/i.test(hex) ? '#' + hex.slice(1).split('').map(char => char + char).join('') : hex;
  const match = /^#([a-f0-9]{6})$/i.exec(expanded);
  if (!match) return '#FFFFFF';
  const r = parseInt(match[1].slice(0, 2), 16), g = parseInt(match[1].slice(2, 4), 16), b = parseInt(match[1].slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#171717' : '#FFFFFF';
}

const preset = (key: string, name: string, description: string, template: string, colors: ThemeColors, heading: string, radius: string, button: ThemeTokens['button_style']) => ({
  key, name, description, tokens: { colors, fonts: { heading_family: heading, body_family: 'Arial, sans-serif', google_fonts: [] }, radius, button_style: button, homepage_template: template },
});
export const DEMO_THEMES = [
  preset('demo-midnight-amber', 'Midnight Amber', 'Warm gold on charcoal. Made for steakhouses, lounges and evening dining.', 'classic', { bg_primary: '#141210', bg_secondary: '#24201B', accent: '#E9B868', accent_light: '#F5D8A8', text_primary: '#F8F2E8', text_muted: '#B8ADA0', nav_bg: '#141210', nav_text: '#F8F2E8', nav_accent: '#E9B868' }, 'Georgia, serif', '0.5rem', 'solid'),
  preset('demo-garden-bistro', 'Garden Bistro', 'Forest green and cream for garden cafés and fresh, seasonal menus.', 'bistro', { bg_primary: '#132D23', bg_secondary: '#204334', accent: '#D7DEAE', accent_light: '#EFF2D8', text_primary: '#F4F3E7', text_muted: '#BACCBF', nav_bg: '#132D23', nav_text: '#F4F3E7', nav_accent: '#D7DEAE' }, 'Georgia, serif', '0.75rem', 'outline'),
  preset('demo-terracotta-cafe', 'Terracotta Café', 'Soft peach and terracotta for neighborhood cafés, bakeries and brunch.', 'cafe', { bg_primary: '#FFF5EC', bg_secondary: '#F2DFCE', accent: '#A44729', accent_light: '#DEA684', text_primary: '#40261E', text_muted: '#8B6D5F', nav_bg: '#FFF5EC', nav_text: '#40261E', nav_accent: '#A44729' }, 'Trebuchet MS, sans-serif', '1.25rem', 'pill'),
  preset('demo-coastal-blue', 'Coastal Blue', 'Deep blue and fresh aqua for seafood restaurants and relaxed coastal dining.', 'modern', { bg_primary: '#102C3B', bg_secondary: '#1C4255', accent: '#7DD8D0', accent_light: '#BFEDE8', text_primary: '#F1FAFC', text_muted: '#ABC4CE', nav_bg: '#102C3B', nav_text: '#F1FAFC', nav_accent: '#7DD8D0' }, 'Trebuchet MS, sans-serif', '0.75rem', 'pill'),
  preset('demo-ivory-minimal', 'Ivory Minimal', 'An airy, understated look for modern restaurants and simple, focused menus.', 'minimal', { bg_primary: '#FAFAF7', bg_secondary: '#EBECE6', accent: '#313D32', accent_light: '#A6B59D', text_primary: '#202720', text_muted: '#757D73', nav_bg: '#FAFAF7', nav_text: '#202720', nav_accent: '#313D32' }, 'Arial, sans-serif', '0.25rem', 'sharp'),
  preset('demo-royal-plum', 'Royal Plum', 'Rich plum and champagne accents for fine dining and special occasions.', 'elegant', { bg_primary: '#291B2C', bg_secondary: '#3D2B42', accent: '#E8C9AB', accent_light: '#F6E4D2', text_primary: '#FCF5EF', text_muted: '#C8B4C6', nav_bg: '#291B2C', nav_text: '#FCF5EF', nav_accent: '#E8C9AB' }, 'Palatino Linotype, Palatino, serif', '0.25rem', 'outline'),
  preset('demo-warm-sand', 'Warm Sand', 'Soft sand and caramel for bakeries, breakfast spots and cozy neighborhood cafés.', 'cafe', { bg_primary: '#F8F2E9', bg_secondary: '#EDE0CF', accent: '#936634', accent_light: '#D8BA91', text_primary: '#35281D', text_muted: '#7E6E5C', nav_bg: '#F8F2E9', nav_text: '#35281D', nav_accent: '#936634' }, 'Georgia, serif', '0.75rem', 'solid'),
  preset('demo-urban-slate', 'Urban Slate', 'Graphite and cool blue for modern eateries, food halls and quick-service restaurants.', 'modern', { bg_primary: '#18202A', bg_secondary: '#253241', accent: '#8CBDE5', accent_light: '#BDD8EF', text_primary: '#F5F8FC', text_muted: '#A7B8CB', nav_bg: '#18202A', nav_text: '#F5F8FC', nav_accent: '#8CBDE5' }, 'Arial, sans-serif', '0.25rem', 'sharp'),
  preset('demo-saffron-kitchen', 'Saffron Kitchen', 'Sunlit ivory and saffron tones for regional restaurants, family dining and flavorful menus.', 'bistro', { bg_primary: '#FFF7E5', bg_secondary: '#F3E2B7', accent: '#B65C13', accent_light: '#E4B157', text_primary: '#3A2B16', text_muted: '#857352', nav_bg: '#FFF7E5', nav_text: '#3A2B16', nav_accent: '#B65C13' }, 'Georgia, serif', '0.75rem', 'solid'),
  preset('demo-rose-garden', 'Rose Garden', 'Soft blush and deep rose for bakeries, tea rooms and relaxed celebrations.', 'cafe', { bg_primary: '#FFF3F5', bg_secondary: '#F3DBE1', accent: '#9D385C', accent_light: '#DFA6B7', text_primary: '#4B2933', text_muted: '#8E6974', nav_bg: '#FFF3F5', nav_text: '#4B2933', nav_accent: '#9D385C' }, 'Palatino Linotype, Palatino, serif', '1.25rem', 'pill'),
];
