import { motion } from 'framer-motion';
import { BarChart3 } from 'lucide-react';

interface RevenueChartProps {
  data: { hour: number; revenue: number }[];
  formatInt: (n: number) => string;
}

export default function RevenueChart({ data, formatInt }: RevenueChartProps) {
  const maxRevenue = Math.max(...data.map(h => h.revenue), 1);
  const currentHour = new Date().getHours();
  const totalRevenue = data.reduce((sum, h) => sum + h.revenue, 0);

  return (
    <div className="bg-card rounded-xl p-6 ring-1 ring-border/50 h-full">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <BarChart3 className="h-4 w-4 text-primary" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-card-foreground">Revenue by Hour</h2>
            <p className="text-xs text-muted-foreground">Today's performance</p>
          </div>
        </div>
        {totalRevenue > 0 && (
          <span className="text-lg font-bold tabular-nums text-card-foreground">{formatInt(totalRevenue)}</span>
        )}
      </div>
      
      <div className="flex items-end gap-[2px] h-40">
        {data.map(({ hour, revenue }) => {
          const pct = maxRevenue > 0 ? (revenue / maxRevenue) * 100 : 0;
          const isNow = currentHour === hour;
          const isPast = hour < currentHour;
          return (
            <div key={hour} className="flex-1 flex flex-col items-center gap-1 group relative">
              <div className="w-full relative flex items-end" style={{ height: '100%' }}>
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(pct, 1)}%` }}
                  transition={{ duration: 0.5, delay: (hour - 6) * 0.025, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className={`w-full rounded-t transition-colors duration-150 ${
                    isNow
                      ? 'bg-primary shadow-sm'
                      : revenue > 0 && isPast
                      ? 'bg-primary/30 group-hover:bg-primary/50'
                      : revenue > 0
                      ? 'bg-primary/20'
                      : 'bg-border/40'
                  }`}
                  style={{ minHeight: '2px', borderRadius: '3px 3px 0 0' }}
                />
              </div>
              {hour % 3 === 0 && (
                <span className={`text-[10px] tabular-nums ${isNow ? 'text-primary font-semibold' : 'text-muted-foreground/70'}`}>
                  {hour > 12 ? `${hour - 12}p` : hour === 12 ? '12p' : `${hour}a`}
                </span>
              )}
              {revenue > 0 && (
                <div className="absolute bottom-full mb-2 bg-foreground text-background text-[10px] px-2 py-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
                  {formatInt(revenue)}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[4px] border-t-foreground" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
