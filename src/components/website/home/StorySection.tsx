import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import aboutImg from '@/assets/about-interior.jpg';

interface StorySectionProps {
  content?: {
    overline?: string;
    heading_line1?: string;
    heading_line2?: string;
    paragraph1?: string;
    paragraph2?: string;
    cta_text?: string;
    cta_link?: string;
    badge_value?: string;
    badge_label?: string;
    story_image_url?: string;
  };
}

export default function StorySection({ content }: StorySectionProps) {
  const c = content || {};
  const { withPrefix } = useWebsitePrefix();
  const overline = c.overline ?? 'Our Story';
  const line1 = c.heading_line1 ?? 'A Legacy of';
  const line2 = c.heading_line2 ?? 'Culinary Excellence';
  const p1 = c.paragraph1 ?? 'Founded with a vision to redefine dining, our restaurant brings together the world\'s finest ingredients with innovative technique and timeless tradition.';
  const p2 = c.paragraph2 ?? 'Every dish is a masterpiece — thoughtfully composed, beautifully presented, and crafted to create moments that linger long after the last bite.';
  const ctaText = c.cta_text ?? 'Learn More';
  const ctaLink = c.cta_link ?? '/about';
  const badgeVal = c.badge_value ?? '5+';
  const badgeLbl = c.badge_label ?? 'Years';
  const storyImage = c.story_image_url || aboutImg;

  return (
    <section className="py-24 bg-[#070707] overflow-hidden">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7 }} className="relative">
            <div className="rounded-2xl overflow-hidden">
              <img src={storyImage} alt="Our restaurant" className="w-full aspect-[4/5] object-cover" loading="lazy" />
            </div>
            <div className="absolute -bottom-4 -right-4 sm:bottom-6 sm:right-6 bg-amber-500 rounded-xl px-5 py-4 shadow-lg">
              <p className="text-black font-bold text-3xl">{badgeVal}</p>
              <p className="text-black/70 text-xs uppercase tracking-wider font-semibold">{badgeLbl}</p>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
            <p className="text-amber-500 text-sm font-semibold uppercase tracking-wider mb-3">{overline}</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white leading-tight mb-6">
              {line1}<br />{line2}
            </h2>
            <div className="space-y-4 text-white/35 leading-relaxed">
              <p>{p1}</p>
              <p>{p2}</p>
            </div>
            <Link to={withPrefix(ctaLink)}>
              <button className="mt-8 h-12 px-7 bg-white/[0.06] hover:bg-white/10 text-white font-medium text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 border border-white/[0.08] transition-all duration-300">
                {ctaText} <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
