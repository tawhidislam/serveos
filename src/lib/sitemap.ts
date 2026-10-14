/**
 * Sitemap helpers — build a search-engine-friendly sitemap.xml from the
 * restaurant's public pages + dynamic menu items.
 *
 * Also produces an SEO export of canonical URLs and hreflang alternates so
 * search engines can disambiguate the same page when it's reachable on more
 * than one host (e.g. legacy `/r/:slug` and a verified custom domain).
 *
 * Pure functions, no React. Used by the admin sitemap generator page.
 */

export interface HreflangAlternate {
  /** BCP-47 language tag, or "x-default" for the fallback. */
  hreflang: string;
  /** Absolute URL the alternate points to. */
  href: string;
}

export interface SitemapUrl {
  /** Absolute URL (including origin) — also used as the canonical link. */
  loc: string;
  /** ISO date — last modification timestamp */
  lastmod?: string;
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  /** 0.0 – 1.0 */
  priority?: number;
  /** Hreflang alternates rendered as <xhtml:link rel="alternate"> entries. */
  alternates?: HreflangAlternate[];
}

export interface MenuItemForSitemap {
  id: string;
  updated_at?: string | null;
  is_available?: boolean | null;
}

export interface BuildSitemapInput {
  /** Origin without trailing slash, e.g. "https://acme.com" */
  origin: string;
  /** Optional restaurant slug — when present, `/r/:slug` legacy URLs are also emitted. */
  slug?: string | null;
  /** Restaurant updated_at (used as lastmod for the homepage). */
  restaurantUpdatedAt?: string | null;
  /** Public menu items — each becomes /menu/:id. Unavailable items are skipped. */
  menuItems?: MenuItemForSitemap[];
  /**
   * Origin of the platform host (e.g. https://serveos.net) used to
   * emit legacy `/r/:slug` URLs when `origin` is a custom domain.
   * Falls back to `origin` when not provided.
   */
  platformOrigin?: string | null;
  /** Default site language (BCP-47). Defaults to "en". */
  defaultLanguage?: string;
  /** Additional language codes for which alternates should be advertised. */
  additionalLanguages?: string[];
}

/** Static public routes that exist on every tenant site. */
const STATIC_ROUTES: Array<{ path: string; changefreq: SitemapUrl['changefreq']; priority: number }> = [
  { path: '/',        changefreq: 'weekly',  priority: 1.0 },
  { path: '/menu',    changefreq: 'daily',   priority: 0.9 },
  { path: '/about',   changefreq: 'monthly', priority: 0.6 },
  { path: '/gallery', changefreq: 'monthly', priority: 0.6 },
  { path: '/contact', changefreq: 'monthly', priority: 0.7 },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function joinUrl(origin: string, path: string): string {
  const o = origin.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

/** Build the structured list of URLs that will go into the sitemap. */
export function buildSitemapUrls(input: BuildSitemapInput): SitemapUrl[] {
  const {
    origin,
    slug,
    restaurantUpdatedAt,
    menuItems = [],
    platformOrigin,
    defaultLanguage = 'en',
    additionalLanguages = [],
  } = input;

  const urls: SitemapUrl[] = [];
  const cleanOrigin = origin.replace(/\/+$/, '');
  const cleanPlatform = (platformOrigin ?? cleanOrigin).replace(/\/+$/, '');
  const hasLegacyMirror = !!slug && cleanPlatform !== cleanOrigin;

  /** Build hreflang alternates for a given canonical+legacy pair. */
  const buildAlternates = (canonical: string, legacy?: string): HreflangAlternate[] => {
    const out: HreflangAlternate[] = [
      { hreflang: defaultLanguage, href: canonical },
      { hreflang: 'x-default', href: canonical },
    ];
    for (const lang of additionalLanguages) {
      out.push({ hreflang: lang, href: canonical });
    }
    if (legacy) out.push({ hreflang: `${defaultLanguage}-legacy`, href: legacy });
    return out;
  };

  // Static pages on the canonical (custom-domain) host
  for (const r of STATIC_ROUTES) {
    const canonical = joinUrl(cleanOrigin, r.path);
    const legacy = hasLegacyMirror
      ? joinUrl(cleanPlatform, r.path === '/' ? `/r/${slug}` : `/r/${slug}${r.path}`)
      : undefined;
    urls.push({
      loc: canonical,
      lastmod: r.path === '/' ? restaurantUpdatedAt ?? undefined : undefined,
      changefreq: r.changefreq,
      priority: r.priority,
      alternates: buildAlternates(canonical, legacy),
    });
  }

  // Per-item detail pages
  for (const item of menuItems) {
    if (item.is_available === false) continue;
    const canonical = joinUrl(cleanOrigin, `/menu/${item.id}`);
    const legacy = hasLegacyMirror
      ? joinUrl(cleanPlatform, `/menu/${item.id}`)
      : undefined;
    urls.push({
      loc: canonical,
      lastmod: item.updated_at ?? undefined,
      changefreq: 'weekly',
      priority: 0.7,
      alternates: buildAlternates(canonical, legacy),
    });
  }

  // Legacy /r/:slug duplicates — useful when the tenant is also reachable via the
  // platform host. Lower priority so search engines prefer the canonical domain.
  if (slug) {
    const legacyMap: Array<{ legacyPath: string; canonicalPath: string }> = [
      { legacyPath: `/r/${slug}`,         canonicalPath: '/' },
      { legacyPath: `/r/${slug}/menu`,    canonicalPath: '/menu' },
      { legacyPath: `/r/${slug}/about`,   canonicalPath: '/about' },
      { legacyPath: `/r/${slug}/gallery`, canonicalPath: '/gallery' },
      { legacyPath: `/r/${slug}/contact`, canonicalPath: '/contact' },
    ];
    for (const { legacyPath, canonicalPath } of legacyMap) {
      const legacyHost = hasLegacyMirror ? cleanPlatform : cleanOrigin;
      const canonical = joinUrl(cleanOrigin, canonicalPath);
      const loc = joinUrl(legacyHost, legacyPath);
      urls.push({
        loc,
        changefreq: 'monthly',
        priority: 0.4,
        alternates: buildAlternates(canonical, loc),
      });
    }
  }

  return urls;
}

/** Serialize a list of URLs into a valid XML sitemap document. */
export function renderSitemapXml(urls: SitemapUrl[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) {
        const d = new Date(u.lastmod);
        if (!isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
      }
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (typeof u.priority === 'number') parts.push(`    <priority>${u.priority.toFixed(1)}</priority>`);
      for (const alt of u.alternates ?? []) {
        parts.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`
        );
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

/** Build a robots.txt body that points at the sitemap URL. */
export function renderRobotsTxt(origin: string): string {
  const sitemapUrl = joinUrl(origin.replace(/\/+$/, ''), '/sitemap.xml');
  return `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;
}

/** Flat row used by the SEO export (CSV + JSON). */
export interface SeoExportRow {
  loc: string;
  canonical: string;
  alternates: HreflangAlternate[];
  changefreq?: SitemapUrl['changefreq'];
  priority?: number;
  lastmod?: string;
}

export function buildSeoExport(urls: SitemapUrl[]): SeoExportRow[] {
  return urls.map((u) => {
    const canonical =
      u.alternates?.find((a) => a.hreflang === 'x-default')?.href ?? u.loc;
    return {
      loc: u.loc,
      canonical,
      alternates: u.alternates ?? [],
      changefreq: u.changefreq,
      priority: u.priority,
      lastmod: u.lastmod,
    };
  });
}

function csvCell(val: string | number | undefined | null): string {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialize the SEO export to CSV (one row per URL, alternates pipe-joined). */
export function renderSeoExportCsv(rows: SeoExportRow[]): string {
  const header = ['loc', 'canonical', 'hreflang_alternates', 'changefreq', 'priority', 'lastmod'];
  const lines = [header.join(',')];
  for (const r of rows) {
    const alts = r.alternates.map((a) => `${a.hreflang}=${a.href}`).join(' | ');
    lines.push(
      [
        csvCell(r.loc),
        csvCell(r.canonical),
        csvCell(alts),
        csvCell(r.changefreq),
        csvCell(typeof r.priority === 'number' ? r.priority.toFixed(2) : ''),
        csvCell(r.lastmod),
      ].join(',')
    );
  }
  return lines.join('\n') + '\n';
}

/** Serialize the SEO export to JSON for programmatic consumption. */
export function renderSeoExportJson(rows: SeoExportRow[]): string {
  return JSON.stringify({ generatedAt: new Date().toISOString(), urls: rows }, null, 2) + '\n';
}
