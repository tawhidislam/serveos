import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, MapPin } from 'lucide-react';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';

interface CTASectionProps {
  content?: {
    overline?: string;
    heading_line1?: string;
    heading_line2?: string;
    description?: string;
    cta_primary_text?: string;
    cta_primary_link?: string;
    cta_secondary_text?: string;
    cta_secondary_link?: string;
  };
}

export default function CTASection({ content }: CTASectionProps) {
  const c = content || {};
  const { withPrefix } = useWebsitePrefix();
  const overline = c.overline ?? 'Reserve Your Table';
  const line1 = c.heading_line1 ?? 'Ready for an';
  const line2 = c.heading_line2 ?? 'Unforgettable Evening?';
  const desc = c.description ?? 'Browse our menu and place your order online for an unforgettable dine-in or takeout experience.';
  const ctaPrimaryText = c.cta_primary_text ?? 'Order Online';
  const ctaPrimaryLink = c.cta_primary_link ?? '/menu';
  const ctaSecondaryText = c.cta_secondary_text ?? 'Find Us';
  const ctaSecondaryLink = c.cta_secondary_link ?? '/contact';

  return (
    <section className="py-32 bg-[#070707] relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-amber-500/[0.03] blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 text-center relative z-10">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <p className="text-amber-500 text-sm font-semibold uppercase tracking-wider mb-4">{overline}</p>
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold text-white leading-tight mb-6">
            {line1}<br />{line2}
          </h2>
          <p className="text-white/30 max-w-md mx-auto mb-10 leading-relaxed">{desc}</p>

          <div className="flex flex-wrap justify-center gap-3">
            <Link to={withPrefix(ctaPrimaryLink)}>
              <button className="h-13 px-10 py-3.5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(245,158,11,0.3)]">
                {ctaPrimaryText} <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            {ctaSecondaryText && (
              <Link to={withPrefix(ctaSecondaryLink)}>
                <button className="h-13 px-10 py-3.5 bg-white/[0.06] hover:bg-white/10 text-white font-medium text-sm uppercase tracking-wider rounded-full flex items-center gap-2.5 border border-white/[0.08] transition-all duration-300">
                  <MapPin className="h-4 w-4" /> {ctaSecondaryText}
                </button>
              </Link>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
