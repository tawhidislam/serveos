import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowUpRight, ChefHat } from 'lucide-react';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';

interface FeaturedMenuProps {
  items: any[];
  format: (n: number) => string;
  heading?: string;
  overline?: string;
}

export default function FeaturedMenu({ items, format, heading, overline }: FeaturedMenuProps) {
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');
  return (
    <section className="py-24 bg-[#070707]">
      <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
        {/* Header */}
        <div className="flex items-end justify-between mb-12">
          <div>
            <p className="text-amber-500 text-sm font-semibold uppercase tracking-wider mb-2">{overline ?? 'Our Menu'}</p>
            <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
              {heading ?? 'Popular Dishes'}
            </h2>
          </div>
          <Link
            to={menuHref}
            className="hidden sm:inline-flex items-center gap-2 text-amber-500 hover:text-amber-400 text-sm font-semibold uppercase tracking-wider transition-colors"
          >
            View All <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(items || []).slice(0, 6).map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06, duration: 0.5 }}
              className="group bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-amber-500/20 transition-all duration-500"
            >
              <div className="aspect-[16/10] overflow-hidden relative">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                    <ChefHat className="h-8 w-8 text-white/[0.08]" />
                  </div>
                )}
              </div>
              <div className="p-5">
                <p className="text-amber-500/60 text-[11px] uppercase tracking-wider font-medium mb-1.5">
                  {(item as any).categories?.name}
                </p>
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-white font-semibold text-[15px]">{item.name}</h3>
                  <span className="text-amber-500 font-bold text-base tabular-nums shrink-0">
                    {format(item.price)}
                  </span>
                </div>
                {item.description && (
                  <p className="text-white/25 text-[13px] mt-2 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Mobile CTA */}
        <div className="text-center mt-8 sm:hidden">
          <Link
            to={menuHref}
            className="inline-flex items-center gap-2 text-amber-500 text-sm font-semibold uppercase tracking-wider"
          >
            View Full Menu <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
