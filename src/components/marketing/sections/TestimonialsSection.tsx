import { motion } from 'framer-motion';
import { Star } from 'lucide-react';
import { Section, SectionHeading } from '@/components/marketing/Section';
import type { TestimonialsContent } from '@/lib/marketing-sections';

export default function TestimonialsSection({ content }: { content: TestimonialsContent }) {
  if (!content.items?.length) return null;
  return (
    <Section>
      <SectionHeading eyebrow={content.eyebrow} title={content.title} />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5">
        {content.items?.map((t, i) => (
          <motion.div
            key={t.name + i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.08 }}
            className="rounded-2xl border border-border bg-card p-7 hover:border-primary/30 transition-colors"
          >
            <div className="flex gap-1 mb-4">
              {[...Array(5)].map((_, idx) => (
                <Star key={idx} className="h-4 w-4 fill-warning text-warning" />
              ))}
            </div>
            <p className="text-sm text-foreground leading-relaxed mb-6">"{t.quote}"</p>
            <div className="flex items-center gap-3 pt-5 border-t border-border">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-sm font-semibold text-primary">
                {t.name?.[0] ?? '?'}
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.role}</div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
}
