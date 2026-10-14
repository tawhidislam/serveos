import { motion } from 'framer-motion';
import { Trophy, Flame } from 'lucide-react';

interface TopItemsCardProps {
  items: { name: string; count: number; revenue: number }[];
  format: (n: number) => string;
}

const medals = ['🥇', '🥈', '🥉'];

export default function TopItemsCard({ items, format }: TopItemsCardProps) {
  const maxCount = items[0]?.count ?? 1;

  return (
    <div className="bg-card rounded-xl p-6 ring-1 ring-border/50">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-warning" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Top Sellers</h2>
            <p className="text-xs text-muted-foreground">Best performing items today</p>
          </div>
        </div>
        {items.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <Flame className="h-3.5 w-3.5" strokeWidth={2} />
            {items.reduce((s, i) => s + i.count, 0)} sold
          </div>
        )}
      </div>
      {items.length > 0 ? (
        <div className="space-y-4">
          {items.map((item, i) => (
            <motion.div
              key={item.name}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07, duration: 0.35 }}
              className="group"
            >
              <div className="flex items-center gap-3">
                <span className="text-base w-6 text-center shrink-0">
                  {i < 3 ? medals[i] : (
                    <span className="text-xs font-bold text-muted-foreground">{i + 1}</span>
                  )}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-card-foreground truncate">{item.name}</span>
                    <div className="flex items-baseline gap-2 shrink-0 ml-3">
                      <span className="text-[11px] text-muted-foreground tabular-nums">{item.count}×</span>
                      <span className="text-sm font-bold tabular-nums text-card-foreground">{format(item.revenue)}</span>
                    </div>
                  </div>
                  <div className="h-1 bg-secondary/80 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.count / maxCount) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.07 }}
                      className={`h-full rounded-full ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-8">
          <Trophy className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" strokeWidth={1} />
          <p className="text-sm text-muted-foreground">No items sold today</p>
        </div>
      )}
    </div>
  );
}
