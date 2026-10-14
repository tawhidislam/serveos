import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';

interface CartFABProps {
  totalItems: number;
  totalAmount: string;
  visible: boolean;
  onClick: () => void;
  waiterMode?: boolean;
}

export default function CartFAB({ totalItems, totalAmount, visible, onClick, waiterMode }: CartFABProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          className="fixed bottom-5 left-4 right-4 z-40 max-w-lg mx-auto"
        >
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onClick}
            className={`w-full rounded-2xl p-4 flex items-center justify-between ${
              waiterMode
                ? 'bg-primary text-primary-foreground shadow-elevated'
                : 'bg-amber-500 text-black shadow-[0_8px_30px_rgba(245,158,11,0.3)]'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="relative">
                <ShoppingCart className="h-5 w-5" strokeWidth={1.5} />
                <motion.span
                  key={totalItems}
                  initial={{ scale: 0.5 }}
                  animate={{ scale: 1 }}
                  className={`absolute -top-2.5 -right-2.5 text-[11px] font-bold rounded-full h-5 w-5 flex items-center justify-center ${
                    waiterMode ? 'bg-card text-foreground' : 'bg-black text-amber-500'
                  }`}
                >
                  {totalItems}
                </motion.span>
              </div>
              <span className="font-bold">View Cart</span>
            </div>
            <span className="font-bold tabular-nums text-lg">{totalAmount}</span>
          </motion.button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
