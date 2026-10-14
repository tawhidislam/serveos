import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Star } from 'lucide-react';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import heroImg from '@/assets/hero-restaurant.jpg';

interface HeroSectionProps {
  name: string;
  content?: {
    overline?: string;
    heading_line1?: string;
    heading_line2?: string;
    description?: string;
    cta_primary_text?: string;
    cta_primary_link?: string;
    cta_secondary_text?: string;
    cta_secondary_link?: string;
    show_rating?: boolean;
    show_stats?: boolean;
    hero_image_url?: string;
  };
}

export default function HeroSection({ name, content }: HeroSectionProps) {
  const c = content || {};
  const { withPrefix } = useWebsitePrefix();
  const overline = c.overline ?? 'Award-Winning Dining';
  const line1 = c.heading_line1 ?? 'Elevate Your';
  const line2 = c.heading_line2 ?? 'Dining Experience';
  const desc = c.description ?? 'Where culinary artistry meets modern elegance. Every dish crafted to perfection with the finest ingredients.';
  const ctaPrimaryText = c.cta_primary_text ?? 'View Menu';
  const ctaPrimaryLink = c.cta_primary_link ?? '/menu';
  const ctaSecondaryText = c.cta_secondary_text ?? 'Our Story';
  const ctaSecondaryLink = c.cta_secondary_link ?? '/about';
  const showRating = c.show_rating ?? true;
  const showStats = c.show_stats ?? true;
  const bgImage = c.hero_image_url || heroImg;

  return (
    <section className="relative h-[100dvh] overflow-hidden">
      <img src={bgImage} alt="Restaurant interior" className="absolute inset-0 w-full h-full object-cover" width={1920} height={1080} />
      <div className="absolute inset-0 bg-black/60" />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />

      <div className="relative z-10 h-full flex flex-col justify-end pb-20 sm:pb-24 px-6 sm:px-10 lg:px-16 max-w-7xl mx-auto w-full">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex items-center gap-3 mb-6">
          {showRating && (
            <div className="flex items-center gap-1 text-amber-400">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 fill-current" />)}
            </div>
          )}
          <span className="text-white/50 text-sm">{overline}</span>
        </motion.div>

        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.4 }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-extrabold text-white leading-[0.95] tracking-tight mb-6 max-w-4xl">
          {line1}<br />{line2}
        </motion.h1>

        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}
          className="text-white/50 text-lg sm:text-xl max-w-xl leading-relaxed mb-10">
          {desc}
        </motion.p>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row items-start sm:items-center gap-6 sm:gap-10">
          <div className="flex items-center gap-3">
            <Link to={withPrefix(ctaPrimaryLink)}>
              <button className="h-13 px-8 sm:px-10 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm uppercase tracking-wider flex items-center gap-2.5 rounded-full transition-all duration-300 hover:shadow-[0_8px_30px_rgba(245,158,11,0.3)]">
                {ctaPrimaryText} <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            {ctaSecondaryText && (
              <Link to={withPrefix(ctaSecondaryLink)}>
                <button className="h-13 px-8 py-3.5 bg-white/10 hover:bg-white/15 backdrop-blur-sm text-white font-medium text-sm uppercase tracking-wider rounded-full border border-white/10 transition-all duration-300">
                  {ctaSecondaryText}
                </button>
              </Link>
            )}
          </div>
          {showStats && (
            <div className="hidden sm:flex items-center gap-8 pl-10 border-l border-white/10">
              {[{ num: '4.9', label: 'Rating' }, { num: '10K+', label: 'Guests' }].map(s => (
                <div key={s.label}>
                  <p className="text-white font-bold text-xl">{s.num}</p>
                  <p className="text-white/30 text-xs uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#070707] to-transparent z-[5]" />
    </section>
  );
}
