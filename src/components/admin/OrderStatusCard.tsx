import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';

interface OrderStatusCardProps {
  statusBreakdown: Record<string, number>;
  todayOrders: number;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  pending: { label: 'Pending', color: 'text-warning', bg: 'bg-warning/15', bar: 'bg-warning' },
  confirmed: { label: 'Confirmed', color: 'text-primary', bg: 'bg-primary/10', bar: 'bg-primary/70' },
  preparing: { label: 'Preparing', color: 'text-primary', bg: 'bg-primary/10', bar: 'bg-primary' },
  ready: { label: 'Ready', color: 'text-success', bg: 'bg-success/15', bar: 'bg-success' },
  served: { label: 'Served', color: 'text-success', bg: 'bg-success/15', bar: 'bg-success/70' },
  completed: { label: 'Completed', color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground/40' },
  cancelled: { label: 'Cancelled', color: 'text-destructive', bg: 'bg-destructive/10', bar: 'bg-destructive/60' },
};

export default function OrderStatusCard({ statusBreakdown, todayOrders }: OrderStatusCardProps) {
  const entries = Object.entries(statusBreakdown).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-card rounded-xl p-6 ring-1 ring-border/50 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-warning" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Order Status</h2>
            <p className="text-xs text-muted-foreground">{todayOrders} total today</p>
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {entries.length > 0 ? (
          entries.map(([status, count], i) => {
            const pct = (count / (todayOrders || 1)) * 100;
            const config = statusConfig[status] ?? { label: status, color: 'text-muted-foreground', bg: 'bg-muted', bar: 'bg-muted-foreground/40' };
            return (
              <motion.div
                key={status}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${config.bar}`} />
                    <span className="text-xs font-medium text-card-foreground capitalize">{config.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground tabular-nums">{Math.round(pct)}%</span>
                    <span className="text-xs font-bold tabular-nums text-card-foreground w-5 text-right">{count}</span>
                  </div>
                </div>
                <div className="h-1.5 bg-secondary/80 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className={`h-full rounded-full ${config.bar}`}
                  />
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="text-center py-8">
            <Activity className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
            <p className="text-sm text-muted-foreground">No orders today</p>
          </div>
        )}
      </div>
    </div>
  );
}
