import WebsiteThemeInjector from './WebsiteThemeInjector';
import { useRestaurantTheme } from '@/hooks/usePlatformThemes';
import { useMemo } from 'react';
import WebsiteNav from './WebsiteNav';
import WebsiteFooter from './WebsiteFooter';
import ScrollToTop from './ScrollToTop';
import TenantFaviconInjector from '@/components/TenantFaviconInjector';
import { useSettings } from '@/hooks/useSettings';
import { useThemeColors } from '@/hooks/useThemeColors';

interface WebsiteLayoutProps {
  children: React.ReactNode;
  templateOverride?: string;
}

const defaultBgMap: Record<string, string> = {
  default: '#f8f9fa',
  minimal: '#ffffff',
  bistro: '#1a120b',
  cafe: '#faf6f1',
  elegant: '#0d0d0d',
  modern: '#0a0a0a',
  classic: '#070707',
  grand: '#0a0a0a',
};

export default function WebsiteLayout({ children, templateOverride }: WebsiteLayoutProps) {
  const { data: settings } = useSettings();
  const themeColors = useThemeColors();
  const { data: theme } = useRestaurantTheme();
  const template = templateOverride || theme?.tokens.homepage_template || settings?.homepage_template || 'classic';

  const bgColor = themeColors.bg_primary || defaultBgMap[template] || '#070707';

  const cssVars = useMemo(() => ({
    '--tmpl-bg': bgColor,
    '--tmpl-bg-secondary': themeColors.bg_secondary || '',
    '--tmpl-accent': themeColors.accent || '',
    '--tmpl-accent-light': themeColors.accent_light || '',
    '--tmpl-text': themeColors.text_primary || '',
  } as React.CSSProperties), [bgColor, themeColors]);

  return (
    <div className="tenant-themed-website min-h-screen flex flex-col" data-homepage-template={template} style={{ backgroundColor: bgColor, fontFamily: theme?.tokens.fonts?.body_family, ...cssVars }}>
      <WebsiteThemeInjector />
      {theme && <style>{`
        .tenant-themed-website h1, .tenant-themed-website h2, .tenant-themed-website h3 { font-family: var(--tmpl-font-heading, inherit); }
        .tenant-themed-website button { border-radius: var(--tmpl-radius, 0.5rem); }
        html[data-tenant-button-style="outline"] .tenant-themed-website button:not([aria-label]):not([role="tab"]) { background: transparent !important; border: 1px solid var(--tmpl-accent); color: var(--tmpl-accent) !important; }
        html[data-tenant-button-style="pill"] .tenant-themed-website button { border-radius: 999px; }
        html[data-tenant-button-style="sharp"] .tenant-themed-website button { border-radius: 0; }
      `}</style>}
      <TenantFaviconInjector source="resolved" />
      <WebsiteNav />
      <main className="flex-1">
        {children}
      </main>
      <WebsiteFooter />
      <ScrollToTop />
    </div>
  );
}
