import { useActivePromotions, isHappyHourActive, type Promotion } from '@/hooks/usePromotions';
import { Tag, Clock, Percent, Gift } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PromoBanner() {
  const { data: promos = [] } = useActivePromotions();

  // Filter to auto-apply or visible promos, and active happy hours
  const visible = promos.filter(p => {
    if (p.type === 'happy_hour' && !isHappyHourActive(p)) return false;
    if (p.max_uses && p.used_count >= p.max_uses) return false;
    return true;
  }).slice(0, 3);

  if (visible.length === 0) return null;

  const getIcon = (type: string) => {
    switch (type) {
      case 'happy_hour': return Clock;
      case 'first_order': return Gift;
      default: return Percent;
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-3">
      <AnimatePresence>
        <div className="space-y-2">
          {visible.map((promo, i) => {
            const Icon = getIcon(promo.type);
            return (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="flex items-center gap-2.5 bg-primary/5 border border-primary/15 rounded-xl px-3.5 py-2.5"
              >
                <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-card-foreground truncate">{promo.name}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {promo.type === 'fixed' ? `$${promo.discount_value} off` : `${promo.discount_value}% off`}
                    {promo.min_order_amount > 0 && ` on orders $${promo.min_order_amount}+`}
                    {promo.promo_code && ` · Code: ${promo.promo_code}`}
                  </p>
                </div>
                {promo.promo_code && (
                  <span className="shrink-0 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-mono font-bold">
                    {promo.promo_code}
                  </span>
                )}
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
