import { motion } from 'framer-motion';
import { ChefHat, Plus, Minus, Sparkles } from 'lucide-react';

interface TableMenuItemProps {
  item: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
  };
  qty: number;
  formattedPrice: string;
  onAdd: () => void;
  onUpdateQty: (n: number) => void;
  index: number;
  hasAddons: boolean;
}

export default function TableMenuItem({
  item, qty, formattedPrice, onAdd, onUpdateQty, index, hasAddons,
}: TableMenuItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-30px' }}
      transition={{ delay: index * 0.04, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="group relative flex gap-3.5 rounded-2xl p-3 bg-card border border-border/60 hover:border-border hover:shadow-[var(--shadow-card-hover)] transition-all duration-300"
    >
      {/* Image */}
      <div className="w-[88px] h-[88px] rounded-xl overflow-hidden shrink-0 bg-secondary">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ChefHat className="h-7 w-7 text-muted-foreground/20" strokeWidth={1} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <h3 className="text-card-foreground font-semibold text-[15px] leading-snug truncate">
            {item.name}
          </h3>
          {item.description && (
            <p className="text-muted-foreground text-[12px] line-clamp-2 leading-relaxed mt-0.5">
              {item.description}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between mt-2">
          <span className="text-primary font-bold text-[15px] tabular-nums">{formattedPrice}</span>

          {qty > 0 ? (
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-0.5 bg-primary/10 rounded-full p-0.5"
            >
              <button
                onClick={() => onUpdateQty(qty - 1)}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-card text-card-foreground hover:bg-secondary transition-colors active:scale-95"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <motion.span
                key={qty}
                initial={{ scale: 0.7 }}
                animate={{ scale: 1 }}
                className="text-xs font-bold tabular-nums w-6 text-center text-card-foreground"
              >
                {qty}
              </motion.span>
              <button
                onClick={onAdd}
                className="h-7 w-7 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </motion.div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => {
                onAdd();
                if (!hasAddons && navigator.vibrate) navigator.vibrate(10);
              }}
              className="h-8 px-4 flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-sm"
            >
              {hasAddons ? (
                <>
                  <Sparkles className="h-3 w-3" strokeWidth={2} />
                  Customize
                </>
              ) : (
                <>
                  <Plus className="h-3 w-3" strokeWidth={2.5} />
                  Add
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
