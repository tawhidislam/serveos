import { expect, it } from 'vitest';
import { accentForeground, DEMO_THEMES, normalizeThemeTokens, THEME_TEMPLATES } from '@/lib/theme-presets';

it('provides ten distinct demo styles using supported homepage layouts', () => {
  expect(DEMO_THEMES).toHaveLength(10);
  expect(new Set(DEMO_THEMES.map(theme => theme.key)).size).toBe(10);
  for (const theme of DEMO_THEMES) expect(THEME_TEMPLATES).toContain(theme.tokens.homepage_template);
});
it('fills missing colors without overwriting authored values', () => {
  const tokens = normalizeThemeTokens({ colors: { accent: '#123456' }, button_style: 'outline' });
  expect(tokens.colors?.accent).toBe('#123456');
  expect(tokens.colors?.text_primary).toBeTruthy();
  expect(tokens.button_style).toBe('outline');
});
it('uses dark text on light accents and light text on dark accents', () => {
  expect(accentForeground('#FFFFFF')).toBe('#171717');
  expect(accentForeground('#fff')).toBe('#171717');
  expect(accentForeground('#313D32')).toBe('#FFFFFF');
});
