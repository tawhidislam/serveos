import { Link } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import { motion } from 'framer-motion';
import { ArrowRight, Star, ChefHat } from 'lucide-react';
import type { HomeTemplateProps } from './types';
import heroImg from '@/assets/hero-restaurant.jpg';
import aboutImg from '@/assets/about-interior.jpg';

export default function BistroHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  const hero = content?.hero || {};
  const stats = content?.stats?.items || [];
  const story = content?.story || {};
  const cta = content?.cta || {};
  const bgImage = hero.hero_image_url || heroImg;
  const storyImage = story.story_image_url || aboutImg;

  const bg = themeColors?.bg_primary || '#1a120b';
  const accent = themeColors?.accent || '#d97706';
  const accentLight = themeColors?.accent_light || '#fbbf24';
  const textColor = themeColors?.text_primary || '#ffffff';

  return (
    <>
      {/* Centered Hero with warm overlay */}
      <section className="relative min-h-[100dvh] flex items-center justify-center overflow-hidden">
        <img src={bgImage} alt="Restaurant" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, rgba(0,0,0,0.7), rgba(0,0,0,0.5), ${bg})` }} />
        <div className="relative z-10 text-center px-6 max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }}>
            {(hero.show_rating ?? true) && (
              <div className="flex justify-center gap-1 mb-4" style={{ color: accentLight }}>
                {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </div>
            )}
            <p className="text-sm uppercase tracking-[0.25em] font-medium mb-4" style={{ color: `${accentLight}cc` }}>
              {hero.overline ?? 'Est. 2020'}
            </p>
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold leading-[1] tracking-tight mb-6" style={{ color: textColor }}>
              {name}
            </h1>
            <p className="text-lg max-w-lg mx-auto leading-relaxed mb-10" style={{ color: `${textColor}80` }}>
              {hero.description ?? 'A warm haven for unforgettable flavors and cherished moments.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={withPrefix(hero.cta_primary_link ?? '/menu')}>
                <button className="px-10 py-4 font-bold text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all shadow-lg" style={{ backgroundColor: accent, color: '#ffffff', boxShadow: `0 10px 25px -5px ${accent}4d` }}>
                  {hero.cta_primary_text ?? 'Explore Menu'} <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              {hero.cta_secondary_text && (
                <Link to={withPrefix(hero.cta_secondary_link ?? '/about')}>
                  <button className="px-10 py-4 font-medium text-sm uppercase tracking-wider rounded-full border transition-all" style={{ backgroundColor: `${textColor}1a`, borderColor: `${textColor}1a`, color: `${textColor}e6` }}>
                    {hero.cta_secondary_text}
                  </button>
                </Link>
              )}
            </div>
          </motion.div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-32" style={{ background: `linear-gradient(to top, ${bg}, transparent)` }} />
      </section>

      {/* Stats in warm tones */}
      {stats.length > 0 && (
        <section className="py-14" style={{ backgroundColor: bg }}>
          <div className="max-w-5xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((s: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }} className="text-center">
                <span className="text-lg mb-1 block" style={{ color: accent }}>{s.icon}</span>
                <p className="font-bold text-2xl" style={{ color: textColor }}>{s.value}</p>
                <p className="text-xs uppercase tracking-wider mt-1" style={{ color: `${textColor}4d` }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Horizontal scrolling menu */}
      <section className="py-24" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10">
          <div className="text-center mb-12">
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-2" style={{ color: `${accent}b3` }}>
              {featuredConfig?.overline ?? 'From Our Kitchen'}
            </p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold" style={{ color: textColor }}>
              {featuredConfig?.heading ?? "Chef's Picks"}
            </h2>
          </div>

          <div className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide">
            {(featuredItems || []).slice(0, 8).map((item, i) => (
              <motion.div key={item.id} initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} className="shrink-0 w-[280px] snap-start group">
                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative" style={{ backgroundColor: `${textColor}08` }}>
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ChefHat className="h-10 w-10" style={{ color: `${textColor}1a` }} />
                    </div>
                  )}
                  <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-5">
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: `${accentLight}b3` }}>
                      {(item as any).categories?.name}
                    </p>
                    <h3 className="text-white font-semibold text-sm mt-1">{item.name}</h3>
                    <span className="font-bold text-sm mt-1 block" style={{ color: accentLight }}>{format(item.price)}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center mt-8">
            <Link to={menuHref} className="text-sm font-semibold uppercase tracking-wider inline-flex items-center gap-2 transition-colors" style={{ color: accent }}>
              View Full Menu <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Story with overlapping image */}
      <section className="py-24" style={{ backgroundColor: bg }}>
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="relative">
              <div className="rounded-3xl overflow-hidden" style={{ borderWidth: 2, borderColor: `${accent}33` }}>
                <img src={storyImage} alt="Our restaurant" className="w-full aspect-[4/5] object-cover" loading="lazy" />
              </div>
              {story.badge_value && (
                <div className="absolute -bottom-4 -right-4 rounded-2xl px-6 py-4 shadow-xl" style={{ backgroundColor: accent }}>
                  <p className="text-white font-bold text-3xl">{story.badge_value}</p>
                  <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#ffffffb3' }}>{story.badge_label ?? 'Years'}</p>
                </div>
              )}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}>
              <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-3" style={{ color: `${accent}b3` }}>
                {story.overline ?? 'Our Story'}
              </p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold leading-tight mb-6" style={{ color: textColor }}>
                {story.heading_line1 ?? 'A Tradition of'}<br />{story.heading_line2 ?? 'Warmth & Flavor'}
              </h2>
              <div className="space-y-4 leading-relaxed" style={{ color: `${textColor}59` }}>
                <p>{story.paragraph1}</p>
                <p>{story.paragraph2}</p>
              </div>
              <Link to={withPrefix(story.cta_link ?? '/about')}>
                <button className="mt-8 px-8 py-3 font-medium text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all" style={{ backgroundColor: `${accent}33`, color: accentLight, borderWidth: 1, borderColor: `${accent}33` }}>
                  {story.cta_text ?? 'Our Story'} <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Warm CTA */}
      <section className="py-32 relative overflow-hidden" style={{ background: `linear-gradient(to bottom, ${bg}, ${bg}ee)` }}>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-[120px] pointer-events-none" style={{ backgroundColor: `${accent}0d` }} />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <p className="text-xs uppercase tracking-[0.2em] font-semibold mb-4" style={{ color: `${accent}b3` }}>
              {cta.overline ?? 'Join Us'}
            </p>
            <h2 className="text-4xl sm:text-5xl font-display font-bold mb-6" style={{ color: textColor }}>
              {cta.heading_line1 ?? 'Ready for a'}<br />{cta.heading_line2 ?? 'Memorable Meal?'}
            </h2>
            <p className="max-w-md mx-auto mb-10" style={{ color: `${textColor}4d` }}>{cta.description}</p>
            <Link to={withPrefix(cta.cta_primary_link ?? '/menu')}>
              <button className="px-10 py-4 font-bold text-sm uppercase tracking-wider rounded-full shadow-lg flex items-center gap-2.5 mx-auto transition-all" style={{ backgroundColor: accent, color: '#ffffff', boxShadow: `0 10px 25px -5px ${accent}4d` }}>
                {cta.cta_primary_text ?? 'Order Now'} <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
