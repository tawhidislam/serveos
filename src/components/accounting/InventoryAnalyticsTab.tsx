import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { format, subDays, addDays, differenceInCalendarDays, parseISO } from 'date-fns';
import { TrendingDown, CalendarClock, AlertOctagon, Activity } from 'lucide-react';

interface Props {
  restaurantId?: string;
  items: any[];
}

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '60', label: 'Last 60 days' },
  { value: '90', label: 'Last 90 days' },
];

const OUTFLOW_TYPES = ['usage', 'waste'];

function txDate(t: any): string {
  return (t.transaction_date as string) ?? String(t.created_at).slice(0, 10);
}

/** Signed stock effect of a transaction (positive = stock added). */
function txDelta(t: any): number {
  const q = Number(t.quantity ?? 0);
  return OUTFLOW_TYPES.includes(t.type) ? -q : q;
}

export default function InventoryAnalyticsTab({ restaurantId, items }: Props) {
  const { format: fc } = useCurrency();
  const [range, setRange] = useState('30');
  const days = Number(range);
  const since = useMemo(() => subDays(new Date(), days), [days]);

  const { data: txs = [], isLoading } = useQuery({
    queryKey: ['inventory-analytics-tx', restaurantId ?? 'none', range],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('id, item_id, type, quantity, total_cost, transaction_date, created_at')
        .eq('restaurant_id', restaurantId!)
        .gte('transaction_date', format(since, 'yyyy-MM-dd'))
        .order('transaction_date', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeItems = useMemo(() => items.filter(i => i.is_active), [items]);
  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

  /** Daily usage trend (quantity out and cost of goods used). */
  const usageTrend = useMemo(() => {
    const buckets: Record<string, { date: string; usage: number; waste: number; cost: number }> = {};
    for (let d = 0; d < days; d++) {
      const key = format(subDays(new Date(), days - 1 - d), 'yyyy-MM-dd');
      buckets[key] = { date: key, usage: 0, waste: 0, cost: 0 };
    }
    txs.forEach((t: any) => {
      const key = txDate(t);
      const b = buckets[key];
      if (!b) return;
      const q = Number(t.quantity ?? 0);
      if (t.type === 'usage') b.usage += q;
      if (t.type === 'waste') b.waste += q;
      if (OUTFLOW_TYPES.includes(t.type)) b.cost += Number(t.total_cost ?? 0);
    });
    return Object.values(buckets).map(b => ({
      ...b,
      label: format(parseISO(b.date), 'MMM d'),
      usage: Number(b.usage.toFixed(2)),
      waste: Number(b.waste.toFixed(2)),
      cost: Number(b.cost.toFixed(2)),
    }));
  }, [txs, days]);

  /** Per-item consumption + reorder projections. */
  const perItem = useMemo(() => {
    const consumed: Record<string, { qty: number; cost: number }> = {};
    txs.forEach((t: any) => {
      if (!OUTFLOW_TYPES.includes(t.type)) return;
      const c = (consumed[t.item_id] ||= { qty: 0, cost: 0 });
      c.qty += Number(t.quantity ?? 0);
      c.cost += Number(t.total_cost ?? 0);
    });

    return activeItems
      .map(item => {
        const c = consumed[item.id] ?? { qty: 0, cost: 0 };
        const avgDaily = c.qty / days;
        const stock = Number(item.current_stock ?? 0);
        const min = Number(item.min_stock ?? 0);
        const daysToMin = avgDaily > 0 ? (stock - min) / avgDaily : null;
        const daysToOut = avgDaily > 0 ? stock / avgDaily : null;
        return {
          ...item,
          consumedQty: c.qty,
          consumedCost: c.cost,
          avgDaily,
          daysToMin,
          daysToOut,
          reorderDate:
            daysToMin === null ? null : addDays(new Date(), Math.max(0, Math.floor(daysToMin))),
          stockoutDate:
            daysToOut === null ? null : addDays(new Date(), Math.max(0, Math.floor(daysToOut))),
        };
      })
      .sort((a, b) => {
        const av = a.daysToMin ?? Number.POSITIVE_INFINITY;
        const bv = b.daysToMin ?? Number.POSITIVE_INFINITY;
        return av - bv;
      });
  }, [activeItems, txs, days]);

  const topConsumed = useMemo(
    () =>
      [...perItem]
        .filter(i => i.consumedQty > 0)
        .sort((a, b) => b.consumedCost - a.consumedCost)
        .slice(0, 8)
        .map(i => ({ name: i.name, cost: Number(i.consumedCost.toFixed(2)), qty: Number(i.consumedQty.toFixed(2)) })),
    [perItem],
  );

  /**
   * Stockout history — reconstructs each item's stock level backwards from its
   * current value using transaction deltas, then detects periods at or below zero.
   */
  const stockouts = useMemo(() => {
    const byItem: Record<string, any[]> = {};
    txs.forEach((t: any) => {
      (byItem[t.item_id] ||= []).push(t);
    });

    const events: { itemId: string; name: string; start: string; end: string | null; days: number }[] = [];

    activeItems.forEach(item => {
      const list = (byItem[item.id] ?? [])
        .slice()
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));
      if (list.length === 0) return;

      // Walk backwards to find the stock level before the earliest transaction.
      let level = Number(item.current_stock ?? 0);
      for (let i = list.length - 1; i >= 0; i--) level -= txDelta(list[i]);

      let openStart: string | null = null;
      list.forEach(t => {
        level += txDelta(t);
        const date = txDate(t);
        if (level <= 0 && !openStart) {
          openStart = date;
        } else if (level > 0 && openStart) {
          events.push({
            itemId: item.id,
            name: item.name,
            start: openStart,
            end: date,
            days: Math.max(1, differenceInCalendarDays(parseISO(date), parseISO(openStart))),
          });
          openStart = null;
        }
      });

      if (openStart) {
        events.push({
          itemId: item.id,
          name: item.name,
          start: openStart,
          end: null,
          days: Math.max(1, differenceInCalendarDays(new Date(), parseISO(openStart))),
        });
      }
    });

    return events.sort((a, b) => b.start.localeCompare(a.start));
  }, [activeItems, txs]);

  const totals = useMemo(() => {
    const cost = perItem.reduce((s, i) => s + i.consumedCost, 0);
    const reorderSoon = perItem.filter(i => i.daysToMin !== null && i.daysToMin <= 7).length;
    const ongoing = stockouts.filter(s => !s.end).length;
    return { cost, reorderSoon, ongoing, events: stockouts.length };
  }, [perItem, stockouts]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Inventory Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Usage trends, stockout history and estimated reorder dates per ingredient.
          </p>
        </div>
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RANGES.map(r => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Activity className="h-3.5 w-3.5" /> Consumed value
            </div>
            <p className="text-xl font-semibold text-foreground">{fc(totals.cost)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CalendarClock className="h-3.5 w-3.5" /> Reorder within 7 days
            </div>
            <p className="text-xl font-semibold text-foreground">{totals.reorderSoon}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <AlertOctagon className="h-3.5 w-3.5" /> Stockout events
            </div>
            <p className="text-xl font-semibold text-foreground">{totals.events}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingDown className="h-3.5 w-3.5" /> Currently out
            </div>
            <p className="text-xl font-semibold text-foreground">{totals.ongoing}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily usage trend</CardTitle>
            <CardDescription>Quantity consumed and wasted per day</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={usageTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="usage" name="Usage" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.2} />
                <Area type="monotone" dataKey="waste" name="Waste" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.15} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top ingredients by consumed value</CardTitle>
            <CardDescription>Highest cost of goods used in the period</CardDescription>
          </CardHeader>
          <CardContent>
            {topConsumed.length === 0 ? (
              <p className="text-sm text-muted-foreground py-16 text-center">No consumption recorded yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topConsumed} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="cost" name="Consumed value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Reorder forecast per ingredient</CardTitle>
          <CardDescription>
            Based on average daily consumption over the selected period
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead className="text-right">In stock</TableHead>
                  <TableHead className="text-right">Avg / day</TableHead>
                  <TableHead className="text-right">Days left</TableHead>
                  <TableHead>Reorder by</TableHead>
                  <TableHead>Est. stockout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell>
                  </TableRow>
                )}
                {!isLoading && perItem.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">No active ingredients</TableCell>
                  </TableRow>
                )}
                {perItem.map(i => {
                  const urgent = i.daysToMin !== null && i.daysToMin <= 3;
                  const soon = i.daysToMin !== null && i.daysToMin <= 7;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-medium">{i.name}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(i.current_stock).toFixed(2)} {i.unit}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.avgDaily > 0 ? `${i.avgDaily.toFixed(2)} ${i.unit}` : '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {i.daysToOut === null ? '—' : Math.max(0, Math.floor(i.daysToOut))}
                      </TableCell>
                      <TableCell>
                        {i.reorderDate === null ? (
                          <span className="text-muted-foreground text-sm">No usage data</span>
                        ) : (
                          <Badge
                            variant="outline"
                            className={
                              urgent
                                ? 'text-destructive border-destructive/40 bg-destructive/10'
                                : soon
                                ? 'text-orange-600 border-orange-500/40 bg-orange-500/10'
                                : ''
                            }
                          >
                            {format(i.reorderDate, 'MMM d, yyyy')}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {i.stockoutDate === null ? '—' : format(i.stockoutDate, 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Stockout history</CardTitle>
          <CardDescription>
            Periods where an ingredient's reconstructed stock level dropped to zero
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ingredient</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Resolved</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stockouts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No stockouts in this period
                    </TableCell>
                  </TableRow>
                )}
                {stockouts.slice(0, 30).map((s, idx) => (
                  <TableRow key={`${s.itemId}-${s.start}-${idx}`}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{format(parseISO(s.start), 'MMM d, yyyy')}</TableCell>
                    <TableCell>{s.end ? format(parseISO(s.end), 'MMM d, yyyy') : '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{s.days}d</TableCell>
                    <TableCell>
                      {s.end ? (
                        <Badge variant="secondary">Restocked</Badge>
                      ) : (
                        <Badge variant="outline" className="text-destructive border-destructive/40 bg-destructive/10">
                          Ongoing
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
