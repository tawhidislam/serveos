import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ClipboardList, ChevronDown, Clock, Flame, UtensilsCrossed } from 'lucide-react';
import { formatDistanceToNowStrict } from 'date-fns';

interface Order {
  id: string;
  status: string;
  created_at: string;
  total_amount: number;
}

interface ActiveOrdersBannerProps {
  orders: Order[];
  expanded: boolean;
  onToggle: () => void;
  format: (n: number) => string;
}

const STATUS_MAP: Record<string, { label: string; icon: typeof Clock; colorClass: string }> = {
  pending: { label: 'Pending', icon: Clock, colorClass: 'text-warning' },
  confirmed: { label: 'Confirmed', icon: Clock, colorClass: 'text-warning' },
  preparing: { label: 'Preparing', icon: Flame, colorClass: 'text-primary' },
  ready: { label: 'Ready', icon: UtensilsCrossed, colorClass: 'text-success' },
};

export default function ActiveOrdersBanner({ orders, expanded, onToggle, format }: ActiveOrdersBannerProps) {
  if (orders.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="border-b border-border bg-primary/[0.03]"
    >
      <button
        onClick={onToggle}
        className="w-full max-w-2xl mx-auto px-4 py-2.5 flex items-center gap-3 text-left"
      >
        <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <ClipboardList className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
        </div>
        <p className="text-[13px] text-muted-foreground flex-1">
          <span className="text-primary font-bold">{orders.length}</span>{' '}
          active order{orders.length !== 1 ? 's' : ''}
        </p>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground/50 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="max-w-2xl mx-auto px-4 pb-3 space-y-2">
              {orders.map((order) => {
                const cfg = STATUS_MAP[order.status] || STATUS_MAP.pending;
                const StatusIcon = cfg.icon;
                return (
                  <Link
                    key={order.id}
                    to={`/order/${order.id}`}
                    className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border/60 hover:border-border hover:shadow-[var(--shadow-card)] transition-all"
                  >
                    <div className={`h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${cfg.colorClass}`}>
                      <StatusIcon className="h-4 w-4" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-card-foreground truncate">
                        Order #{order.id.slice(0, 6)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/70">
                        {formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${cfg.colorClass}`}>
                        {cfg.label}
                      </span>
                      <p className="text-xs text-muted-foreground font-medium tabular-nums mt-0.5">
                        {format(Number(order.total_amount))}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
