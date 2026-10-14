import { motion } from 'framer-motion';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { getIcon } from '@/lib/icon-map';
import type { HowItWorksContent } from '@/lib/marketing-sections';

export default function HowItWorksSection({ content }: { content: HowItWorksContent }) {
  return (
    <Section className="bg-muted/40 border-y border-border/60">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        {content.steps?.map((s, i) => {
          const Icon = getIcon(s.icon);
          return (
            <motion.div
              key={s.number + i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative rounded-2xl border border-border bg-card p-7 z-10"
            >
              <div className="flex items-center justify-between mb-5">
                <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="text-xs font-mono font-semibold text-muted-foreground">{s.number}</div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.description}</p>
            </motion.div>
          );
        })}
      </div>
    </Section>
  );
}
