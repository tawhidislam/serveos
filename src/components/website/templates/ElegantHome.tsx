import { Link } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { motion } from 'framer-motion';
import { ArrowRight, ChefHat } from 'lucide-react';
import type { HomeTemplateProps } from './types';
import heroImg from '@/assets/hero-restaurant.jpg';

export default function ElegantHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  const hero = content?.hero || {};
  const story = content?.story || {};
  const cta = content?.cta || {};
  const bgImage = hero.hero_image_url || heroImg;

  const bg = themeColors?.bg_primary || '#0d0d0d';
  const accent = themeColors?.accent || '#f59e0b';
  const textColor = themeColors?.text_primary || '#ffffff';

  return (
    <>
      {/* Full-bleed hero with overlay */}
      <section className="relative min-h-[100dvh] flex items-center justify-center text-center">
        <img src={bgImage} alt="Restaurant" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-black/60" />
        <div className="relative z-10 max-w-3xl px-8">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
            className="text-xs uppercase tracking-[0.35em] font-medium mb-6"
            style={{ color: `${accent}b3` }}
          >
            {hero.overline ?? '— Welcome —'}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5, duration: 0.8 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-serif font-normal leading-[1.1] tracking-tight mb-4"
            style={{ color: textColor }}
          >
            {hero.heading_line1 ?? name}
          </motion.h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.8, duration: 0.6 }}
            className="w-20 h-px mx-auto mb-6"
            style={{ backgroundColor: accent }}
          />
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}
            className="text-lg font-light max-w-lg mx-auto leading-relaxed mb-10"
            style={{ color: `${textColor}80` }}
          >
            {hero.description ?? 'An exquisite dining experience awaits.'}
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex gap-4 justify-center">
            <Link to={withPrefix(hero.cta_primary_link ?? '/menu')}>
              <button className="px-10 py-3.5 font-semibold text-xs uppercase tracking-[0.2em] transition-all" style={{ backgroundColor: accent, color: '#000000' }}>
                {hero.cta_primary_text ?? 'View Menu'}
              </button>
            </Link>
            {hero.cta_secondary_text && (
              <Link to={withPrefix(hero.cta_secondary_link ?? '/about')}>
                <button className="px-10 py-3.5 border text-xs uppercase tracking-[0.2em] transition-all" style={{ borderColor: `${textColor}4d`, color: textColor }}>
                  {hero.cta_secondary_text}
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Featured — 2-column elegant cards */}
      <section className="py-28" style={{ backgroundColor: bg }}>
        <div className="max-w-5xl mx-auto px-8 sm:px-14">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.3em] font-medium mb-3" style={{ color: `${accent}99` }}>
              {featuredConfig?.overline ?? 'Curated Selection'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif" style={{ color: textColor }}>{featuredConfig?.heading ?? "Chef's Picks"}</h2>
            <div className="w-12 h-px mx-auto mt-5" style={{ backgroundColor: `${accent}66` }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {(featuredItems || []).slice(0, 6).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="flex gap-5 items-start group"
              >
                <div className="w-24 h-24 rounded-lg overflow-hidden shrink-0" style={{ backgroundColor: `${textColor}08` }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="h-6 w-6" style={{ color: `${textColor}1a` }} />
                    </div>
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <div className="flex items-baseline justify-between gap-3 mb-1">
                    <h3 className="font-serif text-lg" style={{ color: textColor }}>{item.name}</h3>
                    <span className="font-semibold text-sm tabular-nums shrink-0" style={{ color: accent }}>{format(item.price)}</span>
                  </div>
                  <p className="text-xs uppercase tracking-wider mb-1.5" style={{ color: `${textColor}4d` }}>{(item as any).categories?.name}</p>
                  {item.description && (
                    <p className="text-sm leading-relaxed line-clamp-2" style={{ color: `${textColor}33` }}>{item.description}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-12">
            <Link to={menuHref} className="text-xs uppercase tracking-[0.2em] font-semibold transition-colors" style={{ color: accent }}>
              Full Menu <ArrowRight className="h-3.5 w-3.5 inline ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Story — centered serif */}
      <section className="py-28 border-y" style={{ backgroundColor: bg, borderColor: `${textColor}0a` }}>
        <div className="max-w-3xl mx-auto px-8 sm:px-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs uppercase tracking-[0.3em] font-medium mb-4" style={{ color: `${accent}99` }}>
              {story.overline ?? 'Our Story'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-serif mb-2" style={{ color: textColor }}>
              {story.heading_line1 ?? 'A Tradition of'} {story.heading_line2 ?? 'Excellence'}
            </h2>
            <div className="w-12 h-px mx-auto my-6" style={{ backgroundColor: `${accent}66` }} />
            <p className="leading-relaxed mb-4 font-light" style={{ color: `${textColor}4d` }}>{story.paragraph1}</p>
            <p className="leading-relaxed font-light" style={{ color: `${textColor}4d` }}>{story.paragraph2}</p>
            <Link to={withPrefix(story.cta_link ?? '/about')}>
              <button className="mt-8 px-8 py-3 border text-xs uppercase tracking-[0.2em] font-medium transition-all" style={{ borderColor: `${textColor}33`, color: textColor }}>
                {story.cta_text ?? 'Our Heritage'}
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28" style={{ backgroundColor: bg }}>
        <div className="max-w-3xl mx-auto px-8 sm:px-14 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-5xl font-serif mb-6" style={{ color: textColor }}>
              {cta.heading_line1 ?? 'Join Us for an'} <span className="italic" style={{ color: accent }}>{cta.heading_line2 ?? 'Unforgettable Evening'}</span>
            </h2>
            <p className="max-w-md mx-auto mb-10 font-light" style={{ color: `${textColor}4d` }}>{cta.description}</p>
            <Link to={withPrefix(cta.cta_primary_link ?? '/menu')}>
              <button className="px-12 py-4 font-semibold text-xs uppercase tracking-[0.2em] transition-all" style={{ backgroundColor: accent, color: '#000000' }}>
                {cta.cta_primary_text ?? 'Reserve a Table'} <ArrowRight className="h-4 w-4 inline ml-2" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
