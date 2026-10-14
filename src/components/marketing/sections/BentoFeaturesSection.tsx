import { motion } from 'framer-motion';
import { QrCode, ChefHat, BarChart3, CreditCard } from 'lucide-react';
import { Section, SectionHeading } from '@/components/marketing/Section';
import type { BentoFeaturesContent } from '@/lib/marketing-sections';

export default function BentoFeaturesSection({ content }: { content: BentoFeaturesContent }) {
  return (
    <Section>
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />
      <div className="mt-14 grid grid-cols-1 md:grid-cols-6 gap-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
          className="md:col-span-4 relative overflow-hidden rounded-2xl border border-border bg-card p-6 sm:p-7 hover:border-primary/30 transition-colors"
        >
          <div className="relative z-10 max-w-sm">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
              <QrCode className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">{content.qrTitle}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{content.qrDescription}</p>
          </div>
          <div className="hidden sm:block absolute sm:right-8 sm:bottom-8 w-[200px] opacity-90 pointer-events-none" aria-hidden>
            <div className="rounded-[24px] border-[6px] border-foreground/90 bg-background shadow-2xl overflow-hidden">
              <div className="aspect-[9/16] bg-gradient-to-b from-muted/30 to-card p-3 space-y-2">
                <div className="h-3 w-16 rounded-full bg-foreground/10" />
                <div className="h-12 rounded-lg bg-foreground/5" />
                <div className="h-12 rounded-lg bg-primary/15 border border-primary/30" />
                <div className="h-12 rounded-lg bg-foreground/5" />
                <div className="h-8 rounded-lg bg-primary mt-3" />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="md:col-span-2 rounded-2xl border border-border bg-card p-7 hover:border-primary/30 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
            <ChefHat className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">{content.kdsTitle}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{content.kdsDescription}</p>
          <div className="mt-5 space-y-1.5">
            {['#1042 · Table 7', '#1043 · Table 3', '#1044 · Takeout'].map((t, i) => (
              <div key={i} className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-md bg-muted/60 border border-border">
                <span className="font-mono text-foreground">{t}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="md:col-span-2 rounded-2xl border border-border bg-card p-7 hover:border-primary/30 transition-colors"
        >
          <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
            <BarChart3 className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-2">{content.analyticsTitle}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{content.analyticsDescription}</p>
          <div className="mt-5 h-14 flex items-end gap-1">
            {[30, 50, 40, 70, 55, 80, 65, 90].map((h, i) => (
              <div key={i} className="flex-1 bg-gradient-to-t from-primary to-primary/30 rounded-sm" style={{ height: `${h}%` }} />
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.15 }}
          className="md:col-span-4 rounded-2xl border border-border bg-card p-7 hover:border-primary/30 transition-colors"
        >
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center mb-5">
                <CreditCard className="h-5 w-5 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{content.billingTitle}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-md">{content.billingDescription}</p>
            </div>
            <div className="hidden sm:block w-48 shrink-0">
              <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
                <div className="text-[10px] text-muted-foreground mb-2">Receipt #1042</div>
                <div className="space-y-1.5 text-[11px]">
                  {[['Carbonara', '$18'], ['Margherita', '$14'], ['Tiramisu', '$8']].map(([n, p], i) => (
                    <div key={i} className="flex justify-between text-foreground">
                      <span>{n}</span><span className="tabular-nums">{p}</span>
                    </div>
                  ))}
                  <div className="pt-2 mt-2 border-t border-border flex justify-between font-semibold text-foreground">
                    <span>Total</span><span className="tabular-nums">$40</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </Section>
  );
}
