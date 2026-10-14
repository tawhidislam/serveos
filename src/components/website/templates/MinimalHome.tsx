import { Link } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { motion } from 'framer-motion';
import { ArrowRight, ChefHat } from 'lucide-react';
import type { HomeTemplateProps } from './types';

export default function MinimalHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  const hero = content?.hero || {};
  const story = content?.story || {};
  const cta = content?.cta || {};

  const bg = themeColors?.bg_primary || '#ffffff';
  const bgSecondary = themeColors?.bg_secondary || '#fafafa';
  const accent = themeColors?.accent || '#171717';
  const textColor = themeColors?.text_primary || '#171717';

  return (
    <>
      {/* Text-only hero */}
      <section className="min-h-[100dvh] flex items-center justify-center px-8" style={{ backgroundColor: bg }}>
        <div className="max-w-2xl text-center">
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
            className="text-xs uppercase tracking-[0.3em] mb-8"
            style={{ color: `${textColor}66` }}
          >
            {hero.overline ?? name}
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.7 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.15] tracking-tight mb-6"
            style={{ color: textColor }}
          >
            {hero.heading_line1 ?? 'Simply'}
            <br />
            <span className="font-semibold">{hero.heading_line2 ?? 'Delicious'}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
            className="text-base max-w-md mx-auto leading-relaxed mb-12"
            style={{ color: `${textColor}66` }}
          >
            {hero.description ?? 'Good food, honest ingredients, no fuss.'}
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex justify-center gap-4">
            <Link to={withPrefix(hero.cta_primary_link ?? '/menu')}>
              <button className="px-8 py-3 text-white text-xs uppercase tracking-[0.15em] font-medium transition-colors" style={{ backgroundColor: accent }}>
                {hero.cta_primary_text ?? 'Menu'}
              </button>
            </Link>
            {hero.cta_secondary_text && (
              <Link to={withPrefix(hero.cta_secondary_link ?? '/about')}>
                <button className="px-8 py-3 border text-xs uppercase tracking-[0.15em] font-medium transition-colors" style={{ borderColor: `${textColor}33`, color: `${textColor}b3` }}>
                  {hero.cta_secondary_text}
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* Featured — simple list */}
      <section className="py-24 border-t" style={{ backgroundColor: bg, borderColor: `${textColor}1a` }}>
        <div className="max-w-2xl mx-auto px-8">
          <div className="text-center mb-16">
            <p className="text-xs uppercase tracking-[0.3em] mb-3" style={{ color: `${textColor}66` }}>
              {featuredConfig?.overline ?? 'Menu'}
            </p>
            <h2 className="text-2xl sm:text-3xl font-light" style={{ color: textColor }}>
              {featuredConfig?.heading ?? 'Featured'}
            </h2>
          </div>

          <div className="divide-y" style={{ borderColor: `${textColor}1a` }}>
            {(featuredItems || []).slice(0, 6).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="py-5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-12 h-12 rounded-full object-cover shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: `${textColor}08` }}>
                      <ChefHat className="h-4 w-4" style={{ color: `${textColor}4d` }} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <h3 className="font-medium text-sm" style={{ color: textColor }}>{item.name}</h3>
                    <p className="text-xs truncate" style={{ color: `${textColor}66` }}>{(item as any).categories?.name}</p>
                  </div>
                </div>
                <span className="text-sm font-medium tabular-nums shrink-0" style={{ color: textColor }}>{format(item.price)}</span>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-10">
            <Link to={menuHref} className="text-xs uppercase tracking-[0.15em] font-medium transition-colors" style={{ color: `${textColor}80` }}>
              View all <ArrowRight className="h-3 w-3 inline ml-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-24" style={{ backgroundColor: bgSecondary }}>
        <div className="max-w-xl mx-auto px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs uppercase tracking-[0.3em] mb-6" style={{ color: `${textColor}66` }}>{story.overline ?? 'About'}</p>
            <p className="leading-relaxed mb-3" style={{ color: `${textColor}99` }}>{story.paragraph1}</p>
            <p className="leading-relaxed" style={{ color: `${textColor}99` }}>{story.paragraph2}</p>
            <Link to={withPrefix(story.cta_link ?? '/about')}>
              <button className="mt-8 text-xs uppercase tracking-[0.15em] font-medium transition-colors" style={{ color: `${textColor}80` }}>
                {story.cta_text ?? 'Read more'} <ArrowRight className="h-3 w-3 inline ml-1" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28" style={{ backgroundColor: bg }}>
        <div className="max-w-xl mx-auto px-8 text-center">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-2xl sm:text-3xl font-light mb-4" style={{ color: textColor }}>
              {cta.heading_line1 ?? 'Ready to dine?'}
            </h2>
            <p className="max-w-sm mx-auto mb-10" style={{ color: `${textColor}66` }}>{cta.description}</p>
            <Link to={withPrefix(cta.cta_primary_link ?? '/menu')}>
              <button className="px-10 py-3.5 text-white text-xs uppercase tracking-[0.15em] font-medium transition-colors" style={{ backgroundColor: accent }}>
                {cta.cta_primary_text ?? 'Order now'}
              </button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
