import HeroSection from '@/components/website/home/HeroSection';
import StatsStrip from '@/components/website/home/StatsStrip';
import FeaturedMenu from '@/components/website/home/FeaturedMenu';
import StorySection from '@/components/website/home/StorySection';
import CTASection from '@/components/website/home/CTASection';
import type { HomeTemplateProps } from './types';

export default function ClassicHome({ name, content, featuredItems, format, featuredConfig }: HomeTemplateProps) {
  return (
    <>
      <HeroSection name={name} content={content?.hero} />
      <StatsStrip content={content?.stats} />
      <FeaturedMenu
        items={featuredItems}
        format={format}
        heading={featuredConfig?.heading}
        overline={featuredConfig?.overline}
      />
      <StorySection content={content?.story} />
      <CTASection content={content?.cta} />
    </>
  );
}
