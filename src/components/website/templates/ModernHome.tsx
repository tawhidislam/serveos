import { Link } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { motion } from 'framer-motion';
import { ArrowRight, ChefHat } from 'lucide-react';
import type { HomeTemplateProps } from './types';
import heroImg from '@/assets/hero-restaurant.jpg';

export default function ModernHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  const hero = content?.hero || {};
  const story = content?.story || {};
  const cta = content?.cta || {};
  const bgImage = hero.hero_image_url || heroImg;

  const bg = themeColors?.bg_primary || '#0a0a0a';
  const accent = themeColors?.accent || '#f59e0b';
  const textColor = themeColors?.text_primary || '#ffffff';

  return (
    <>
      {/* Split-screen Hero */}
      <section className="min-h-[100dvh] grid lg:grid-cols-2">
        <div className="flex flex-col justify-center px-8 sm:px-14 lg:px-20 py-32 lg:py-20" style={{ backgroundColor: bg }}>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-xs uppercase tracking-[0.2em] font-semibold mb-6"
            style={{ color: `${accent}cc` }}
          >
            {hero.overline ?? 'Welcome'}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-display font-extrabold leading-[1.05] tracking-tight mb-6"
            style={{ color: textColor }}
          >
            {hero.heading_line1 ?? 'Elevate Your'}<br />
            <span style={{ color: accent }}>{hero.heading_line2 ?? 'Dining Experience'}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-base max-w-md leading-relaxed mb-10"
            style={{ color: `${textColor}66` }}
          >
            {hero.description ?? 'Where culinary artistry meets modern elegance.'}
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex gap-3">
            <Link to={withPrefix(hero.cta_primary_link ?? '/menu')}>
              <button className="px-8 py-3.5 font-bold text-sm uppercase tracking-wider rounded-none transition-all" style={{ backgroundColor: accent, color: '#000000' }}>
                {hero.cta_primary_text ?? 'View Menu'}
              </button>
            </Link>
            {hero.cta_secondary_text && (
              <Link to={withPrefix(hero.cta_secondary_link ?? '/about')}>
                <button className="px-8 py-3.5 border font-medium text-sm uppercase tracking-wider rounded-none transition-all" style={{ borderColor: `${textColor}33`, color: textColor }}>
                  {hero.cta_secondary_text}
                </button>
              </Link>
            )}
          </motion.div>
        </div>
        <div className="relative hidden lg:block">
          <img src={bgImage} alt="Restaurant" className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(to right, ${bg}, transparent, transparent)` }} />
        </div>
      </section>

      {/* Minimal Featured Menu */}
      <section className="py-28" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto px-8 sm:px-14 lg:px-20">
          <div className="flex items-end justify-between mb-16">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: `${accent}b3` }}>
                {featuredConfig?.overline ?? 'Selections'}
              </p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold" style={{ color: textColor }}>
                {featuredConfig?.heading ?? 'Featured Dishes'}
              </h2>
            </div>
            <Link to={menuHref} className="hidden sm:flex text-sm font-semibold uppercase tracking-wider items-center gap-2 transition-colors" style={{ color: accent }}>
              Full Menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-px" style={{ backgroundColor: `${textColor}0f` }}>
            {(featuredItems || []).slice(0, 6).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="group p-6 flex gap-5 items-center transition-colors"
                style={{ backgroundColor: bg }}
              >
                <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: `${textColor}08` }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="h-6 w-6" style={{ color: `${textColor}1a` }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-wider font-medium" style={{ color: `${accent}80` }}>
                    {(item as any).categories?.name}
                  </p>
                  <h3 className="font-semibold text-sm mt-0.5 truncate" style={{ color: textColor }}>{item.name}</h3>
                  {item.description && (
                    <p className="text-xs mt-1 line-clamp-1" style={{ color: `${textColor}40` }}>{item.description}</p>
                  )}
                </div>
                <span className="font-bold text-sm tabular-nums shrink-0" style={{ color: accent }}>{format(item.price)}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-28 border-y" style={{ backgroundColor: bg, borderColor: `${textColor}0a` }}>
        <div className="max-w-4xl mx-auto px-8 sm:px-14 lg:px-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: `${accent}b3` }}>
              {story.overline ?? 'Our Story'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold mb-6" style={{ color: textColor }}>
              {story.heading_line1 ?? 'A Legacy of'} {story.heading_line2 ?? 'Excellence'}
            </h2>
            <p className="leading-relaxed max-w-2xl mx-auto mb-4" style={{ color: `${textColor}4d` }}>{story.paragraph1}</p>
            <p className="leading-relaxed max-w-2xl mx-auto" style={{ color: `${textColor}4d` }}>{story.paragraph2}</p>
            <Link to={withPrefix(story.cta_link ?? '/about')}>
              <button className="mt-8 px-8 py-3 border text-sm uppercase tracking-wider font-medium transition-all" style={{ borderColor: `${textColor}33`, color: textColor }}>
                {story.cta_text ?? 'Learn More'}
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Minimal CTA */}
      <section className="py-28" style={{ backgroundColor: bg }}>
        <div className="max-w-4xl mx-auto px-8 sm:px-14 lg:px-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              {cta.heading_line1 ?? 'Ready for an'} <span style={{ color: accent }}>{cta.heading_line2 ?? 'Unforgettable Evening?'}</span>
            </h2>
            <p className="max-w-md mx-auto mb-10" style={{ color: `${textColor}4d` }}>{cta.description}</p>
            <Link to={withPrefix(cta.cta_primary_link ?? '/menu')}>
              <button className="px-10 py-4 font-bold text-sm uppercase tracking-wider transition-all" style={{ backgroundColor: accent, color: '#000000' }}>
                {cta.cta_primary_text ?? 'Order Now'} <ArrowRight className="h-4 w-4 inline ml-2" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
