import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check } from 'lucide-react';
import { Section } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import ProductPreviewFrame from '@/components/marketing/ProductPreviewFrame';
import type { LiveDemoContent } from '@/lib/marketing-sections';

export default function LiveDemoSection({ content }: { content: LiveDemoContent }) {
  return (
    <Section className="py-14 sm:py-24">
      <div className="grid gap-10 lg:gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.5 }}
        >
          {content.eyebrow && (
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {content.eyebrow}
            </div>
          )}
          <h2 className="mt-4 text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">{content.title}</h2>
          {content.description && (
            <p className="mt-4 text-base text-muted-foreground leading-relaxed">{content.description}</p>
          )}
          {content.points?.length > 0 && (
            <ul className="mt-6 space-y-2.5">
              {content.points.map((p) => (
                <li key={p} className="flex items-center gap-2.5 text-sm text-foreground">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" />
                  </span>
                  {p}
                </li>
              ))}
            </ul>
          )}
          {content.ctaLabel && (
            <Link to={content.ctaHref || '/demo'} className="mt-8 inline-block w-full sm:w-auto">
              <Button size="lg" className="gap-2 h-12 px-7 w-full sm:w-auto shadow-lg shadow-primary/25">
                {content.ctaLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <Link to={content.ctaHref || '/demo'} aria-label={content.ctaLabel || 'Open the live demo'} className="block group">
            <ProductPreviewFrame
              panel="kitchen"
              url="serveos.net/demo · Kitchen display"
              heightClassName="h-[320px] sm:h-[460px]"
              className="transition-transform duration-300 group-hover:-translate-y-1"
            />
          </Link>
        </motion.div>
      </div>
    </Section>
  );
}
