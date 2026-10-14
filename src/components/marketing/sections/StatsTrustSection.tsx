import { motion } from 'framer-motion';
import { Section } from '@/components/marketing/Section';
import type { StatsTrustContent } from '@/lib/marketing-sections';

export default function StatsTrustSection({ content }: { content: StatsTrustContent }) {
  if (!content.stats?.length && !content.logos?.length) return null;
  return (
    <Section className="!py-16 border-y border-border/60">
      {content.stats?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {content.stats.map((s, i) => (
            <motion.div
              key={`${s.label}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="text-center"
            >
              <div className="text-3xl sm:text-4xl font-semibold text-foreground tracking-tight tabular-nums">
                {s.value}
              </div>
              <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </div>
      )}
      {content.logos?.length > 0 && (
        <div className="mt-12 pt-10 border-t border-border/60">
          {content.trustHeading && (
            <p className="text-center text-xs uppercase tracking-widest text-muted-foreground mb-6">
              {content.trustHeading}
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm font-semibold text-muted-foreground/70">
            {content.logos.map((b) => (
              <span key={b} className="hover:text-foreground transition-colors">{b}</span>
            ))}
          </div>
        </div>
      )}
    </Section>
  );
}
