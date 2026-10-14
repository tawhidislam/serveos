import { Helmet } from 'react-helmet-async';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';

interface Props {
  /** Page-specific title (e.g. "Pricing"). Suffixed with " — {siteName}" automatically unless it already contains the site name. */
  title: string;
  /** Meta description (~155 chars max, plain text). */
  description: string;
  /** Path-only canonical, e.g. "/pricing". Resolved against window.location.origin at runtime. */
  canonical?: string;
  /** Optional comma-separated keywords. */
  keywords?: string;
  /** Override the default Open Graph / Twitter image (1200×630 recommended). */
  image?: string;
  /** og:type — defaults to "website". Use "article" for blog posts. */
  type?: 'website' | 'article';
  /** Optional JSON-LD structured data. Passed as-is into a <script type="application/ld+json">. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** When true, instruct crawlers not to index this page (e.g. login screens). */
  noindex?: boolean;
}

const FALLBACK_ORIGIN = 'https://serveos.net';

function getOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return FALLBACK_ORIGIN;
}

/**
 * Centralized SEO meta block for every public marketing page.
 * Emits: title, description, canonical, OpenGraph (title/desc/image/url/type/site_name),
 * Twitter card, optional keywords, optional robots noindex, and optional JSON-LD.
 *
 * Branding (site name + default OG image) is sourced from `platform_settings` so
 * the platform admin can update it without redeploying.
 */
export default function MarketingSEO({
  title,
  description,
  canonical,
  keywords,
  image,
  type = 'website',
  jsonLd,
  noindex,
}: Props) {
  const { siteName, logoUrl } = usePlatformBranding();

  const fullTitle = title.includes(siteName) ? title : `${title} — ${siteName}`;
  const origin = getOrigin();
  const url = canonical ? `${origin}${canonical}` : undefined;
  const ogImage = image || logoUrl || undefined;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      {keywords && <meta name="keywords" content={keywords} />}
      {noindex && <meta name="robots" content="noindex, nofollow" />}
      {url && <link rel="canonical" href={url} />}

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      {url && <meta property="og:url" content={url} />}
      {ogImage && <meta property="og:image" content={ogImage} />}
      {ogImage && <meta property="og:image:alt" content={`${siteName} logo`} />}

      {/* Twitter */}
      <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {jsonLd && (
        <script type="application/ld+json">
          {JSON.stringify(jsonLd)}
        </script>
      )}
    </Helmet>
  );
}
