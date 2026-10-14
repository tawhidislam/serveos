/**
 * Type definitions for the marketing CMS sections.
 * Each section type has its own content shape stored as JSONB.
 */

export type MarketingSectionType =
  | 'hero'
  | 'stats_trust'
  | 'bento_features'
  | 'feature_grid'
  | 'how_it_works'
  | 'testimonials'
  | 'pricing_preview'
  | 'cta_banner'
  | 'faq'
  | 'live_demo';

export interface HeroContent {
  pillBadge: string;
  pillText: string;
  pillHref: string;
  title: string;
  titleConnector: string;
  titleHighlight: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  trustBadges: string[];
  showAppPreview: boolean;
}

export interface StatsTrustContent {
  stats: { value: string; label: string }[];
  trustHeading: string;
  logos: string[];
}

export interface BentoFeaturesContent {
  eyebrow: string;
  title: string;
  description: string;
  qrTitle: string;
  qrDescription: string;
  kdsTitle: string;
  kdsDescription: string;
  analyticsTitle: string;
  analyticsDescription: string;
  billingTitle: string;
  billingDescription: string;
}

export interface FeatureGridContent {
  items: { icon: string; title: string; description: string }[];
  ctaLabel: string;
  ctaHref: string;
}

export interface HowItWorksContent {
  eyebrow: string;
  title: string;
  description: string;
  steps: { number: string; icon: string; title: string; description: string }[];
}

export interface TestimonialsContent {
  eyebrow: string;
  title: string;
  items: { name: string; role: string; quote: string }[];
}

export interface PricingPreviewContent {
  eyebrow: string;
  title: string;
  description: string;
  compareLabel: string;
  compareHref: string;
}

export interface CtaBannerContent {
  title: string;
  description: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  trustBadges: string[];
}

export interface FaqContent {
  eyebrow: string;
  title: string;
  items: { question: string; answer: string }[];
}

export interface LiveDemoContent {
  eyebrow: string;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
  points: string[];
}

export type SectionContentMap = {
  hero: HeroContent;
  stats_trust: StatsTrustContent;
  bento_features: BentoFeaturesContent;
  feature_grid: FeatureGridContent;
  how_it_works: HowItWorksContent;
  testimonials: TestimonialsContent;
  pricing_preview: PricingPreviewContent;
  cta_banner: CtaBannerContent;
  faq: FaqContent;
  live_demo: LiveDemoContent;
};

import type { Json } from '@/integrations/supabase/types';

/**
 * JSON object shape used for marketing section `content`.
 * Compatible with Supabase's `Json` type (assignable both ways for objects)
 * and supports object-spread without unsafe casts.
 */
export type SectionContent = { [key: string]: Json };

export interface MarketingSection {
  id: string;
  page_key: string;
  section_type: MarketingSectionType;
  sort_order: number;
  is_enabled: boolean;
  content: SectionContent;
  created_at: string;
  updated_at: string;
}

export const SECTION_LABELS: Record<MarketingSectionType, string> = {
  hero: 'Hero',
  stats_trust: 'Stats & trust bar',
  bento_features: 'Bento feature grid',
  feature_grid: 'Feature cards',
  how_it_works: 'How it works',
  testimonials: 'Testimonials',
  pricing_preview: 'Pricing preview',
  cta_banner: 'CTA banner',
  faq: 'FAQ',
  live_demo: 'Live demo',
};

export const SECTION_DEFAULTS: SectionContentMap = {
  hero: {
    pillBadge: 'New',
    pillText: 'Announce something great',
    pillHref: '/features',
    title: 'Your headline',
    titleConnector: 'for',
    titleHighlight: 'your audience',
    description: 'A short, compelling subtitle that explains the value.',
    primaryCtaLabel: 'Get started',
    primaryCtaHref: '/signup',
    secondaryCtaLabel: 'Live demo',
    secondaryCtaHref: '/demo',
    trustBadges: ['Set up in minutes', 'Cancel anytime'],
    showAppPreview: true,
  },
  // Social proof starts empty: only publish real numbers and real customers.
  stats_trust: {
    stats: [],
    trustHeading: '',
    logos: [],
  },
  bento_features: {
    eyebrow: 'Platform',
    title: 'Everything you need',
    description: 'A short description of the feature set.',
    qrTitle: 'QR ordering',
    qrDescription: 'Describe your big feature.',
    kdsTitle: 'Kitchen display',
    kdsDescription: 'Describe a feature.',
    analyticsTitle: 'Analytics',
    analyticsDescription: 'Describe a feature.',
    billingTitle: 'Billing',
    billingDescription: 'Describe a feature.',
  },
  feature_grid: {
    items: [
      { icon: 'BarChart3', title: 'Analytics', description: 'Description of this feature.' },
      { icon: 'Users', title: 'Team', description: 'Description of this feature.' },
      { icon: 'Zap', title: 'Speed', description: 'Description of this feature.' },
    ],
    ctaLabel: 'See all features',
    ctaHref: '/features',
  },
  how_it_works: {
    eyebrow: 'How it works',
    title: 'Three simple steps',
    description: 'Get up and running quickly.',
    steps: [
      { number: '01', icon: 'Smartphone', title: 'Step one', description: 'Describe step one.' },
      { number: '02', icon: 'ChefHat', title: 'Step two', description: 'Describe step two.' },
      { number: '03', icon: 'TrendingUp', title: 'Step three', description: 'Describe step three.' },
    ],
  },
  testimonials: {
    eyebrow: 'Loved by customers',
    title: 'What people are saying',
    items: [],
  },
  pricing_preview: {
    eyebrow: 'Pricing',
    title: 'Simple plans',
    description: 'Pick the plan that fits.',
    compareLabel: 'Compare features',
    compareHref: '/pricing',
  },
  cta_banner: {
    title: 'Ready to get started?',
    description: 'Set up your restaurant and take your first QR order today.',
    primaryCtaLabel: 'Get started',
    primaryCtaHref: '/signup',
    secondaryCtaLabel: 'View demo',
    secondaryCtaHref: '/demo',
    trustBadges: ['Cancel anytime'],
  },
  faq: {
    eyebrow: 'FAQ',
    title: 'Questions, answered',
    items: [
      { question: 'Your question?', answer: 'Your answer.' },
    ],
  },
  live_demo: {
    eyebrow: 'Live demo',
    title: 'Try a real restaurant — no signup',
    description: 'Open the demo restaurant and switch between owner, kitchen, waiter and guest views.',
    ctaLabel: 'Open the live demo',
    ctaHref: '/demo',
    points: ['Owner & admin dashboards', 'Kitchen display', 'QR ordering as a guest'],
  },
};

/** FAQPage structured data for search results. */
export function faqJsonLd(content: FaqContent): Record<string, unknown> | null {
  const items = (content.items ?? []).filter((i) => i.question?.trim() && i.answer?.trim());
  if (items.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map((i) => ({
      '@type': 'Question',
      name: i.question,
      acceptedAnswer: { '@type': 'Answer', text: i.answer },
    })),
  };
}
