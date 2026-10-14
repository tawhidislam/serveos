import MarketingLayout from '@/components/marketing/MarketingLayout';
import SectionRenderer from '@/components/marketing/sections/SectionRenderer';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import { useMarketingSections } from '@/hooks/useMarketingSections';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { usePlatformCurrency } from '@/hooks/usePlatformCurrency';
import { getPlanPrice, getPlanCycle } from '@/lib/plan-pricing';
import {
  SECTION_DEFAULTS,
  faqJsonLd,
  type FaqContent,
  type MarketingSection,
  type MarketingSectionType,
  type SectionContent,
} from '@/lib/marketing-sections';

/**
 * Built-in home page, used when no sections are saved (or they fail to load)
 * so the landing page is never blank. The live page is otherwise edited in
 * Platform → Marketing Home.
 */
const FALLBACK_CONTENT: Partial<Record<MarketingSectionType, Record<string, unknown>>> = {
  hero: {
    pillBadge: 'New',
    pillText: 'Kitchen display, POS & analytics in one place',
    pillHref: '/features',
    title: 'The operating system',
    titleConnector: 'for',
    titleHighlight: 'modern restaurants',
    description:
      'QR ordering, kitchen displays, billing and analytics — unified into one simple platform your whole team can use.',
    primaryCtaLabel: 'Get started',
    primaryCtaHref: '/signup',
    secondaryCtaLabel: 'Try the live demo',
    secondaryCtaHref: '/demo',
    trustBadges: ['Set up in minutes', 'Pay with bKash, Nagad or Rocket', 'Cancel anytime'],
    showAppPreview: true,
  },
  bento_features: {
    eyebrow: 'Platform',
    title: 'Everything you need. Nothing you don’t.',
    description: 'Replace separate ordering, kitchen, billing and reporting tools with one system.',
    qrTitle: 'QR ordering',
    qrDescription: 'Guests scan, browse and order from their phone — no app to install.',
    kdsTitle: 'Kitchen display',
    kdsDescription: 'Tickets arrive instantly with prep timers and table numbers.',
    analyticsTitle: 'Live analytics',
    analyticsDescription: 'Revenue, top items and staff performance, updated in real time.',
    billingTitle: 'POS & billing',
    billingDescription: 'Split bills, tax-inclusive totals and printed receipts.',
  },
  how_it_works: {
    eyebrow: 'How it works',
    title: 'From signup to first order the same day',
    description: 'No hardware to buy. Use the phones, tablets and printers you already have.',
    steps: [
      { number: '01', icon: 'Building2', title: 'Create your restaurant', description: 'Sign up, pick your subdomain and invite your team.' },
      { number: '02', icon: 'ChefHat', title: 'Add your menu', description: 'Items, photos, add-ons and dietary tags.' },
      { number: '03', icon: 'QrCode', title: 'Print QR codes & go live', description: 'Place codes on tables — orders flow straight to the kitchen.' },
    ],
  },
  live_demo: { ...SECTION_DEFAULTS.live_demo },
  pricing_preview: {
    eyebrow: 'Pricing',
    title: 'Simple plans. No surprises.',
    description: 'Pick the package that fits your restaurant.',
    compareLabel: 'See full pricing & feature comparison',
    compareHref: '/pricing',
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered',
    items: [
      { question: 'Do my guests need to download an app?', answer: 'No. Guests scan the table QR code with their phone camera and order from a web menu in the browser.' },
      { question: 'How do I pay for my subscription?', answer: 'Pay with bKash, Nagad or Rocket from your billing page. Your plan is activated once the payment is confirmed.' },
      { question: 'What plans are available?', answer: 'Packages run for 1, 3, 6 or 12 months. Longer packages cost less per month. You can see each package’s length and price on the pricing page.' },
      { question: 'Can orders print automatically in the kitchen?', answer: 'Yes. A small print agent on a computer at your restaurant prints new orders and receipts to your printer without anyone clicking print.' },
      { question: 'Can I use my own domain?', answer: 'Every restaurant gets its own subdomain for its website and menu. You can also connect your own domain on plans that include custom domains.' },
      { question: 'Can each staff member have their own login?', answer: 'Yes. Owners, admins, managers, kitchen staff and waiters each get their own login and only see what their role needs.' },
      { question: 'Is my restaurant’s data private?', answer: 'Yes. Each restaurant’s menu, orders and customers are kept separate at the database level, so other restaurants can never see them.' },
    ],
  },
  cta_banner: {
    title: 'Ready to run a calmer, faster restaurant?',
    description: 'Set up your restaurant and take your first QR order today.',
    primaryCtaLabel: 'Get started',
    primaryCtaHref: '/signup',
    secondaryCtaLabel: 'Talk to us',
    secondaryCtaHref: '/contact',
    trustBadges: ['Cancel anytime'],
  },
};

const FALLBACK_SECTIONS: MarketingSection[] = Object.entries(FALLBACK_CONTENT).map(([type, content], i) => ({
  id: `fallback-${type}`,
  page_key: 'home',
  section_type: type as MarketingSectionType,
  sort_order: (i + 1) * 10,
  is_enabled: true,
  content: content as SectionContent,
  created_at: '',
  updated_at: '',
}));

export default function MarketingHome() {
  const { siteName, logoUrl } = usePlatformBranding();
  const { data: saved } = useMarketingSections('home');
  const { data: plans } = useSubscriptionPlans();
  const { currency } = usePlatformCurrency();

  // Keep the page usable while saved content loads in the background.
  const sections = saved?.length ? saved : FALLBACK_SECTIONS;
  const visible = sections.filter((s) => s.is_enabled);

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://serveos.net';

  // Structured data: lowest real public price (not a fake "free" offer) + FAQ.
  const prices = (plans ?? [])
    .filter((p) => p.is_public && p.is_active)
    .map((p) => getPlanPrice(p, currency, getPlanCycle(p, currency)))
    .filter((r) => r.current > 0)
    .sort((a, b) => a.current - b.current);
  const lowest = prices[0];
  const faqSection = visible.find((s) => s.section_type === 'faq');
  const faqLd = faqSection
    ? faqJsonLd({ ...SECTION_DEFAULTS.faq, ...(faqSection.content as unknown as Partial<FaqContent>) })
    : null;

  const jsonLd: Record<string, unknown>[] = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: siteName,
      url: origin,
      logo: logoUrl ?? `${origin}/favicon.png`,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: siteName,
      applicationCategory: 'BusinessApplication',
      operatingSystem: 'Web',
      description:
        'Restaurant management with QR ordering, kitchen display, POS, billing and analytics.',
      ...(lowest
        ? { offers: { '@type': 'Offer', price: String(lowest.current), priceCurrency: lowest.currency } }
        : {}),
    },
    ...(faqLd ? [faqLd] : []),
  ];

  return (
    <MarketingLayout
      title="The operating system for modern restaurants"
      description={`${siteName} unifies QR ordering, kitchen displays, POS, billing and analytics in one simple platform for restaurants.`}
      canonical="/"
      keywords="restaurant management software, QR code ordering, kitchen display system, restaurant POS, restaurant billing, restaurant analytics, Bangladesh"
      jsonLd={jsonLd}
    >
      {visible.map((s) => <SectionRenderer key={s.id} section={s} />)}
    </MarketingLayout>
  );
}
