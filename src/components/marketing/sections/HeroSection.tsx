import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Check, Bell, QrCode } from 'lucide-react';
import ProductPreviewFrame from '@/components/marketing/ProductPreviewFrame';
import { Button } from '@/components/ui/button';
import type { HeroContent } from '@/lib/marketing-sections';

export default function HeroSection({ content }: { content: HeroContent }) {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, hsl(var(--foreground) / 0.18) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 75%)',
        }}
      />
      <div className="absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1100px] h-[600px] rounded-full bg-primary/15 blur-[140px]" />
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-10 pt-16 pb-14 sm:pt-32 sm:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="max-w-4xl mx-auto text-center"
        >
          {content.pillText && (
            <Link to={content.pillHref || '#'} className="inline-flex items-center gap-2 rounded-full border border-border bg-card/70 backdrop-blur pl-1 pr-4 py-1 text-xs font-medium text-foreground hover:border-primary/40 transition-colors shadow-sm">
              {content.pillBadge && (
                <span className="rounded-full bg-primary px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
                  {content.pillBadge}
                </span>
              )}
              <span className="text-muted-foreground">{content.pillText}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
            </Link>
          )}

          <h1 className="mt-7 text-4xl sm:text-5xl lg:text-[68px] font-semibold tracking-tight text-foreground leading-[1.05]">
            {content.title}
            <span className="block">
              {content.titleConnector}{' '}
              <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
                {content.titleHighlight}
              </span>
            </span>
          </h1>

          <p className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {content.description}
          </p>

          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            {content.primaryCtaLabel && (
              <Link to={content.primaryCtaHref || '#'}>
                <Button size="lg" className="gap-2 px-7 h-12 text-base shadow-lg shadow-primary/25">
                  {content.primaryCtaLabel}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {content.secondaryCtaLabel && (
              <Link to={content.secondaryCtaHref || '#'}>
                <Button size="lg" variant="outline" className="gap-2 px-7 h-12 text-base bg-card/70 backdrop-blur">
                  {content.secondaryCtaLabel}
                </Button>
              </Link>
            )}
          </div>

          {content.trustBadges?.length > 0 && (
            <div className="mt-6 flex items-center justify-center gap-5 text-xs text-muted-foreground flex-wrap">
              {content.trustBadges.map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-primary" /> {b}
                </span>
              ))}
            </div>
          )}
        </motion.div>

        {content.showAppPreview && (
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="mt-12 sm:mt-24 relative"
          >
            <ProductPreviewFrame panel="owner" url="serveos.net · Owner dashboard" />

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.6 }}
              className="absolute -left-4 sm:-left-10 top-1/3 hidden md:flex items-center gap-3 rounded-xl bg-card border border-border shadow-xl p-3 pr-5"
            >
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <Bell className="h-5 w-5 text-success" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">New order · Table 7</div>
                <div className="text-[10px] text-muted-foreground">3 items · just now</div>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.75 }}
              className="absolute -right-4 sm:-right-8 -bottom-6 hidden md:flex items-center gap-3 rounded-xl bg-card border border-border shadow-xl p-3 pr-5"
            >
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <QrCode className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground">Sent to kitchen</div>
                <div className="text-[10px] text-muted-foreground">Straight from the table QR</div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
