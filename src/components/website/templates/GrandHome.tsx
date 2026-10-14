import { Link } from 'react-router-dom';
import CtaLink from '@/components/website/CtaLink';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ChefHat, Clock, MapPin, Phone } from 'lucide-react';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import type { HomeTemplateProps } from './types';
import heroImg from '@/assets/hero-restaurant.jpg';
import { buildImageSources, gridSizes } from '@/lib/responsive-image';


const GRAND = {
  bg: '#0a0a0a',
  panel: '#1a1508',
  accent: '#c9a227',
  accentLight: '#e6c65c',
  text: '#f5f0e6',
};

export const GRAND_SECTION_ORDER = ['hero', 'stats', 'featured', 'story', 'gallery', 'contact', 'cta'] as const satisfies readonly string[];

const FADE_UP = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
};

const NO_MOTION = {
  initial: { opacity: 1, y: 0 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-80px' },
  transition: { duration: 0 },
};

export default function GrandHome({ name, content, featuredItems, format, featuredConfig, themeColors }: HomeTemplateProps) {
  const { withPrefix } = useWebsitePrefix();
  const reduceMotion = useReducedMotion();
  const fadeUp = reduceMotion ? NO_MOTION : FADE_UP;


  const hero = content?.hero || {};
  const stats = content?.stats?.items || [];
  const story = content?.story || {};
  const gallery = content?.gallery || {};
  const contact = content?.contact || {};
  const cta = content?.cta || {};

  const bg = themeColors?.bg_primary || GRAND.bg;
  const panel = themeColors?.bg_secondary || GRAND.panel;
  const accent = themeColors?.accent || GRAND.accent;
  const accentLight = themeColors?.accent_light || GRAND.accentLight;
  const text = themeColors?.text_primary || GRAND.text;

  const bgImage = hero.hero_image_url || heroImg;
  const clampPct = (v: unknown, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : fallback;
  };
  const images: { url: string; thumb_url?: string; caption?: string; alt?: string; focus_x?: number; focus_y?: number; zoom?: number }[] = (gallery.images || []).filter((i: any) => i?.url);
  const galleryColumns = Math.min(6, Math.max(2, Number(gallery.columns) || 4));
  const galleryColsClass: Record<number, string> = {
    2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6',
  };

  const Rule = ({ className = '' }: { className?: string }) => (
    <div className={`h-px w-full ${className}`} style={{ background: `linear-gradient(90deg, transparent, ${accent}59, transparent)` }} />
  );

  const Overline = ({ children }: { children: React.ReactNode }) => (
    <p className="text-[11px] uppercase tracking-[0.4em] font-medium mb-4" style={{ color: accent }}>{children}</p>
  );

  const section_hero = (
    <>
      <section className="relative min-h-[100dvh] flex items-center justify-center text-center overflow-hidden">
        <motion.img
          src={bgImage}
          alt={name}
          initial={{ scale: 1.12 }}
          animate={{ scale: 1 }}
          transition={{ duration: 2.4, ease: 'easeOut' }}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${bg}cc 0%, ${bg}66 40%, ${bg} 100%)` }} />
        <div className="relative z-10 max-w-4xl px-8 py-24">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }}>
            <Overline>{hero.overline ?? 'Est. Fine Dining'}</Overline>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 1 }}
            className="font-serif leading-[1.05] tracking-tight text-5xl sm:text-6xl lg:text-8xl"
            style={{ color: text }}
          >
            {hero.heading_line1 ?? name}
            {hero.heading_line2 && (
              <>
                <br />
                <span className="italic" style={{ color: accentLight }}>{hero.heading_line2}</span>
              </>
            )}
          </motion.h1>
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.9, duration: 0.8 }}
            className="w-28 h-px mx-auto my-8" style={{ backgroundColor: accent }}
          />
          <motion.p
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 0.8 }}
            className="text-base sm:text-lg font-light max-w-xl mx-auto leading-relaxed"
            style={{ color: `${text}99` }}
          >
            {hero.description ?? 'A grand table, set for you — seasonal plates, rare wines and unhurried evenings.'}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.2, duration: 0.8 }}
            className="flex flex-wrap gap-4 justify-center mt-11"
          >
            <CtaLink to={hero.cta_primary_link} fallback="/menu" source="hero_primary" label={hero.cta_primary_text ?? 'Explore the Menu'}>
              <button className="px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] transition-transform hover:-translate-y-0.5" style={{ backgroundColor: accent, color: '#0a0a0a' }}>
                {hero.cta_primary_text ?? 'Explore the Menu'}
              </button>
            </CtaLink>
            {hero.cta_secondary_text && (
              <CtaLink to={hero.cta_secondary_link} fallback="/about" source="hero_secondary" label={hero.cta_secondary_text}>
                <button className="px-10 py-4 border text-[11px] uppercase tracking-[0.25em] transition-colors hover:bg-white/5" style={{ borderColor: `${accent}66`, color: text }}>
                  {hero.cta_secondary_text}
                </button>
              </CtaLink>
            )}
          </motion.div>
        </div>
      </section>
    </>
  );
  const section_stats = (
    <>
      {stats.length > 0 && (
        <section className="relative" style={{ backgroundColor: bg }}>
          <Rule />
          <div className="max-w-6xl mx-auto px-8 py-14 grid gap-10 sm:gap-6 grid-cols-2 lg:grid-cols-4 text-center">
            {stats.map((s: any, i: number) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                <p className="font-serif text-3xl sm:text-4xl mb-1.5" style={{ color: accentLight }}>{s.value}</p>
                <p className="text-[10px] uppercase tracking-[0.28em]" style={{ color: `${text}66` }}>{s.label}</p>
              </motion.div>
            ))}
          </div>
          <Rule />
        </section>
      )}
    </>
  );
  const section_featured = (
    <>
      <section className="py-24 sm:py-32" style={{ backgroundColor: bg }}>
        <div className="max-w-5xl mx-auto px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Overline>{featuredConfig?.overline ?? 'The Selection'}</Overline>
            <h2 className="font-serif text-4xl sm:text-5xl" style={{ color: text }}>
              {featuredConfig?.heading ?? 'Signature Plates'}
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-14 gap-y-9">
            {(featuredItems || []).slice(0, 8).map((item: any, i: number) => (
              <motion.div key={item.id} {...fadeUp} transition={{ ...fadeUp.transition, delay: (i % 4) * 0.07 }}>
                <div className="flex items-baseline gap-3">
                  <h3 className="font-serif text-xl shrink-0" style={{ color: text }}>{item.name}</h3>
                  <span className="flex-1 border-b border-dotted translate-y-[-3px]" style={{ borderColor: `${accent}4d` }} />
                  <span className="font-medium text-sm tabular-nums shrink-0" style={{ color: accentLight }}>{format(item.price)}</span>
                </div>
                {item.categories?.name && (
                  <p className="text-[10px] uppercase tracking-[0.28em] mt-2" style={{ color: `${accent}99` }}>{item.categories.name}</p>
                )}
                {item.description && (
                  <p className="text-sm font-light leading-relaxed mt-2 line-clamp-2" style={{ color: `${text}59` }}>{item.description}</p>
                )}
              </motion.div>
            ))}
            {(!featuredItems || featuredItems.length === 0) && (
              <div className="col-span-full flex flex-col items-center py-10" style={{ color: `${text}40` }}>
                <ChefHat className="h-7 w-7 mb-3" />
                <p className="text-sm font-light">The menu is being prepared.</p>
              </div>
            )}
          </div>

          <motion.div {...fadeUp} className="text-center mt-16">
            <Link to={withPrefix('/menu')} className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] font-semibold" style={{ color: accent }}>
              Full Menu <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
  const section_story = (
    <>
      <section className="py-24 sm:py-32" style={{ backgroundColor: panel }}>
        <div className="max-w-6xl mx-auto px-8 grid gap-14 lg:grid-cols-2 items-center">
          <motion.div {...fadeUp} className="relative">
            <img
              src={story.story_image_url || bgImage}
              alt={story.heading_line1 || 'Our story'}
              loading="lazy"
              className="w-full aspect-[4/5] object-cover"
            />
            <div className="absolute inset-0 border" style={{ borderColor: `${accent}33`, transform: 'translate(18px, 18px)' }} />
            {story.badge_value && (
              <div className="absolute -bottom-6 -right-2 px-7 py-5 text-center" style={{ backgroundColor: accent, color: '#0a0a0a' }}>
                <p className="font-serif text-3xl leading-none">{story.badge_value}</p>
                <p className="text-[9px] uppercase tracking-[0.25em] mt-1.5">{story.badge_label}</p>
              </div>
            )}
          </motion.div>

          <motion.div {...fadeUp}>
            <Overline>{story.overline ?? 'Our Story'}</Overline>
            <h2 className="font-serif text-4xl sm:text-5xl leading-tight mb-7" style={{ color: text }}>
              {story.heading_line1 ?? 'A Tradition'}{' '}
              <span className="italic" style={{ color: accentLight }}>{story.heading_line2 ?? 'of Excellence'}</span>
            </h2>
            <p className="font-light leading-relaxed mb-4" style={{ color: `${text}80` }}>{story.paragraph1}</p>
            <p className="font-light leading-relaxed" style={{ color: `${text}66` }}>{story.paragraph2}</p>
            {story.cta_text && (
              <CtaLink to={story.cta_link} fallback="/about" source="story" label={story.cta_text}>
                <button className="mt-9 px-9 py-3.5 border text-[11px] uppercase tracking-[0.25em] transition-colors hover:bg-white/5" style={{ borderColor: `${accent}66`, color: text }}>
                  {story.cta_text}
                </button>
              </CtaLink>
            )}
          </motion.div>
        </div>
      </section>
    </>
  );
  const displayedImages = images.slice(0, 12);
  const galleryLd = displayedImages.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'ImageGallery',
    name: gallery.heading ?? `${name} Gallery`,
    ...(gallery.description ? { description: gallery.description } : {}),
    ...(typeof window !== 'undefined' ? { url: `${window.location.origin}${window.location.pathname}#gallery` } : {}),
    associatedMedia: displayedImages.map((img, i) => ({
      '@type': 'ImageObject',
      contentUrl: img.url,
      ...(img.thumb_url && img.thumb_url !== img.url ? { thumbnailUrl: img.thumb_url } : {}),
      ...(img.caption ? { caption: img.caption } : {}),
      name: img.alt || img.caption || `${name} gallery image ${i + 1}`,
      ...(img.alt ? { description: img.alt } : {}),
representativeOfPage: i === 0,
    })),
  } : null;

  const section_gallery = (
    <>
      {images.length > 0 && (
        <section id="gallery" className="py-24 sm:py-32" style={{ backgroundColor: bg }}>
          <div className="max-w-6xl mx-auto px-8">
            {galleryLd && (
              <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(galleryLd) }}
              />
            )}

            <motion.div {...fadeUp} className="text-center mb-14">
              <Overline>{gallery.overline ?? 'Gallery'}</Overline>
              <h2 className="font-serif text-4xl sm:text-5xl" style={{ color: text }}>{gallery.heading ?? 'Moments at the Table'}</h2>
              {gallery.description && (
                <p className="mt-5 font-light max-w-xl mx-auto" style={{ color: `${text}66` }}>{gallery.description}</p>
              )}
            </motion.div>

            <ul
              role="list"
              aria-label={`${gallery.heading ?? `${name} gallery`} — ${Math.min(images.length, 12)} photos`}
              className={`grid grid-cols-2 ${galleryColsClass[galleryColumns]} gap-3 sm:gap-4 list-none p-0 m-0`}
            >
              {images.slice(0, 12).map((img, i) => {
                const featured = galleryColumns >= 4 && i % 5 === 0;
                const { src, srcSet } = buildImageSources(img.url, img.thumb_url, !featured);
                return (
                <motion.li
                  key={i}
                  {...fadeUp}
                  transition={{ ...fadeUp.transition, delay: (i % galleryColumns) * 0.07 }}
                  className={featured ? 'lg:col-span-2 lg:row-span-2' : ''}
                >
                <figure
                  tabIndex={0}
                  aria-label={`Photo ${i + 1} of ${Math.min(images.length, 12)}: ${img.alt || img.caption || 'gallery image'}`}
                  className={`relative overflow-hidden group h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${featured ? 'aspect-square' : 'aspect-[4/5]'}`}
                  style={{ ['--tw-ring-color' as any]: accent }}
                >
                  <div className={`w-full h-full ${reduceMotion ? '' : 'transition-transform duration-[1200ms] group-hover:scale-105 group-focus-within:scale-105'}`}>
                    <img
                      src={src}
                      srcSet={srcSet}
                      sizes={gridSizes(galleryColumns, featured)}
                      alt={img.alt || img.caption || `Gallery image ${i + 1}`}
                      loading={i < galleryColumns ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={i < galleryColumns ? 'auto' : 'low'}
                      width={featured ? 800 : 400}
                      height={featured ? 800 : 500}
                      className="w-full h-full object-cover"
                      style={{
                        objectPosition: `${clampPct(img.focus_x, 50)}% ${clampPct(img.focus_y, 50)}%`,
                        transform: (img.zoom && img.zoom !== 1) ? `scale(${Math.min(2, Math.max(1, Number(img.zoom) || 1))})` : undefined,
                      }}
                    />
                  </div>

                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${reduceMotion ? '' : 'transition-opacity duration-500'}`} style={{ background: `linear-gradient(0deg, ${bg}cc, transparent 60%)` }} />
                  {img.caption && (
                    <figcaption className={`absolute bottom-0 left-0 right-0 p-4 text-[10px] uppercase tracking-[0.25em] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 ${reduceMotion ? '' : 'transition-opacity duration-500'}`} style={{ color: text }}>
                      {img.caption}
                    </figcaption>

                  )}
                </figure>
                </motion.li>
                );
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  );
  const section_contact = (
    <>
      {(contact.address_line1 || contact.address || contact.phone || contact.hours_weekday) && (
        <section style={{ backgroundColor: bg }}>
          <Rule />
          <div className="max-w-6xl mx-auto px-8 py-16 grid gap-10 sm:grid-cols-3 text-center">
            {[
              {
                icon: MapPin,
                title: 'Find Us',
                lines: [
                  { text: contact.address_line1 || contact.address, href: contact.maps_href },
                  { text: contact.address_line1 ? contact.address_line2 : undefined },
                ],
              },
              {
                icon: Clock,
                title: 'Hours',
                lines: [{ text: contact.hours_weekday }, { text: contact.hours_weekend }],
              },
              {
                icon: Phone,
                title: 'Reservations',
                lines: [
                  { text: contact.phone, href: contact.phone_href },
                  { text: contact.email, href: contact.email ? `mailto:${contact.email}` : undefined },
                ],
              },
            ].map((col, i) => (
              <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.08 }}>
                <col.icon className="h-4 w-4 mx-auto mb-4" style={{ color: accent }} />
                <p className="text-[10px] uppercase tracking-[0.3em] mb-3" style={{ color: accent }}>{col.title}</p>
                {col.lines.filter(l => l.text).map((line, j) => (
                  <p key={j} className="text-sm font-light leading-relaxed" style={{ color: `${text}80` }}>
                    {line.href ? (
                      <a
                        href={line.href}
                        target={line.href.startsWith('http') ? '_blank' : undefined}
                        rel={line.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                        className="transition-opacity hover:opacity-100"
                      >
                        {line.text}
                      </a>
                    ) : (
                      line.text
                    )}
                  </p>
                ))}
              </motion.div>
            ))}
          </div>
          <Rule />
        </section>
      )}
    </>
  );

  const section_cta = (
    <>
      <section className="py-24 sm:py-28" style={{ backgroundColor: accent }}>
        <motion.div {...fadeUp} className="max-w-3xl mx-auto px-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.4em] mb-5" style={{ color: '#0a0a0acc' }}>{cta.overline ?? 'Reserve'}</p>
          <h2 className="font-serif text-4xl sm:text-5xl leading-tight" style={{ color: '#0a0a0a' }}>
            {cta.heading_line1 ?? 'Join Us for an'}{' '}
            <span className="italic">{cta.heading_line2 ?? 'Unforgettable Evening'}</span>
          </h2>
          {cta.description && (
            <p className="mt-6 font-light max-w-md mx-auto" style={{ color: '#0a0a0ab3' }}>{cta.description}</p>
          )}
          <div className="flex flex-wrap gap-4 justify-center mt-10">
            <CtaLink to={cta.cta_primary_link} fallback="/contact#reserve" source="cta_primary" label={cta.cta_primary_text ?? 'Reserve a Table'}>
              <button className="px-10 py-4 text-[11px] font-semibold uppercase tracking-[0.25em] transition-transform hover:-translate-y-0.5" style={{ backgroundColor: '#0a0a0a', color: accentLight }}>
                {cta.cta_primary_text ?? 'Reserve a Table'}
              </button>
            </CtaLink>
            {cta.cta_secondary_text && (
              <CtaLink to={cta.cta_secondary_link} fallback="/menu" source="cta_secondary" label={cta.cta_secondary_text}>
                <button className="px-10 py-4 border text-[11px] uppercase tracking-[0.25em]" style={{ borderColor: '#0a0a0a66', color: '#0a0a0a' }}>
                  {cta.cta_secondary_text}
                </button>
              </CtaLink>
            )}
          </div>
        </motion.div>
      </section>
    </>
  );

  const sectionNodes: Record<string, React.ReactNode> = {
    hero: section_hero,
    stats: section_stats,
    featured: section_featured,
    story: section_story,
    gallery: section_gallery,
    contact: section_contact,
    cta: section_cta,
  };

  const layout = (content as any)?.section_layout?.grand || {};
  const hidden: string[] = layout.hidden || [];
  const order: string[] = (layout.order && layout.order.length ? layout.order : GRAND_SECTION_ORDER)
    .filter((k: string) => k in sectionNodes);
  // Append any section missing from a stale saved order so nothing disappears.
  const finalOrder = [...order, ...GRAND_SECTION_ORDER.filter(k => !order.includes(k))];

  return (
    <div style={{ backgroundColor: bg }}>
      {finalOrder.filter(k => !hidden.includes(k)).map(k => (
        <div key={k}>{sectionNodes[k]}</div>
      ))}
    </div>
  );
}
