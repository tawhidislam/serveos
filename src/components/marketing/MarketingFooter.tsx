import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import {
  Twitter,
  Github,
  Linkedin,
  Facebook,
  Instagram,
  Youtube,
  Globe,
  type LucideIcon,
} from 'lucide-react';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import { useMarketingFooter, FOOTER_DEFAULT } from '@/hooks/useMarketingFooter';
import { prefetchHandlers } from '@/lib/marketing-prefetch';
import PlatformLogo from './PlatformLogo';

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  twitter: Twitter,
  github: Github,
  linkedin: Linkedin,
  facebook: Facebook,
  instagram: Instagram,
  youtube: Youtube,
  website: Globe,
};

function isExternal(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('mailto:') || href.startsWith('tel:');
}

/**
 * Minimal, modern card-style footer.
 *
 *  - Floating rounded card sitting on the page background
 *  - Brand block (logo + tagline + socials) on the left
 *  - Up to 4 link columns on the right
 *  - Hairline divider, then copyright + legal links
 *  - Giant outline wordmark anchored behind everything
 */
export default function MarketingFooter() {
  const { siteName } = usePlatformBranding();
  const { data } = useMarketingFooter();
  const footer = data ?? { id: '', ...FOOTER_DEFAULT };
  // Placeholder links (empty or "#") would just reload the page — hide them.
  const socialLinks = footer.social_links.filter((s) => s.href && s.href.trim() !== '#');

  const copyright = (footer.copyright_text || FOOTER_DEFAULT.copyright_text)
    .replace('{year}', String(new Date().getFullYear()))
    .replace('{siteName}', siteName);

  // First 4 columns become the right-side nav grid. Anything beyond folds
  // into the bottom legal strip.
  const navColumns = useMemo(() => footer.columns.slice(0, 4), [footer.columns]);
  const extraLinks = useMemo(
    () => footer.columns.slice(4).flatMap((c) => c.links),
    [footer.columns],
  );

  return (
    <footer className="relative w-full overflow-hidden bg-background pb-2 pt-10 sm:pt-20">
      <div className="relative mx-auto w-full max-w-6xl px-2.5 sm:px-6">
        {/* ─────────── Floating card ─────────── */}
        <div className="relative z-10 rounded-2xl border border-border bg-card px-4 py-7 shadow-[var(--shadow-card)] sm:rounded-3xl sm:px-10 sm:py-12">
          <div className="grid grid-cols-1 gap-8 sm:gap-12 lg:grid-cols-12 lg:gap-10">
            {/* Brand block */}
            <div className="lg:col-span-4">
              <Link to="/" aria-label="Home" className="inline-flex">
                <span className="block [&_img]:!h-6 sm:[&_img]:!h-7">
                  <PlatformLogo />
                </span>
              </Link>
              <p className="mt-3 max-w-sm text-[13px] leading-relaxed text-muted-foreground sm:mt-5 sm:text-[14px]">
                {footer.tagline}
              </p>

              {socialLinks.length > 0 && (
                <div className="mt-5 flex flex-wrap items-center gap-1 sm:mt-6 sm:gap-1.5">
                  {socialLinks.map((s, idx) => {
                    const Icon = SOCIAL_ICONS[s.icon?.toLowerCase()] ?? Globe;
                    return (
                      <a
                        key={`${s.icon}-${idx}`}
                        href={s.href}
                        aria-label={s.label || s.icon}
                        target={isExternal(s.href) ? '_blank' : undefined}
                        rel={isExternal(s.href) ? 'noopener noreferrer' : undefined}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-all duration-200 hover:bg-muted hover:text-foreground active:bg-muted"
                      >
                        <Icon className="h-4 w-4" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Link columns */}
            {navColumns.length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-7 xs:gap-x-6 sm:grid-cols-4 sm:gap-8 lg:col-span-8 lg:gap-6">
                {navColumns.map((col, ci) => (
                  <div key={`${col.title}-${ci}`} className="min-w-0">
                    <h3 className="text-[13px] font-semibold tracking-tight text-foreground">
                      {col.title}
                    </h3>
                    <ul className="mt-3 flex flex-col gap-2 sm:mt-4 sm:gap-3">
                      {col.links.map((l, li) => {
                        const cls =
                          'block break-words text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150 sm:text-[13.5px]';
                        return (
                          <li key={`${l.to}-${li}`}>
                            {isExternal(l.to) ? (
                              <a
                                href={l.to}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={cls}
                              >
                                {l.label}
                              </a>
                            ) : (
                              <Link
                                to={l.to || '#'}
                                {...prefetchHandlers(l.to || '')}
                                className={cls}
                              >
                                {l.label}
                              </Link>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ─────────── Hairline + bottom row ─────────── */}
          <div className="mt-8 flex flex-col items-center gap-4 border-t border-border pt-5 text-center sm:mt-12 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-6 sm:text-left">
            <p className="text-[11.5px] text-muted-foreground sm:text-[12.5px]">{copyright}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-start sm:gap-x-5">
              {extraLinks.map((l, li) => {
                const cls =
                  'text-[11.5px] text-muted-foreground hover:text-foreground transition-colors sm:text-[12.5px]';
                return isExternal(l.to) ? (
                  <a
                    key={`x-${li}`}
                    href={l.to}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cls}
                  >
                    {l.label}
                  </a>
                ) : (
                  <Link
                    key={`x-${li}`}
                    to={l.to || '#'}
                    {...prefetchHandlers(l.to || '')}
                    className={cls}
                  >
                    {l.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─────────── Giant ghost wordmark ─────────── */}
        <div
          aria-hidden
          className="pointer-events-none relative -mt-2 w-full select-none sm:-mt-8"
        >
          <div className="flex w-full justify-center font-display font-bold leading-[0.85] tracking-tighter">
            <span
              className="block w-full whitespace-nowrap bg-gradient-to-b from-foreground/[0.07] to-transparent bg-clip-text px-2 text-center text-transparent"
              style={{ fontSize: 'clamp(2rem, 14.5vw, 15rem)' }}
            >
              {siteName}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
