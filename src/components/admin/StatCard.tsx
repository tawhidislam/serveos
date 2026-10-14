import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  index: number;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
}

export default function StatCard({ label, value, icon: Icon, color, bgColor, index, trend, trendLabel }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="bg-card rounded-xl p-5 ring-1 ring-border/50 hover:ring-border transition-all duration-200 hover:shadow-md group"
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`h-10 w-10 rounded-xl ${bgColor} flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}>
          <Icon className={`h-[18px] w-[18px] ${color}`} strokeWidth={2} />
        </div>
        {trend && (
          <div className={`flex items-center gap-0.5 text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
            trend === 'up' ? 'text-success bg-success/10' :
            trend === 'down' ? 'text-destructive bg-destructive/10' :
            'text-muted-foreground bg-muted'
          }`}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> :
             trend === 'down' ? <ArrowDownRight className="h-3 w-3" /> :
             <Minus className="h-3 w-3" />}
            {trendLabel}
          </div>
        )}
      </div>
      <p className="text-[26px] font-bold tabular-nums tracking-tight text-card-foreground leading-none">{value}</p>
      <span className="text-[11px] font-medium text-muted-foreground mt-2 block uppercase tracking-wider">{label}</span>
    </motion.div>
  );
}
