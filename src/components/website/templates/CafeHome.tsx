import { Link } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { motion } from 'framer-motion';
import { ArrowRight, Coffee, ChefHat } from 'lucide-react';
import type { HomeTemplateProps } from './types';
import heroImg from '@/assets/hero-restaurant.jpg';

export default function CafeHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  const hero = content?.hero || {};
  const story = content?.story || {};
  const cta = content?.cta || {};
  const bgImage = hero.hero_image_url || heroImg;

  const bg = themeColors?.bg_primary || '#faf6f1';
  const bgSecondary = themeColors?.bg_secondary || '#f3ece3';
  const accent = themeColors?.accent || '#f59e0b';
  const textColor = themeColors?.text_primary || '#2a1f14';

  return (
    <>
      {/* Rounded hero with warm bg */}
      <section className="pt-10 pb-20 px-6 sm:px-10" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto">
          <div className="relative rounded-3xl overflow-hidden min-h-[70vh] flex items-center">
            <img src={bgImage} alt="Restaurant" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
            <div className="relative z-10 px-8 sm:px-14 py-20 max-w-2xl">
              <motion.div
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.7 }}
              >
                <div className="inline-flex items-center gap-2 text-white text-xs font-semibold uppercase tracking-wider px-4 py-1.5 rounded-full mb-6" style={{ backgroundColor: `${accent}e6` }}>
                  <Coffee className="h-3.5 w-3.5" />
                  {hero.overline ?? 'Welcome'}
                </div>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] mb-4">
                  {hero.heading_line1 ?? 'Good Food,'}<br />
                  <span style={{ color: accent }}>{hero.heading_line2 ?? 'Good Vibes'}</span>
                </h1>
                <p className="text-white/60 text-base max-w-md leading-relaxed mb-8">
                  {hero.description ?? 'Your neighborhood spot for great food and coffee.'}
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link to={withPrefix(hero.cta_primary_link ?? '/menu')}>
                    <button className="px-8 py-3.5 text-black font-bold text-sm rounded-full transition-all" style={{ backgroundColor: accent }}>
                      {hero.cta_primary_text ?? 'See Our Menu'}
                    </button>
                  </Link>
                  {hero.cta_secondary_text && (
                    <Link to={withPrefix(hero.cta_secondary_link ?? '/about')}>
                      <button className="px-8 py-3.5 bg-white/10 hover:bg-white/20 text-white font-semibold text-sm rounded-full backdrop-blur transition-all">
                        {hero.cta_secondary_text}
                      </button>
                    </Link>
                  )}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Featured — rounded cards */}
      <section className="py-20" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="flex items-end justify-between mb-10">
            <div>
              <p className="text-sm font-semibold mb-1" style={{ color: accent }}>{featuredConfig?.overline ?? 'Fan Favorites'}</p>
              <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: textColor }}>{featuredConfig?.heading ?? 'Popular Picks'}</h2>
            </div>
            <Link to={menuHref} className="hidden sm:flex text-sm font-semibold items-center gap-1 transition-colors" style={{ color: accent }}>
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {(featuredItems || []).slice(0, 6).map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover hover:scale-105 transition-transform duration-500" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: `${accent}1a` }}>
                      <ChefHat className="h-8 w-8" style={{ color: `${accent}33` }} />
                    </div>
                  )}
                </div>
                <div className="p-5">
                  <p className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: `${accent}b3` }}>
                    {(item as any).categories?.name}
                  </p>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="font-semibold text-[15px]" style={{ color: textColor }}>{item.name}</h3>
                    <span className="font-bold text-base tabular-nums shrink-0" style={{ color: accent }}>{format(item.price)}</span>
                  </div>
                  {item.description && (
                    <p className="text-[13px] mt-2 line-clamp-2 leading-relaxed" style={{ color: `${textColor}66` }}>{item.description}</p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20" style={{ backgroundColor: bgSecondary }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-sm font-semibold mb-2" style={{ color: accent }}>{story.overline ?? 'Our Story'}</p>
            <h2 className="text-3xl sm:text-4xl font-bold mb-6" style={{ color: textColor }}>
              {story.heading_line1 ?? 'Made with'} <span style={{ color: accent }}>{story.heading_line2 ?? 'Love & Care'}</span>
            </h2>
            <p className="leading-relaxed max-w-2xl mx-auto mb-3" style={{ color: `${textColor}80` }}>{story.paragraph1}</p>
            <p className="leading-relaxed max-w-2xl mx-auto" style={{ color: `${textColor}80` }}>{story.paragraph2}</p>
            <Link to={withPrefix(story.cta_link ?? '/about')}>
              <button className="mt-8 px-8 py-3 text-white text-sm font-semibold rounded-full transition-all" style={{ backgroundColor: textColor }}>
                {story.cta_text ?? 'Learn More'}
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20" style={{ backgroundColor: bg }}>
        <div className="max-w-4xl mx-auto px-6 sm:px-10 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: textColor }}>
              {cta.heading_line1 ?? 'Hungry Yet?'} <span style={{ color: accent }}>{cta.heading_line2 ?? "Let's Fix That!"}</span>
            </h2>
            <p className="max-w-md mx-auto mb-8" style={{ color: `${textColor}80` }}>{cta.description}</p>
            <Link to={withPrefix(cta.cta_primary_link ?? '/menu')}>
              <button className="px-10 py-4 text-black font-bold text-sm rounded-full transition-all" style={{ backgroundColor: accent }}>
                {cta.cta_primary_text ?? 'Order Now'} <ArrowRight className="h-4 w-4 inline ml-2" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
