import { motion } from 'framer-motion';
import { Plus, Minus, ChefHat, SlidersHorizontal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';

interface MenuItemCardProps {
  item: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    image_url: string | null;
    custom_slug?: string | null;
  };
  qty: number;
  formattedPrice: string;
  onAdd: () => void;
  onUpdateQty: (newQty: number) => void;
  index: number;
  hasAddons?: boolean;
  waiterMode?: boolean;
}

export default function MenuItemCard({
  item, qty, formattedPrice, onAdd, onUpdateQty, index, hasAddons, waiterMode,
}: MenuItemCardProps) {
  const navigate = useNavigate();
  const { withPrefix } = useWebsitePrefix();
  const handleNavigate = () => navigate(withPrefix(`/menu/${item.custom_slug || item.id}`));
  // Waiter mode: simpler card with theme tokens
  if (waiterMode) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.04, duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="group bg-card rounded-2xl overflow-hidden card-shadow hover:card-shadow-hover transition-shadow duration-300"
      >
        <div className="relative aspect-[16/10] overflow-hidden">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <ChefHat className="h-8 w-8 text-muted-foreground/20" strokeWidth={1} />
            </div>
          )}
          <div className="absolute bottom-2 left-2 bg-card/90 backdrop-blur-sm rounded-full px-3 py-1">
            <span className="text-sm font-bold tabular-nums text-foreground">{formattedPrice}</span>
          </div>
        </div>
        <div className="p-3.5">
          <h3 onClick={handleNavigate} className="font-semibold text-card-foreground text-[15px] leading-snug cursor-pointer hover:text-primary transition-colors">{item.name}</h3>
          {item.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{item.description}</p>}
          <div className="mt-3">
            {qty > 0 ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-0.5 bg-primary/10 rounded-full p-0.5">
                  <button onClick={() => onUpdateQty(qty - 1)} className="h-8 w-8 flex items-center justify-center rounded-full bg-card text-foreground hover:bg-secondary transition-colors active:scale-95">
                    <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                  <span className="text-sm font-bold tabular-nums w-8 text-center text-foreground">{qty}</span>
                  <button onClick={onAdd} className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </div>
                <span className="text-xs font-medium text-muted-foreground">in cart</span>
              </div>
            ) : (
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => { onAdd(); if (!hasAddons && navigator.vibrate) navigator.vibrate(10); }}
                className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all active:scale-[0.98]">
                {hasAddons ? <><SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />Customize</> : <><Plus className="h-4 w-4" strokeWidth={2.5} />Add</>}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    );
  }

  // Public website mode: luxury dark aesthetic
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05, duration: 0.5 }}
      className="group bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-amber-500/20 transition-all duration-500"
    >
      <div className="aspect-[16/10] overflow-hidden relative">
        {item.image_url ? (
          <img
            src={item.image_url}
            alt={item.name}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
            <ChefHat className="h-8 w-8 text-white/[0.08]" />
          </div>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      </div>

      <div className="p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1.5">
          <h3 onClick={handleNavigate} className="text-white font-semibold text-[15px] leading-snug cursor-pointer hover:text-amber-400 transition-colors">{item.name}</h3>
          <span className="text-amber-500 font-bold text-base tabular-nums shrink-0">
            {formattedPrice}
          </span>
        </div>
        {item.description && (
          <p className="text-white/25 text-[13px] line-clamp-2 leading-relaxed mb-4">
            {item.description}
          </p>
        )}

        <div>
          {qty > 0 ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-0.5 bg-amber-500/10 rounded-full p-0.5">
                <button
                  onClick={() => onUpdateQty(qty - 1)}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12] transition-colors active:scale-95"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
                <span className="text-sm font-bold tabular-nums w-8 text-center text-white">{qty}</span>
                <button
                  onClick={onAdd}
                  className="h-8 w-8 flex items-center justify-center rounded-full bg-amber-500 text-black hover:bg-amber-400 transition-colors active:scale-95"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                </button>
              </div>
              <span className="text-xs font-medium text-amber-500/60">in cart</span>
            </div>
          ) : (
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                onAdd();
                if (!hasAddons && navigator.vibrate) navigator.vibrate(10);
              }}
              className="w-full h-10 flex items-center justify-center gap-2 rounded-full bg-amber-500 text-black text-sm font-bold hover:bg-amber-400 transition-all duration-300 hover:shadow-[0_6px_20px_rgba(245,158,11,0.25)] active:scale-[0.98]"
            >
              {hasAddons ? (
                <>
                  <SlidersHorizontal className="h-4 w-4" strokeWidth={2.5} />
                  Customize
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                  Add to Order
                </>
              )}
            </motion.button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
