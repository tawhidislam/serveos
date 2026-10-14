import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { MousePointerClick } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  CTA_TYPE_LABELS,
  CTA_FULFILLMENT_LABELS,
  type CtaDestinationType,
  type CtaFulfillment,
} from '@/lib/cta-destinations';

type Row = { destination_type: string; fulfillment: string | null; destination: string; label: string | null };

const RANGES = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
];

function Bars({ data, total }: { data: { key: string; label: string; count: number }[]; total: number }) {
  if (!data.length) {
    return <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map(d => {
        const pct = total ? Math.round((d.count / total) * 100) : 0;
        return (
          <div key={d.key}>
            <div className="flex items-baseline justify-between text-xs mb-1">
              <span className="text-foreground truncate pr-2">{d.label}</span>
              <span className="text-muted-foreground shrink-0 tabular-nums">{d.count} · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function CtaAnalyticsCard() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [range, setRange] = useState('30');

  const { data, isLoading } = useQuery({
    queryKey: ['cta_click_analytics', restaurantId ?? 'none', range],
    enabled: !!restaurantId,
    queryFn: async () => {
      const since = new Date(Date.now() - Number(range) * 86400000).toISOString();
      const { data: rows, error } = await supabase
        .from('cta_clicks')
        .select('destination_type, fulfillment, destination, label')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (rows ?? []) as Row[];
    },
  });

  const rows = data ?? [];
  const total = rows.length;

  const tally = (pick: (r: Row) => string) => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const k = pick(r) || 'other';
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };

  const byType = tally(r => r.destination_type).map(([key, count]) => ({
    key,
    label: CTA_TYPE_LABELS[key as CtaDestinationType] ?? key,
    count,
  }));

  const byFulfillment = tally(r => r.fulfillment ?? 'none').map(([key, count]) => ({
    key,
    label: CTA_FULFILLMENT_LABELS[key as CtaFulfillment] ?? key,
    count,
  }));

  const topLinks = tally(r => r.destination).slice(0, 5);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0 pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <MousePointerClick className="h-4 w-4 text-primary" />
            Website CTA clicks
            {!!total && <span className="text-xs font-normal text-muted-foreground">({total} total)</span>}
          </CardTitle>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-popover z-50">
              {RANGES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">By destination type</p>
                <Bars data={byType} total={total} />
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-3">By fulfillment mode</p>
                <Bars data={byFulfillment} total={total} />
              </div>
              {topLinks.length > 0 && (
                <div className="md:col-span-2">
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Top links</p>
                  <ul className="space-y-1">
                    {topLinks.map(([dest, count]) => (
                      <li key={dest} className="flex items-center justify-between text-xs gap-3">
                        <span className="font-mono truncate text-muted-foreground">{dest}</span>
                        <span className="tabular-nums shrink-0">{count}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
