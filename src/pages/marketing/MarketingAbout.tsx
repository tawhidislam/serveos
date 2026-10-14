import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Heart, Target, Eye, Zap, Shield, Users, ArrowRight, type LucideIcon } from 'lucide-react';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { useMarketingAbout, ABOUT_DEFAULT } from '@/hooks/useMarketingAbout';

const ICON_MAP: Record<string, LucideIcon> = {
  target: Target,
  eye: Eye,
  heart: Heart,
  zap: Zap,
  shield: Shield,
  users: Users,
};

function iconFor(key: string): LucideIcon {
  return ICON_MAP[key?.toLowerCase()] ?? Target;
}

export default function MarketingAbout() {
  const { data } = useMarketingAbout();
  const c = data ?? { id: '', ...ABOUT_DEFAULT };

  return (
    <MarketingLayout
      title={c.meta_title}
      description={c.meta_description}
      canonical="/about"
      keywords="about ServeOS, restaurant software company, restaurant tech mission"
    >
      <Section className="!pt-16">
        <SectionHeading
          eyebrow={c.hero_eyebrow}
          title={c.hero_title}
          description={c.hero_description}
        />
        {c.hero_image_url && (
          <div className="mt-10 max-w-5xl mx-auto rounded-2xl overflow-hidden border border-border/60">
            <img src={c.hero_image_url} alt={c.hero_title} className="w-full aspect-[16/7] object-cover" />
          </div>
        )}
      </Section>

      {/* MISSION & VISION */}
      {c.pillars.length > 0 && (
        <Section className="!pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {c.pillars.map((p, i) => {
              const Icon = iconFor(p.icon);
              return (
                <motion.div
                  key={`${p.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="rounded-2xl border border-border/60 bg-card p-8"
                >
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold">{p.title}</h3>
                  <p className="mt-3 text-muted-foreground leading-relaxed">{p.body}</p>
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* WHY CHOOSE */}
      {c.values_items.length > 0 && (
        <Section className="bg-muted/30">
          <SectionHeading eyebrow={c.why_eyebrow} title={c.why_title} />
          <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
            {c.values_items.map((v, i) => {
              const Icon = iconFor(v.icon);
              return (
                <motion.div
                  key={`${v.title}-${i}`}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.05 }}
                  className="rounded-2xl border border-border/60 bg-card p-6"
                >
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold">{v.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{v.body}</p>
                </motion.div>
              );
            })}
          </div>
        </Section>
      )}

      {/* STORY */}
      <Section>
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-[2fr,1fr] gap-12 items-start">
          <div>
            <SectionHeading eyebrow={c.story_eyebrow} title={c.story_title} align="left" />
            <div className="mt-10 space-y-5 text-muted-foreground leading-relaxed">
              {c.story_paragraphs.map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
          {c.story_image_url && (
            <div className="rounded-2xl overflow-hidden border border-border/60">
              <img src={c.story_image_url} alt={c.story_title} className="w-full aspect-[4/5] object-cover" />
            </div>
          )}
        </div>
      </Section>

      <Section className="bg-muted/30">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{c.cta_title}</h2>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to={c.cta_primary_href}>
              <Button size="lg" className="gap-2 h-12 px-7">
                {c.cta_primary_label} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to={c.cta_secondary_href}>
              <Button size="lg" variant="outline" className="h-12 px-7">
                {c.cta_secondary_label}
              </Button>
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
