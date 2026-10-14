import { useEffect } from 'react';
import { useRestaurantTheme } from '@/hooks/usePlatformThemes';

/**
 * Injects the restaurant's assigned theme tokens into the document so the
 * public website (`WebsiteLayout` + nested templates) picks up the right
 * colors, fonts, radius, and button style. Renders nothing.
 *
 * Reads from `restaurants.theme_id` -> `platform_themes.tokens`.
 */
export default function WebsiteThemeInjector() {
  const { data: theme } = useRestaurantTheme();

  /* ---- Load Google Fonts (idempotent) ----------------------------------- */
  useEffect(() => {
    const families = theme?.tokens?.fonts?.google_fonts;
    if (!families?.length) return;
    const id = `tenant-theme-fonts-${theme?.id}`;
    if (document.getElementById(id)) return;
    const href = `https://fonts.googleapis.com/css2?${families
      .map((f) => `family=${f}`)
      .join('&')}&display=swap`;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [theme?.id, theme?.tokens?.fonts?.google_fonts]);

  /* ---- Inject CSS variables on <html> ----------------------------------- */
  useEffect(() => {
    if (!theme) return;
    const root = document.documentElement;
    const c = theme.tokens.colors ?? {};
    const f = theme.tokens.fonts ?? {};

    const vars: Record<string, string | undefined> = {
      // Template tokens (consumed by WebsiteLayout + templates)
      '--tmpl-bg': c.bg_primary,
      '--tmpl-bg-secondary': c.bg_secondary,
      '--tmpl-accent': c.accent,
      '--tmpl-accent-light': c.accent_light,
      '--tmpl-text': c.text_primary,
      '--tmpl-text-muted': c.text_muted,
      // Nav tokens (consumed by WebsiteNav / WebsiteFooter)
      '--tmpl-nav-bg': c.nav_bg,
      '--tmpl-nav-text': c.nav_text,
      '--tmpl-nav-accent': c.nav_accent,
      // Typography
      '--tmpl-font-heading': f.heading_family,
      '--tmpl-font-body': f.body_family,
      // Shape
      '--tmpl-radius': theme.tokens.radius,
    };

    const applied: string[] = [];
    for (const [k, v] of Object.entries(vars)) {
      if (v) {
        root.style.setProperty(k, v);
        applied.push(k);
      }
    }
    root.dataset.tenantThemeKey = theme.key;
    root.dataset.tenantButtonStyle = theme.tokens.button_style ?? 'solid';

    return () => {
      for (const k of applied) root.style.removeProperty(k);
      delete root.dataset.tenantThemeKey;
      delete root.dataset.tenantButtonStyle;
    };
  }, [theme]);

  return null;
}
