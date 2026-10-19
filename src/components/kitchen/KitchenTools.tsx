import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { kitchenMenuSchema, kitchenHistorySchema, kitchenReportSchema, preparationMinutes } from '@/lib/kitchen';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { usePrintTicket } from '@/components/kitchen/KitchenTicketPrint';
import { useSettings } from '@/hooks/useSettings';
import { Printer, Clock, ChefHat, AlertTriangle, CheckCircle2 } from 'lucide-react';

function QueryState({ pending, failed, retry }: { pending: boolean; failed: boolean; retry: () => void }) {
  if (pending) return <p role="status" className="p-8 text-center text-muted-foreground">Loading kitchen data…</p>;
  if (failed) return <div role="alert" className="space-y-3 rounded-xl border p-6 text-center"><p>Couldn’t load kitchen data.</p><Button variant="outline" onClick={retry}>Try again</Button></div>;
  return null;
}

export function KitchenAvailability({ restaurantId }: { restaurantId: string }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const client = useQueryClient();
  const menu = useQuery({
    queryKey: ['kitchen_menu', restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kitchen_menu', { _restaurant: restaurantId });
      if (error) throw error;
      return kitchenMenuSchema.parse(data);
    }, refetchInterval: 10000,
  });
  const change = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.rpc('kitchen_set_availability', { _restaurant: restaurantId, _item: id, _available: available });
      if (error) throw error;
    }, onSuccess: () => {
      for (const key of ['kitchen_menu', 'menu_items', 'pos_menu_items']) void client.invalidateQueries({ queryKey: [key] });
      toast.success('Menu availability updated');
    }, onError: (error: Error) => toast.error(error.message),
  });
  const items = (menu.data ?? []).filter(item => `${item.name} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase()) && (filter === 'all' || item.is_available === (filter === 'available')));
  return <section className="space-y-4" aria-labelledby="availability-heading">
    <div><h2 id="availability-heading" className="text-xl font-bold">Menu availability</h2><p className="mt-1 text-sm text-muted-foreground">Hide sold-out dishes from new orders. Existing orders stay on the kitchen queue.</p></div>
    <div className="flex flex-col gap-3 sm:flex-row"><Input type="search" aria-label="Search menu availability" placeholder="Search dish or category…" value={search} onChange={event => setSearch(event.target.value)} className="h-11" /><select aria-label="Availability filter" value={filter} onChange={event => setFilter(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="all">All dishes</option><option value="available">Available</option><option value="unavailable">Sold out</option></select></div>
    <QueryState pending={menu.isPending} failed={menu.isError} retry={() => void menu.refetch()} />
    {menu.data && <><p className="text-xs text-muted-foreground">{menu.data.filter(item => !item.is_available).length} sold out · {menu.data.length} dishes in your permitted branches</p><div className="space-y-2">{items.map(item => <div key={item.id} className="flex min-w-0 items-center gap-3 rounded-xl border bg-card p-4"><div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{item.name}</p><p className="mt-1 text-xs text-muted-foreground">{item.category} · {item.is_available ? 'Available' : 'Sold out'}</p></div><Switch aria-label={`${item.name} availability`} checked={item.is_available} disabled={change.isPending} onCheckedChange={available => change.mutate({ id: item.id, available })} /></div>)}{items.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No dishes match this view.</p>}</div></>}
  </section>;
}

function RangeSelect({ days, setDays }: { days: number; setDays: (value: number) => void }) {
  return <select aria-label="Kitchen date range" value={days} onChange={event => setDays(Number(event.target.value))} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value={1}>Last 24 hours</option><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option></select>;
}

export function KitchenHistory({ restaurantId }: { restaurantId: string }) {
  const [days, setDays] = useState(1), [offset, setOffset] = useState(0);
  const { data: settings } = useSettings();
  const { printTicket } = usePrintTicket(settings?.restaurant_name);
  const history = useQuery({
    queryKey: ['kitchen_history', restaurantId, days, offset],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kitchen_history', { _restaurant: restaurantId, _days: days, _offset: offset });
      if (error) throw error;
      return kitchenHistorySchema.parse(data);
    }, refetchInterval: 15000,
  });
  return <section className="space-y-4" aria-labelledby="history-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="history-heading" className="text-xl font-bold">Prepared ticket history</h2><p className="mt-1 text-sm text-muted-foreground">Ready, served and completed tickets. Cancelled orders are excluded.</p></div><RangeSelect days={days} setDays={value => { setDays(value); setOffset(0); }} /></div>
    <QueryState pending={history.isPending} failed={history.isError} retry={() => void history.refetch()} />
    {history.data && <><p className="text-xs text-muted-foreground">{history.data.total} prepared tickets</p><div className="space-y-3">{history.data.orders.map(order => {
      const minutes = preparationMinutes(order.kitchen_started_at, order.kitchen_ready_at);
      const late = minutes != null && order.kitchen_target_minutes != null && minutes > order.kitchen_target_minutes;
      return <article key={order.id} className="space-y-3 rounded-xl border bg-card p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{order.table_label} <span className="text-sm text-muted-foreground">#{order.ticket_number ?? order.id.slice(0, 8)}</span></h3><p className="mt-1 text-xs capitalize text-muted-foreground">{order.status} · {order.kitchen_ready_at ? `Prepared ${format(new Date(order.kitchen_ready_at), 'MMM d, HH:mm')}` : 'Preparation time not recorded'}</p></div><Button variant="outline" size="icon" aria-label={`Reprint ticket ${order.ticket_number ?? order.id.slice(0, 8)}`} className="h-11 w-11 shrink-0" onClick={() => printTicket({ ...order, items: order.items.map(item => ({ ...item, notes: item.notes ?? null, selected_tags: item.selected_tags ?? [], prep_time_minutes: item.prep_time_minutes ?? null, name: item.name!, quantity: item.quantity! })), id: order.id!, status: order.status!, created_at: order.created_at!, notes: order.notes ?? null, estimated_prep_minutes: order.kitchen_target_minutes })}><Printer className="h-4 w-4" /></Button></div>
        <p className={`flex items-center gap-2 text-sm ${late ? 'text-destructive' : 'text-muted-foreground'}`}><Clock className="h-4 w-4" />{minutes == null ? 'Timing not tracked' : `${minutes.toFixed(1)} min cooking · target ${order.kitchen_target_minutes ?? '—'} min${late ? ' · Delayed' : ''}`}</p>
        <details className="text-sm"><summary className="cursor-pointer py-2 font-medium">View items ({order.items.reduce((sum, item) => sum + item.quantity, 0)})</summary><ul className="mt-2 space-y-2">{order.items.map(item => <li key={item.id}><span>{item.quantity}× {item.name}</span>{item.notes && <p className="mt-1 break-words text-xs text-muted-foreground">{item.notes}</p>}</li>)}</ul>{order.notes && <p className="mt-3 break-words text-sm">{order.notes}</p>}</details>
      </article>;
    })}{history.data.orders.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No prepared tickets in this period.</p>}</div>
      <div className="flex items-center justify-between gap-3"><Button variant="outline" className="h-11" disabled={offset === 0} onClick={() => setOffset(value => Math.max(0, value - 25))}>Previous</Button><span className="text-xs text-muted-foreground">Page {offset / 25 + 1}</span><Button variant="outline" className="h-11" disabled={offset + 25 >= history.data.total || offset >= 10000} onClick={() => setOffset(value => value + 25)}>Next</Button></div>
    </>}
  </section>;
}

export function KitchenReports({ restaurantId }: { restaurantId: string }) {
  const [days, setDays] = useState(7);
  const report = useQuery({
    queryKey: ['kitchen_report', restaurantId, days],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('kitchen_report', { _restaurant: restaurantId, _days: days });
      if (error) throw error;
      return kitchenReportSchema.parse(data);
    }, refetchInterval: 30000,
  });
  const summary = report.data?.summary;
  return <section className="space-y-5" aria-labelledby="reports-heading">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="reports-heading" className="text-xl font-bold">Preparation reports</h2><p className="mt-1 text-sm text-muted-foreground">Cooking start to ready, compared with the original preparation target.</p></div><RangeSelect days={days} setDays={setDays} /></div>
    <QueryState pending={report.isPending} failed={report.isError} retry={() => void report.refetch()} />
    {summary && <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
        { label: 'Prepared tickets', value: summary.prepared, icon: ChefHat },
        { label: 'Average cooking time', value: summary.average_minutes == null ? '—' : `${summary.average_minutes} min`, icon: Clock },
        { label: 'On time', value: summary.on_time_percent == null ? '—' : `${summary.on_time_percent}%`, icon: CheckCircle2 },
        { label: 'Delayed tickets', value: summary.late, icon: AlertTriangle },
      ].map(metric => <div key={metric.label} className="rounded-xl border bg-card p-4"><metric.icon className="mb-3 h-5 w-5 text-muted-foreground" /><p className="text-xl font-bold tabular-nums">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></div>)}</div>
      <p className="text-sm text-muted-foreground">Average delay across tracked tickets: {summary.average_delay_minutes == null ? '—' : `${summary.average_delay_minutes} min`}.</p>
      {summary.prepared === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">No tracked preparations in this period. Reports start when new tickets are cooked and marked ready.</p> : <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-left text-sm"><caption className="sr-only">Daily kitchen preparation performance in UTC</caption><thead className="bg-secondary/40"><tr>{['Date (UTC)', 'Prepared', 'Average', 'Delayed'].map(label => <th key={label} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead><tbody>{report.data.daily.map(row => <tr key={row.day} className="border-t"><td className="whitespace-nowrap p-3">{row.day}</td><td className="p-3 tabular-nums">{row.prepared}</td><td className="whitespace-nowrap p-3 tabular-nums">{row.average_minutes} min</td><td className="p-3 tabular-nums">{row.late}</td></tr>)}</tbody></table></div>}
      <p className="text-xs leading-5 text-muted-foreground">Rolling time range; daily groups use UTC. Only tickets with recorded cooking start, ready time and target are included. Cancelled and older untracked tickets are excluded. Extending an ETA does not change the original reporting target.</p>
    </>}
  </section>;
}
