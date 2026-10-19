import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useCurrency } from '@/lib/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import {
  ClipboardList, ChefHat, Clock,
  CheckCircle2, Bell, Volume2, VolumeX,
  Timer, Hash, AlertCircle, ChevronDown, ArrowLeft, ArrowRightLeft, Printer, Pencil, Plus, Monitor, Search, X, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useStatusChangeNotification, useOrderNotification, playSoundPreset, getEventSoundPreset } from '@/hooks/useNotifications';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import WaiterLayout from '@/components/waiter/WaiterLayout';
import InvoiceReceipt, { type InvoiceData } from '@/components/InvoiceReceipt';
import { readPaymentAllocations } from '@/lib/pos-checkout';
import ModifyOrderDialog from '@/components/waiter/ModifyOrderDialog';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import type { Tables } from '@/integrations/supabase/types';
import { useKitchenUpdates } from '@/hooks/useKitchenUpdates';
import KitchenOrderUpdates from '@/components/kitchen/KitchenOrderUpdates';

type OrderFilter = 'all' | 'ready' | 'preparing' | 'pending' | 'served';
type WaiterOrder = Tables<'orders'> & {
  restaurant_tables: { label: string } | null;
  order_items: (Pick<Tables<'order_items'>, 'id' | 'quantity' | 'unit_price' | 'menu_item_id' | 'notes' | 'status'> & {
    menu_items: { name: string; price: number } | null;
  })[];
};

// ─── Status config ──────────────────────────────────────────
const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  ring: string;
  icon: typeof Clock;
  pulse?: boolean;
}> = {
  pending: {
    label: 'Pending',
    color: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    icon: Clock,
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    icon: Clock,
  },
  preparing: {
    label: 'Preparing',
    color: 'text-primary',
    bg: 'bg-primary/10',
    ring: 'ring-primary/20',
    icon: ChefHat,
  },
  ready: {
    label: 'Ready',
    color: 'text-success',
    bg: 'bg-success/10',
    ring: 'ring-success/30',
    icon: Bell,
    pulse: true,
  },
  served: {
    label: 'Served',
    color: 'text-muted-foreground',
    bg: 'bg-muted/50',
    ring: 'ring-border',
    icon: CheckCircle2,
  },
};

// ─── Time helper ────────────────────────────────────────────
function TimeAgo({ date }: { date: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);
  return <>{formatDistanceToNowStrict(new Date(date), { addSuffix: false })}</>;
}

// ─── Main Component ─────────────────────────────────────────
export default function WaiterDashboard() {
  const queryClient = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderFilter>('all');
  const [search, setSearch] = useState('');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [modifyOrder, setModifyOrder] = useState<WaiterOrder | null>(null);
  const [kitchenThread, setKitchenThread] = useState<WaiterOrder | null>(null);
  const seenKitchenUpdates = useRef<Set<string> | null>(null);
  const { data: settings } = useSettings();

  const handlePrintInvoice = (order: WaiterOrder) => {
    const items = (order.order_items ?? []).map((item) => ({
      name: item.menu_items?.name ?? 'Item',
      quantity: item.quantity,
      unitPrice: item.unit_price ?? item.menu_items?.price ?? 0,
      notes: item.notes,
    }));
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const taxRate = Number(order.tax_rate ?? settings?.tax_percentage ?? 0);
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = Number(order.discount_amount) || 0;
    const grandTotal = Number(order.total_amount);

    setInvoiceData({
      orderId: order.id,
      tableLabel: order.restaurant_tables?.label ?? null,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      paymentMethod: order.payment_method,
      paymentSplits: readPaymentAllocations(order.payment_splits),
      items,
      subtotal,
      taxRate,
      taxAmount,
      discountAmount,
      grandTotal,
    });
    setInvoiceOpen(true);
  };

  const { checkStatusChanges } = useStatusChangeNotification({
    targetStatus: 'ready',
    soundType: 'orderReady',
    enabled: soundEnabled,
    label: 'Order ready to serve',
  });

  const { checkForNew, requestPermission } = useOrderNotification({
    soundType: 'newOrder',
    enabled: soundEnabled,
    label: 'New order',
  });

  useEffect(() => { requestPermission(); }, [requestPermission]);

  const { data: activeOrders = [], isPending: ordersPending, isError: ordersError, refetch: refreshOrders, isFetching: ordersFetching } = useQuery({
    queryKey: ['waiter_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, unit_price, menu_item_id, notes, status, menu_items(name, price))')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: servedOrders = [], isPending: servedPending, isError: servedError, refetch: refreshServed } = useQuery({
    queryKey: ['waiter_served_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, unit_price, menu_item_id, notes, status, menu_items(name, price))')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'served')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 15000,
  });

  const kitchenUpdates = useKitchenUpdates(restaurantId, [...activeOrders, ...servedOrders].map(order => order.id));
  useEffect(() => { seenKitchenUpdates.current = null; }, [restaurantId]);
  useEffect(() => {
    if (!kitchenUpdates.isSuccess) return;
    if (seenKitchenUpdates.current) {
      const fresh = kitchenUpdates.data.filter(update => !seenKitchenUpdates.current!.has(update.id));
      if (fresh.length > 0) {
        toast.info(`Kitchen update: ${fresh[0].message}`);
        if (soundEnabled) playSoundPreset(getEventSoundPreset('generic'));
      }
    }
    seenKitchenUpdates.current = new Set(kitchenUpdates.data.map(update => update.id));
  }, [kitchenUpdates.data, kitchenUpdates.isSuccess, soundEnabled]);

  const { data: tables = [] } = useQuery({
    queryKey: ['restaurant_tables', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, label')
        .eq('restaurant_id', restaurantId!)
        .order('label');
      if (error) throw error;
      return data;
    },
  });

  // Waiter calls
  const prevCallCountRef = useRef(0);
  const { data: waiterCalls = [] } = useQuery({
    queryKey: ['waiter_calls_pending', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiter_calls')
        .select('id, table_id, created_at, status, restaurant_tables(label)')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });

  // Play audio when new waiter calls arrive
  useEffect(() => {
    if (waiterCalls.length > prevCallCountRef.current && prevCallCountRef.current !== 0 && soundEnabled) {
      playSoundPreset(getEventSoundPreset('waiterCall'));
    }
    prevCallCountRef.current = waiterCalls.length;
  }, [waiterCalls.length, soundEnabled]);

  useEffect(() => {
    checkForNew(activeOrders.map((o) => o.id));
  }, [activeOrders, checkForNew]);

  useEffect(() => {
    checkStatusChanges(activeOrders.map((o) => ({ id: o.id, status: o.status })));
  }, [activeOrders, checkStatusChanges]);

  useEffect(() => {
    const channel = supabase
      .channel('waiter-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
        queryClient.invalidateQueries({ queryKey: ['waiter_served_orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waiter_calls' }, () => {
        queryClient.invalidateQueries({ queryKey: ['waiter_calls_pending'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const dismissWaiterCall = useMutation({
    mutationFn: async (callId: string) => {
      const { error } = await supabase
        .from('waiter_calls')
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: null })
        .eq('id', callId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_calls_pending'] });
      toast.success('Call dismissed');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const order = activeOrders.find(order => order.id === orderId);
      if (!restaurantId || !order) throw new Error('Refresh the order before updating its status.');
      const { error } = await supabase.rpc('staff_set_order_status', { _restaurant: restaurantId, _order: orderId, _status: status, _expected_status: order.status });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
      queryClient.invalidateQueries({ queryKey: ['waiter_served_orders'] });
      toast.success('Order updated');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reassignTable = useMutation({
    mutationFn: async ({ orderId, tableId }: { orderId: string; tableId: string | null }) => {
      const { error } = await supabase.from('orders').update({ table_id: tableId }).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
      queryClient.invalidateQueries({ queryKey: ['waiter_served_orders'] });
      toast.success('Table reassigned');
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const readyOrders = activeOrders.filter(o => o.status === 'ready');
  const preparingOrders = activeOrders.filter(o => o.status === 'preparing');
  const pendingOrders = activeOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const selectedOrders = activeTab === 'served' ? servedOrders
    : activeTab === 'ready' ? readyOrders
    : activeTab === 'preparing' ? preparingOrders
    : activeTab === 'pending' ? pendingOrders : activeOrders;
  const query = search.trim().toLowerCase();
  const priority: Record<string, number> = { ready: 0, pending: 1, confirmed: 2, preparing: 3 };
  const filteredOrders = selectedOrders.filter(order => !query || [
    order.id, String(order.ticket_number ?? ''), order.restaurant_tables?.label ?? 'Takeaway', order.notes,
    ...order.order_items.map((item) => `${item.menu_items?.name ?? ''} ${item.notes ?? ''}`),
  ].some(value => value?.toLowerCase().includes(query))).sort((a, b) => activeTab === 'served'
    ? new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    : (priority[a.status] ?? 4) - (priority[b.status] ?? 4) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const tabs: { id: OrderFilter; label: string; count: number }[] = [
    { id: 'all', label: 'Active', count: activeOrders.length },
    { id: 'ready', label: 'Ready', count: readyOrders.length },
    { id: 'preparing', label: 'Cooking', count: preparingOrders.length },
    { id: 'pending', label: 'Queue', count: pendingOrders.length },
    { id: 'served', label: 'Served', count: servedOrders.length },
  ];
  const metrics: { id: OrderFilter; label: string; count: number; icon: typeof Clock; color: string }[] = [
    { id: 'all', label: 'Active orders', count: activeOrders.length, icon: ClipboardList, color: 'text-primary bg-primary/10' },
    { id: 'ready', label: 'Ready to serve', count: readyOrders.length, icon: Bell, color: 'text-success bg-success/10' },
    { id: 'preparing', label: 'In the kitchen', count: preparingOrders.length, icon: ChefHat, color: 'text-warning bg-warning/10' },
  ];
  const loading = activeTab === 'served' ? servedPending : ordersPending;
  const failed = activeTab === 'served' ? servedError : ordersError;
  const refresh = () => { void refreshOrders(); void refreshServed(); };

  return (
    <WaiterLayout title="Service" subtitle={`${activeOrders.length} active · ${readyOrders.length} ready`}>
      <div className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
        <section className="flex flex-wrap items-center justify-between gap-4" aria-labelledby="service-heading">
          <div>
            <p className="mb-1 hidden text-xs font-medium text-muted-foreground sm:block">Your floor, at a glance</p>
            <h2 id="service-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">Service overview</h2>
            <p className="mt-1 text-sm text-muted-foreground">Pick up ready orders and keep tables moving.</p>
          </div>
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <Button asChild className="h-11 flex-1 gap-2 sm:flex-none"><Link to="/menu?mode=waiter"><Plus className="h-4 w-4" />New order</Link></Button>
            <Button asChild variant="outline" className="h-11 flex-1 gap-2 sm:flex-none"><Link to="/admin/pos"><Monitor className="h-4 w-4" />Open POS</Link></Button>
          </div>
        </section>

        {waiterCalls.length > 0 && (
          <section aria-label="Tables calling for assistance" className="space-y-2 rounded-2xl border border-warning/30 bg-warning/5 p-3 sm:p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4 text-warning" />Tables need assistance <span className="text-muted-foreground">({waiterCalls.length})</span></h3>
            {waiterCalls.map(call => (
              <div key={call.id} className="flex items-center gap-3 rounded-xl bg-card p-3">
                <div className="min-w-0 flex-1"><p className="break-words text-sm font-semibold">{call.restaurant_tables?.label || 'Table'} is calling</p><p className="text-xs text-muted-foreground"><TimeAgo date={call.created_at} /> ago</p></div>
                <Button variant="outline" className="h-11 shrink-0" disabled={dismissWaiterCall.isPending} onClick={() => dismissWaiterCall.mutate(call.id)}>Dismiss</Button>
              </div>
            ))}
          </section>
        )}

        <div className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Service totals">
          {metrics.map(metric => (
            <button key={metric.id} onClick={() => setActiveTab(metric.id)} aria-label={`${metric.label}: ${metric.count}`} aria-pressed={activeTab === metric.id} className={`flex min-w-0 items-center justify-between gap-2 rounded-2xl border bg-card p-3 text-left transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5 ${activeTab === metric.id ? 'border-primary/40 shadow-sm' : 'border-border'}`}>
              <div><span className="block text-xl font-bold tabular-nums sm:text-3xl">{ordersPending || ordersError ? '—' : metric.count}</span><span className="mt-1 block text-[11px] font-medium leading-4 text-muted-foreground sm:text-sm">{metric.label}</span></div>
              <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${metric.color}`}><metric.icon className="h-5 w-5" /></span>
            </button>
          ))}
        </div>

        <section aria-label="Order board" className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div><h3 className="font-semibold">{activeTab === 'served' ? 'Recently served' : 'Order board'}</h3><p className="mt-0.5 text-xs text-muted-foreground">{activeTab === 'served' ? 'The last 20 served orders' : 'Ready first, then oldest in each stage'}</p></div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label={soundEnabled ? 'Mute order sounds' : 'Enable order sounds'} aria-pressed={soundEnabled} onClick={() => setSoundEnabled(value => !value)}>{soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</Button>
              <Button variant="outline" size="icon" className="h-11 w-11" aria-label="Refresh orders" disabled={ordersFetching} onClick={refresh}><RefreshCw className={`h-4 w-4 ${ordersFetching ? 'animate-spin' : ''}`} /></Button>
            </div>
          </div>
          <div className="relative">
            <Search aria-hidden="true" className="absolute left-3.5 top-3.5 h-4 w-4 text-muted-foreground" />
            <Input type="search" aria-label="Search orders" placeholder="Search table, order or menu item…" value={search} onChange={event => setSearch(event.target.value)} className="h-11 bg-card pl-10 pr-11 [&::-webkit-search-cancel-button]:appearance-none" />
            {search && <button aria-label="Clear search" onClick={() => setSearch('')} className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><X className="h-4 w-4" /></button>}
          </div>
          <div role="group" aria-label="Filter orders by status" className="grid grid-cols-5 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
            {tabs.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={activeTab === tab.id} className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 text-[11px] font-medium transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm ${activeTab === tab.id ? 'border-foreground bg-foreground text-background' : 'border-border bg-card text-muted-foreground hover:text-foreground'}`}>
                {tab.label}<span className={`rounded-md px-1.5 py-0.5 text-[11px] tabular-nums ${activeTab === tab.id ? 'bg-background/15' : tab.id === 'ready' ? 'bg-success/10 text-success' : 'bg-secondary'}`}>{tab.count}</span>
              </button>
            ))}
          </div>

          {loading ? (
            <div role="status" aria-label="Loading orders" className="grid gap-4 xl:grid-cols-2"><span className="sr-only">Loading orders</span>{[1, 2, 3, 4].map(key => <Skeleton key={key} className="h-52 rounded-2xl" />)}</div>
          ) : failed ? (
            <div role="alert" className="rounded-2xl border border-destructive/20 bg-card p-8 text-center"><AlertCircle className="mx-auto mb-3 h-7 w-7 text-destructive" /><p className="font-semibold">Couldn’t load orders</p><p className="mt-1 text-sm text-muted-foreground">Refresh to get the latest orders before taking action.</p><Button variant="outline" className="mt-4 h-11" onClick={refresh}>Try again</Button></div>
          ) : filteredOrders.length > 0 ? (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <AnimatePresence initial={false}>
                {filteredOrders.map((order, idx) => (
                  <OrderCard key={order.id} order={order} fmt={fmt}
                    busy={updateStatus.isPending && updateStatus.variables?.orderId === order.id}
                    onServe={() => updateStatus.mutate({ orderId: order.id, status: 'served' })}
                    onUpdateStatus={(status: string) => updateStatus.mutate({ orderId: order.id, status })}
                    onReassignTable={(tableId) => reassignTable.mutate({ orderId: order.id, tableId })}
                    onPrintInvoice={() => handlePrintInvoice(order)} onModifyOrder={() => setModifyOrder(order)} tables={tables} index={idx}
                    kitchenMessage={kitchenUpdates.latest.get(order.id)?.message} onKitchenUpdates={() => setKitchenThread(order)} />
                ))}
              </AnimatePresence>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed bg-card px-5 py-12 text-center">
              <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary"><ClipboardList className="h-6 w-6 text-muted-foreground" /></span>
              <p className="font-semibold">{query ? 'No matching orders' : activeTab === 'all' ? 'You’re all caught up' : `No ${activeTab === 'preparing' ? 'cooking' : activeTab === 'pending' ? 'queued' : activeTab} orders`}</p>
              <p className="mt-2 text-sm text-muted-foreground">{query ? 'Try a different table, order number or menu item.' : activeTab === 'all' ? 'New orders will appear here automatically.' : 'Choose another status to see more orders.'}</p>
              {query ? <Button variant="outline" className="mt-4 h-11" onClick={() => setSearch('')}>Clear search</Button> : activeTab !== 'all' && <Button variant="outline" className="mt-4 h-11" onClick={() => setActiveTab('all')}>Show active orders</Button>}
            </div>
          )}
        </section>
      </div>

      <InvoiceReceipt open={invoiceOpen} onOpenChange={setInvoiceOpen} data={invoiceData} />
      <ModifyOrderDialog open={!!modifyOrder} onOpenChange={(o) => !o && setModifyOrder(null)} order={modifyOrder} />
      {restaurantId && kitchenThread && <KitchenOrderUpdates restaurantId={restaurantId} order={{ id: kitchenThread.id, status: kitchenThread.status, label: `${kitchenThread.restaurant_tables?.label ?? 'Takeaway'} #${kitchenThread.ticket_number ?? kitchenThread.id.slice(0, 8)}` }} onClose={() => setKitchenThread(null)} />}
    </WaiterLayout>
  );
}

// ─── Order Card ─────────────────────────────────────────────
function OrderCard({
  order,
  fmt,
  onServe,
  onUpdateStatus,
  onReassignTable,
  onPrintInvoice,
  onModifyOrder,
  tables,
  index,
  busy,
  kitchenMessage,
  onKitchenUpdates,
}: {
  order: WaiterOrder;
  fmt: (n: number) => string;
  onServe: () => void;
  onUpdateStatus: (status: string) => void;
  onReassignTable: (tableId: string | null) => void;
  onPrintInvoice: () => void;
  onModifyOrder: () => void;
  tables: { id: string; label: string }[];
  index: number;
  busy: boolean;
  kitchenMessage?: string;
  onKitchenUpdates: () => void;
}) {
  const { hasAnyRole } = useAuth();
  const canPrepare = hasAnyRole(['owner', 'admin', 'manager', 'kitchen']);
  const canCancel = hasAnyRole(['owner', 'admin', 'manager']) && !order.paid_at;
  const [expanded, setExpanded] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const items = order.order_items ?? [];
  const totalQty = items.reduce((s, i) => s + i.quantity, 0);
  const isReady = order.status === 'ready';
  const hasNotes = items.some((i) => i.notes) || order.notes;

  const x = useMotionValue(0);
  const bgOpacity = useTransform(x, [-150, -80, 0], [1, 0.8, 0]);
  const bgScale = useTransform(x, [-150, -80, 0], [1, 0.95, 0.8]);
  const checkOpacity = useTransform(x, [-120, -60, 0], [1, 0.5, 0]);

  const SWIPE_THRESHOLD = -100;
  const hapticFired = useRef(false);

  // Track drag to fire haptic at threshold
  useEffect(() => {
    const unsubscribe = x.on('change', (latest) => {
      if (isReady && latest < SWIPE_THRESHOLD && !hapticFired.current) {
        hapticFired.current = true;
        if (navigator.vibrate) navigator.vibrate(15);
      }
      if (latest > SWIPE_THRESHOLD) {
        hapticFired.current = false;
      }
    });
    return unsubscribe;
  }, [x, isReady, SWIPE_THRESHOLD]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (isReady && !busy && info.offset.x < SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      onServe();
    }
  };

  const cardContent = (
    <>
      {/* Card header — tappable to expand */}
      <button
        type="button"
        aria-label={`${expanded ? 'Hide' : 'Show'} details for order ${order.id.slice(0, 8)}`}
        aria-expanded={expanded}
        aria-controls={`order-details-${order.id}`}
        className="w-full px-4 pb-3 pt-4 text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className={`h-10 w-10 shrink-0 rounded-xl ${config.bg} flex items-center justify-center`}>
              <StatusIcon className={`h-4 w-4 ${config.color}`} strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="break-words font-semibold text-card-foreground text-[15px]">
                  {order.restaurant_tables?.label ?? 'Takeaway'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-medium text-muted-foreground">Order #{order.ticket_number ?? order.id.slice(0, 8)}</p>
              <div className="flex items-center gap-2 sm:gap-3 mt-1 flex-wrap">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Timer className="h-3 w-3" strokeWidth={1.5} />
                  <TimeAgo date={order.created_at} /> ago
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3" strokeWidth={1.5} />
                  {totalQty} item{totalQty !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-bold tabular-nums text-card-foreground sm:text-base">{fmt(Number(order.total_amount))}</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </motion.div>
          </div>
        </div>
      </button>

      {/* Collapsed preview */}
      {!expanded && items.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-sm leading-6 text-muted-foreground line-clamp-2">
            {items.map((i) => `${i.quantity}× ${i.menu_items?.name ?? 'Item'}`).join(', ')}
          </p>
        </div>
      )}

      {hasNotes && (
        <div className="mx-4 mb-3 flex items-start gap-2 rounded-lg border border-warning/25 bg-warning/5 px-3 py-2 text-xs leading-5">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <p className="min-w-0 break-words"><span className="font-semibold">Service note: </span>{[order.notes, ...items.map(item => item.notes)].filter(Boolean).join(' · ')}</p>
        </div>
      )}

      {kitchenMessage && <div className="mx-4 mb-3 rounded-lg border border-primary/20 bg-primary/5 p-3"><p className="text-xs font-semibold">Kitchen update</p><p className="mt-1 break-words text-sm">{kitchenMessage}</p><button className="mt-1 min-h-11 text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={onKitchenUpdates}>View kitchen updates</button></div>}

      {/* Expanded full item list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`order-details-${order.id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="bg-secondary/50 rounded-lg px-3 py-2.5 space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2">
                    <span className="text-sm font-bold tabular-nums text-card-foreground leading-none mt-0.5 shrink-0">
                      {item.quantity}×
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-card-foreground">{item.menu_items?.name ?? 'Item'}</span>
                      {item.notes && (
                        <p className="text-[11px] text-warning mt-0.5">⚠ {item.notes}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action links */}
              <div className="mt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={(e) => { e.stopPropagation(); onPrintInvoice(); }}
                  className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Printer className="h-3 w-3" strokeWidth={2} />
                  Print Invoice
                </button>

                {order.status !== 'served' && !order.paid_at && (
                  <>
                    <span className="text-border">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onModifyOrder(); }}
                      className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      Modify
                    </button>
                    <span className="text-border">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowTablePicker(p => !p); }}
                      className="flex min-h-11 items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <ArrowRightLeft className="h-3 w-3" strokeWidth={2} />
                      Reassign table
                    </button>
                  </>
                )}
              </div>

              {/* Table picker */}
              {order.status !== 'served' && (
                <AnimatePresence>
                  {showTablePicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onReassignTable(null);
                            setShowTablePicker(false);
                          }}
                          className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                            !order.table_id
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                          }`}
                        >
                          Takeaway
                        </button>
                        {tables.map(t => (
                          <button
                            key={t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onReassignTable(t.id);
                              setShowTablePicker(false);
                            }}
                            className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                              order.table_id === t.id
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                            }`}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keep the next permitted action prominent and reachable on a phone. */}
      {order.status !== 'served' && (
        <div className="space-y-2 border-t border-border/60 bg-secondary/20 px-4 py-3">
          <div className="flex flex-wrap items-center gap-2">
            {order.status === 'pending' && (
              <Button className="h-11 flex-1 gap-2 text-sm" disabled={busy} onClick={() => onUpdateStatus('confirmed')}>
                <CheckCircle2 className="h-4 w-4" />{busy ? 'Updating…' : 'Confirm'}
              </Button>
            )}
            {order.status === 'confirmed' && !canPrepare && <p className="flex min-h-11 flex-1 items-center gap-2 text-xs text-muted-foreground"><Clock className="h-4 w-4 shrink-0" />Confirmed · waiting for the kitchen</p>}
            {(order.status === 'pending' || order.status === 'confirmed') && canPrepare && (
              <Button variant="outline" className="h-11 flex-1 gap-2" disabled={busy} onClick={() => onUpdateStatus('preparing')}><ChefHat className="h-4 w-4" />Start Cooking</Button>
            )}
            {order.status === 'preparing' && (canPrepare ? (
              <Button className="h-11 flex-1 gap-2" disabled={busy} onClick={() => onUpdateStatus('ready')}><Bell className="h-4 w-4" />Mark Ready</Button>
            ) : <p className="flex min-h-11 flex-1 items-center gap-2 text-xs text-muted-foreground"><ChefHat className="h-4 w-4 shrink-0" />The kitchen is preparing this order</p>)}
            {isReady && (
              <Button className="h-11 flex-1 gap-2 bg-success text-success-foreground hover:bg-success/90" disabled={busy} onClick={onServe}><CheckCircle2 className="h-4 w-4" />{busy ? 'Updating…' : 'Mark Served'}</Button>
            )}
            {canCancel && !isReady && <Button variant="ghost" className="h-11 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive" disabled={busy} onClick={() => onUpdateStatus('cancelled')}>Cancel</Button>}
          </div>
          {isReady && <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground"><ArrowLeft className="h-3 w-3" />Or swipe left to serve</p>}
        </div>
      )}
    </>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className="relative min-w-0 overflow-hidden rounded-2xl"
      data-order-id={order.id}
      data-order-status={order.status}
    >
      {/* Swipe reveal background (only for ready orders) */}
      {isReady && (
        <motion.div
          className="absolute inset-0 bg-success rounded-xl flex items-center justify-end px-6"
          style={{ opacity: bgOpacity }}
        >
          <motion.div
            className="flex items-center gap-2 text-success-foreground"
            style={{ scale: bgScale, opacity: checkOpacity }}
          >
            <CheckCircle2 className="h-6 w-6" strokeWidth={2} />
            <span className="font-bold text-sm">Served</span>
          </motion.div>
        </motion.div>
      )}

      {/* Draggable card */}
      <motion.div
        drag={isReady && !busy ? 'x' : false}
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x, touchAction: 'pan-y' }}
        className={`relative overflow-hidden rounded-2xl border bg-card shadow-sm ${isReady ? 'border-success/50' : 'border-border'}`}
      >
        {cardContent}
      </motion.div>
    </motion.div>
  );
}
