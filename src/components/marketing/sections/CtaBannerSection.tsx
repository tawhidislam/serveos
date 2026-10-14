import { Link } from 'react-router-dom';
import { ArrowRight, Check, Shield, Zap } from 'lucide-react';
import { Section } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import type { CtaBannerContent } from '@/lib/marketing-sections';

export default function CtaBannerSection({ content }: { content: CtaBannerContent }) {
  return (
    <Section>
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-10 sm:p-16 text-center">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] rounded-full bg-primary/15 blur-[100px]" />
        </div>
        <div className="flex justify-center mb-5">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Zap className="h-6 w-6 text-primary" />
          </div>
        </div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
          {content.title}
        </h2>
        <p className="mt-4 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
          {content.description}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          {content.primaryCtaLabel && (
            <Link to={content.primaryCtaHref || '#'}>
              <Button size="lg" className="gap-2 px-7 h-12 text-base shadow-lg shadow-primary/25">
                {content.primaryCtaLabel} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
          {content.secondaryCtaLabel && (
            <Link to={content.secondaryCtaHref || '#'}>
              <Button size="lg" variant="outline" className="px-7 h-12 text-base">
                {content.secondaryCtaLabel}
              </Button>
            </Link>
          )}
        </div>
        {content.trustBadges?.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-6 text-xs text-muted-foreground flex-wrap">
            {content.trustBadges.map((b, i) => (
              <span key={b + i} className="flex items-center gap-1.5">
                {i === 0 ? <Shield className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                {b}
              </span>
            ))}
          </div>
        )}
      </div>
    </Section>
  );
}
