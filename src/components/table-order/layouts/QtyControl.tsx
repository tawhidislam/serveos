import { motion } from 'framer-motion';
import { Plus, Minus, Sparkles } from 'lucide-react';

interface QtyControlProps {
  qty: number;
  hasAddons: boolean;
  onAdd: () => void;
  onUpdateQty: (n: number) => void;
  size?: 'sm' | 'md';
  compactLabel?: boolean;
}

/** Shared add / quantity stepper used by every ordering-page layout. */
export default function QtyControl({
  qty, hasAddons, onAdd, onUpdateQty, size = 'md', compactLabel = false,
}: QtyControlProps) {
  const btn = size === 'sm' ? 'h-6 w-6' : 'h-7 w-7';
  const icon = size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5';

  if (qty > 0) {
    return (
      <div className="flex items-center gap-0.5 bg-primary/10 rounded-full p-0.5">
        <button
          aria-label="Decrease quantity"
          onClick={(e) => { e.stopPropagation(); onUpdateQty(qty - 1); }}
          className={`${btn} flex items-center justify-center rounded-full bg-card text-card-foreground hover:bg-secondary transition-colors active:scale-95`}
        >
          <Minus className={icon} strokeWidth={2.5} />
        </button>
        <span className="text-xs font-bold tabular-nums w-6 text-center text-card-foreground">{qty}</span>
        <button
          aria-label="Increase quantity"
          onClick={(e) => { e.stopPropagation(); onAdd(); }}
          className={`${btn} flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors active:scale-95`}
        >
          <Plus className={icon} strokeWidth={2.5} />
        </button>
      </div>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.92 }}
      onClick={(e) => {
        e.stopPropagation();
        onAdd();
        if (!hasAddons && navigator.vibrate) navigator.vibrate(10);
      }}
      className={`${size === 'sm' ? 'h-7 px-3' : 'h-8 px-4'} flex items-center gap-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-all active:scale-95 shadow-sm shrink-0`}
    >
      {hasAddons ? (
        <>
          <Sparkles className="h-3 w-3" strokeWidth={2} />
          {compactLabel ? '' : 'Customize'}
        </>
      ) : (
        <>
          <Plus className="h-3 w-3" strokeWidth={2.5} />
          {compactLabel ? '' : 'Add'}
        </>
      )}
    </motion.button>
  );
}
