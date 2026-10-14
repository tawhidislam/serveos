import HeroSection from './HeroSection';
import StatsTrustSection from './StatsTrustSection';
import BentoFeaturesSection from './BentoFeaturesSection';
import FeatureGridSection from './FeatureGridSection';
import HowItWorksSection from './HowItWorksSection';
import TestimonialsSection from './TestimonialsSection';
import PricingPreviewSection from './PricingPreviewSection';
import CtaBannerSection from './CtaBannerSection';
import FaqSection from './FaqSection';
import LiveDemoSection from './LiveDemoSection';
import { SECTION_DEFAULTS, type MarketingSection } from '@/lib/marketing-sections';

/**
 * Renders a single marketing section using its content blob.
 * Falls back to defaults for missing keys so the renderer never crashes.
 */
export default function SectionRenderer({ section }: { section: MarketingSection }) {
  if (!section.is_enabled) return null;

  const type = section.section_type;
  const defaults = (SECTION_DEFAULTS as Record<string, unknown>)[type] ?? {};
  const content = { ...(defaults as object), ...(section.content || {}) } as never;

  switch (type) {
    case 'hero':
      return <HeroSection content={content} />;
    case 'stats_trust':
      return <StatsTrustSection content={content} />;
    case 'bento_features':
      return <BentoFeaturesSection content={content} />;
    case 'feature_grid':
      return <FeatureGridSection content={content} />;
    case 'how_it_works':
      return <HowItWorksSection content={content} />;
    case 'testimonials':
      return <TestimonialsSection content={content} />;
    case 'pricing_preview':
      return <PricingPreviewSection content={content} />;
    case 'cta_banner':
      return <CtaBannerSection content={content} />;
    case 'faq':
      return <FaqSection content={content} />;
    case 'live_demo':
      return <LiveDemoSection content={content} />;
    default:
      return null;
  }
}
