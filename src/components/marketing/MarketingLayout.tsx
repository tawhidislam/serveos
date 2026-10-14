import MarketingNav from './MarketingNav';
import MarketingFooter from './MarketingFooter';
import FaviconInjector from './FaviconInjector';
import MarketingSEO from './MarketingSEO';
import SupportLauncher from '@/components/support/SupportLauncher';

interface Props {
  children: React.ReactNode;
  title: string;
  description: string;
  /** Path-only canonical, e.g. "/pricing" */
  canonical?: string;
  /** Optional comma-separated keywords. */
  keywords?: string;
  /** Optional override for the OG/Twitter share image (1200×630). */
  image?: string;
  /** og:type — "website" by default. */
  type?: 'website' | 'article';
  /** JSON-LD structured data to embed in the page <head>. */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Skip the footer (used on dense funnel pages). */
  noFooter?: boolean;
  /** Show the floating support chat button (off for editor previews). */
  supportChat?: boolean;
  /** Marks the page as noindex (rare on marketing pages). */
  noindex?: boolean;
}

export default function MarketingLayout({
  children,
  title,
  description,
  canonical,
  keywords,
  image,
  type,
  jsonLd,
  noFooter,
  supportChat = true,
  noindex,
}: Props) {
  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      <FaviconInjector />
      <MarketingSEO
        title={title}
        description={description}
        canonical={canonical}
        keywords={keywords}
        image={image}
        type={type}
        jsonLd={jsonLd}
        noindex={noindex}
      />
      <MarketingNav />
      <main className="pt-16">{children}</main>
      {!noFooter && <MarketingFooter />}
      {supportChat && <SupportLauncher />}
    </div>
  );
}
