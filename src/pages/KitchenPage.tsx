import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, ChefHat, CheckCircle2, Volume2, VolumeX,
  Flame, Timer, Hash, UtensilsCrossed, ArrowRight, AlertTriangle, Printer, MessageSquare,
} from 'lucide-react';
import { usePrintTicket } from '@/components/kitchen/KitchenTicketPrint';
import { Button } from '@/components/ui/button';
import { useOrderNotification, playSoundPreset, getEventSoundPreset } from '@/hooks/useNotifications';
import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatDistanceToNowStrict, differenceInMinutes, format } from 'date-fns';
import { kitchenCountdown } from '@/lib/kitchen';
import { KitchenAvailability, KitchenHistory, KitchenReports } from '@/components/kitchen/KitchenTools';
import KitchenOrderUpdates from '@/components/kitchen/KitchenOrderUpdates';
import { useKitchenUpdates } from '@/hooks/useKitchenUpdates';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type OrderStatus = 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served' | 'completed' | 'cancelled';

interface KDSOrder {
  id: string;
  ticket_number?: number | null;
  table_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  kitchen_started_at: string | null;
  kitchen_due_at: string | null;
  kitchen_ready_at: string | null;
  kitchen_target_minutes: number | null;
  notes: string | null;
  table_label?: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    notes: string | null;
    status: string;
    selected_tags: string[];
    selected_addons: { addon_name: string; name: string }[];
    prep_time_minutes: number | null;
  }[];
  estimated_prep_minutes: number | null;
}

const STATUS_CONFIG: Record<string, {
  label: string;
  color: string;
  bg: string;
  ring: string;
  icon: typeof Clock;
  next: OrderStatus | null;
  nextLabel: string;
  pulse?: boolean;
}> = {
  pending: {
    label: 'New',
    color: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    icon: Clock,
    next: 'preparing',
    nextLabel: 'Start Cooking',
  },
  confirmed: {
    label: 'Confirmed',
    color: 'text-warning',
    bg: 'bg-warning/10',
    ring: 'ring-warning/20',
    icon: Clock,
    next: 'preparing',
    nextLabel: 'Start Cooking',
  },
  preparing: {
    label: 'Cooking',
    color: 'text-primary',
    bg: 'bg-primary/10',
    ring: 'ring-primary/20',
    icon: ChefHat,
    next: 'ready',
    nextLabel: 'Mark Ready',
  },
  ready: {
    label: 'Ready',
    color: 'text-success',
    bg: 'bg-success/10',
    ring: 'ring-success/30',
    icon: CheckCircle2,
    next: 'served',
    nextLabel: 'Served',
    pulse: true,
  },
};

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  confirmed: 0,
  preparing: 1,
  ready: 2,
};

type Urgency = 'normal' | 'warning' | 'urgent';

function getUrgency(createdAt: string): Urgency {
  const mins = differenceInMinutes(new Date(), new Date(createdAt));
  if (mins >= 20) return 'urgent';
  if (mins >= 10) return 'warning';
  return 'normal';
}

const URGENCY_STYLES: Record<Urgency, { border: string; glow: string; badge: string; label: string }> = {
  normal: { border: '', glow: '', badge: '', label: '' },
  warning: {
    border: 'border-l-4 border-l-warning',
    glow: '',
    badge: 'bg-warning/15 text-warning',
    label: 'Waiting long',
  },
  urgent: {
    border: 'border-l-4 border-l-destructive',
    glow: 'shadow-[0_0_12px_-2px_hsl(var(--destructive)/0.3)]',
    badge: 'bg-destructive/15 text-destructive',
    label: 'URGENT',
  },
};

function TimeAgo({ date }: { date: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);
  return <>{formatDistanceToNowStrict(new Date(date), { addSuffix: false })}</>;
}

function Countdown({ dueAt }: { dueAt: string }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const { overdue: isOverdue, label: display, remaining } = kitchenCountdown(dueAt, Date.now());

  return (
    <span className={`text-xs font-bold tabular-nums flex items-center gap-1 ${isOverdue ? 'text-destructive' : remaining < 120000 ? 'text-warning' : 'text-success'}`}>
      <Timer className="h-3 w-3" strokeWidth={2} />
      {isOverdue ? `Overdue ${display}` : `${display} remaining`}
    </span>
  );
}

export default function KitchenPage() {
  const queryClient = useQueryClient();
  const { data: settings } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [params, setParams] = useSearchParams();
  const view = ['menu', 'history', 'reports'].includes(params.get('view') ?? '') ? params.get('view')! : 'queue';
  const [messageOrder, setMessageOrder] = useState<KDSOrder | null>(null);
  const [etaOrder, setEtaOrder] = useState<KDSOrder | null>(null);
  const [etaMinutes, setEtaMinutes] = useState(15);
  const [now, setNow] = useState(Date.now());
  const alertedOverdue = useRef(new Set<string>());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('kds-auto-print') === 'true');
  const [activeTab, setActiveTab] = useState<'all' | 'incoming' | 'cooking' | 'ready'>('all');
  const printedOrdersRef = useRef<Set<string>>(new Set());
  const { printTicket } = usePrintTicket(settings?.restaurant_name);

  const { checkForNew, requestPermission } = useOrderNotification({
    soundType: 'newOrder',
    enabled: soundEnabled,
    label: 'New order',
  });

  useEffect(() => { requestPermission(); }, [requestPermission]);

  const { data: orders = [], isPending: ordersPending, isError: ordersError, refetch: refreshOrders } = useQuery<KDSOrder[]>({
    queryKey: ['kitchen_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*, ticket_number, restaurant_tables(label), order_items(id, quantity, notes, status, menu_item_id, menu_items(name, prep_time_minutes), selected_tags, selected_addons)')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: true });
      if (error) throw error;

      return (ordersData ?? []).map((order) => {
        const items = (order.order_items ?? []).map((item) => ({
          id: item.id,
          name: item.menu_items?.name ?? 'Unknown',
          quantity: item.quantity,
          notes: item.notes,
          status: item.status,
          selected_tags: item.selected_tags || [],
          selected_addons: (Array.isArray(item.selected_addons) ? item.selected_addons : []).flatMap(addon => addon && typeof addon === 'object' && !Array.isArray(addon) && typeof addon.name === 'string' ? [{ name: addon.name, addon_name: typeof addon.addon_name === 'string' ? addon.addon_name : '' }] : []),
          prep_time_minutes: item.menu_items?.prep_time_minutes ?? null,
        }));
        // Estimated prep = max prep time among items (parallel cooking)
        const prepTimes = items.map((i) => i.prep_time_minutes).filter((t) => t != null) as number[];
        const estimated_prep_minutes = prepTimes.length > 0 ? Math.max(...prepTimes) : null;

        return {
          id: order.id,
          ticket_number: order.ticket_number ?? null,
          table_id: order.table_id,
          status: order.status,
          created_at: order.created_at,
          updated_at: order.updated_at,
          kitchen_started_at: order.kitchen_started_at,
          kitchen_due_at: order.kitchen_due_at,
          kitchen_ready_at: order.kitchen_ready_at,
          kitchen_target_minutes: order.kitchen_target_minutes,
          notes: order.notes,
          table_label: order.restaurant_tables?.label ?? 'Takeaway',
          items,
          estimated_prep_minutes,
        };
      });
    },
    // Push updates via realtime; long fallback poll only if subscription drops.
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { latest: latestUpdates } = useKitchenUpdates(restaurantId, orders.map(order => order.id));
  useEffect(() => {
    for (const order of orders) {
      if (order.status !== 'preparing' || !order.kitchen_due_at || new Date(order.kitchen_due_at).getTime() > now) continue;
      const key = `${order.id}:${order.kitchen_due_at}`;
      if (alertedOverdue.current.has(key)) continue;
      alertedOverdue.current.add(key);
      toast.warning(`${order.table_label} · ticket #${order.ticket_number ?? order.id.slice(0, 8)} is overdue`);
      if (soundEnabled) playSoundPreset(getEventSoundPreset('orderReady'));
    }
  }, [orders, now, soundEnabled]);

  const setEta = useMutation({
    mutationFn: async () => {
      if (!restaurantId || !etaOrder) throw new Error('Select a cooking ticket');
      const { error } = await supabase.rpc('kitchen_set_eta', { _restaurant: restaurantId, _order: etaOrder.id, _minutes: etaMinutes });
      if (error) throw error;
    }, onSuccess: () => { setEtaOrder(null); void queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] }); toast.success('Expected ready time updated'); }, onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    checkForNew(orders.map(o => o.id));
  }, [orders, checkForNew]);

  // Seed printed set on first load to avoid reprinting existing orders
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!initializedRef.current && orders.length > 0) {
      orders.forEach(o => printedOrdersRef.current.add(o.id));
      initializedRef.current = true;
    }
  }, [orders]);

  // Auto-print new orders
  useEffect(() => {
    if (!autoPrint || !initializedRef.current) return;
    const newOrders = orders.filter(
      o => (o.status === 'pending' || o.status === 'confirmed') && !printedOrdersRef.current.has(o.id)
    );
    newOrders.forEach(order => {
      printedOrdersRef.current.add(order.id);
      printTicket(order);
    });
  }, [orders, autoPrint, printTicket]);

  const toggleAutoPrint = useCallback(() => {
    setAutoPrint(prev => {
      const next = !prev;
      localStorage.setItem('kds-auto-print', String(next));
      return next;
    });
  }, []);

  // Realtime push: scoped to this restaurant for orders, broad for order_items
  // (order_items has no restaurant_id column so we filter via the parent order on refetch).
  useEffect(() => {
    if (!restaurantId) return;
    const queryKey = ['kitchen_orders', restaurantId];
    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const channel = supabase
      .channel(`kds-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders', filter: `restaurant_id=eq.${restaurantId}` },
        invalidate,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'order_items' },
        invalidate,
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, restaurantId]);


  const updateStatus = useMutation({
    mutationFn: async ({ orderId, newStatus }: { orderId: string; newStatus: string }) => {
      const order = orders.find(order => order.id === orderId);
      if (!restaurantId || !order) throw new Error('Refresh the order before updating its status.');
      const { error } = await supabase.rpc('staff_set_order_status', { _restaurant: restaurantId, _order: orderId, _status: newStatus, _expected_status: order.status });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kitchen_orders'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const incomingOrders = orders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const cookingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  const sortedOrders = useMemo(() => {
    const list = activeTab === 'all'
      ? orders
      : activeTab === 'incoming'
      ? incomingOrders
      : activeTab === 'cooking'
      ? cookingOrders
      : readyOrders;

    return [...list].sort((a, b) => {
      const pa = STATUS_PRIORITY[a.status] ?? 99;
      const pb = STATUS_PRIORITY[b.status] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [orders, incomingOrders, cookingOrders, readyOrders, activeTab]);

  // Global queue position (non-ready orders only)
  const queuePositions = useMemo(() => {
    const actionable = orders
      .filter(o => o.status !== 'ready')
      .sort((a, b) => {
        const pa = STATUS_PRIORITY[a.status] ?? 99;
        const pb = STATUS_PRIORITY[b.status] ?? 99;
        if (pa !== pb) return pa - pb;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
    const map = new Map<string, number>();
    actionable.forEach((o, i) => map.set(o.id, i + 1));
    return map;
  }, [orders]);

  const overdueOrders = orders.filter(order => order.status === 'preparing' && order.kitchen_due_at && new Date(order.kitchen_due_at).getTime() <= now);
  const urgentCount = orders.filter(o => o.status !== 'ready' && getUrgency(o.created_at) === 'urgent').length;

  const tabs = [
    { id: 'all' as const, label: 'All', count: orders.length },
    { id: 'incoming' as const, label: 'New', count: incomingOrders.length },
    { id: 'cooking' as const, label: 'Cooking', count: cookingOrders.length },
    { id: 'ready' as const, label: 'Ready', count: readyOrders.length },
  ];

  return (
    <AdminLayout title="Kitchen Display" subtitle="KDS">
      <div className="min-h-0 bg-background pb-16 md:pb-0">
        <nav aria-label="Kitchen workspace" className="mx-auto grid max-w-5xl grid-cols-4 gap-1 border-b p-3 sm:gap-2 sm:px-4">
          {[['queue', 'Queue'], ['menu', 'Availability'], ['history', 'History'], ['reports', 'Reports']].map(([key, label]) => <Button key={key} variant={view === key ? 'default' : 'ghost'} className="h-11 min-w-0 px-1 text-xs sm:px-3 sm:text-sm" aria-current={view === key ? 'page' : undefined} onClick={() => setParams(key === 'queue' ? {} : { view: key })}>{label}</Button>)}
        </nav>
        {view !== 'queue' ? <div className="mx-auto max-w-5xl p-4 sm:p-6">{restaurantId ? view === 'menu' ? <KitchenAvailability restaurantId={restaurantId} /> : view === 'history' ? <KitchenHistory restaurantId={restaurantId} /> : <KitchenReports restaurantId={restaurantId} /> : <p role="status">Loading kitchen…</p>}</div> : <>
        <header className="sticky top-0 z-30 bg-card/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 sm:py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {settings?.logo_url ? (
                  <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shadow-md">
                    <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Flame className="h-4.5 w-4.5 text-primary" strokeWidth={2} />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="font-display text-base sm:text-lg font-bold tracking-tight text-foreground truncate">Kitchen Queue</h1>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground leading-none mt-0.5 truncate">
                    {orders.length} active · {incomingOrders.length} new · {readyOrders.length} ready
                    {urgentCount > 0 && (
                      <span className="text-destructive font-semibold ml-1">· {urgentCount} urgent</span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="icon"
                  className={`h-8 w-8 ${autoPrint ? 'text-primary' : ''}`}
                  aria-label={autoPrint ? 'Disable kitchen auto-print' : 'Enable kitchen auto-print'}
                  onClick={toggleAutoPrint}
                  title={autoPrint ? 'Auto-print ON' : 'Auto-print OFF'}
                >
                  <Printer className="h-4 w-4" strokeWidth={1.5} />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={soundEnabled ? 'Mute kitchen sounds' : 'Enable kitchen sounds'} aria-pressed={soundEnabled} onClick={() => setSoundEnabled(p => !p)}>
                  {soundEnabled ? (
                    <Volume2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  ) : (
                    <VolumeX className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  )}
                </Button>
                <div className="flex items-center gap-2 ml-2">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                  </span>
                  <span className="text-xs text-muted-foreground font-medium">Live</span>
                </div>
              </div>
            </div>
          </div>
        </header>

        {overdueOrders.length > 0 && <div role="status" className="border-b border-destructive/25 bg-destructive/5 px-4 py-3 text-sm font-semibold text-destructive"><div className="mx-auto flex max-w-5xl items-center gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{overdueOrders.length} overdue cooking ticket{overdueOrders.length === 1 ? '' : 's'} · check expected ready times</div></div>}

        {incomingOrders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-warning/5 border-b border-warning/10"
          >
            <div className="max-w-5xl mx-auto px-3 sm:px-4 py-2.5 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-warning" />
              </span>
              <span className="text-sm font-semibold text-warning">
                {incomingOrders.length} new order{incomingOrders.length !== 1 ? 's' : ''} waiting
              </span>
            </div>
          </motion.div>
        )}

        <div className="sticky top-[57px] z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-5xl mx-auto px-3 sm:px-4">
            <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`text-[11px] tabular-nums font-bold min-w-[18px] text-center rounded-full px-1 py-px ${
                      activeTab === tab.id
                        ? 'bg-background/20 text-background'
                        : tab.id === 'incoming' && tab.count > 0
                        ? 'bg-warning/15 text-warning'
                        : tab.id === 'ready' && tab.count > 0
                        ? 'bg-success/15 text-success'
                        : 'bg-secondary text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <AnimatePresence mode="popLayout">
            {ordersPending ? <p role="status" className="py-12 text-center text-muted-foreground">Loading kitchen orders…</p> : ordersError ? <div role="alert" className="space-y-3 py-12 text-center"><p>Couldn’t load kitchen orders.</p><Button variant="outline" onClick={() => void refreshOrders()}>Try again</Button></div> : sortedOrders.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {sortedOrders.map((order, idx) => (
                  <KDSTicket
                    key={order.id}
                    order={order}
                    index={idx}
                    queuePosition={queuePositions.get(order.id)}
                    onAdvance={(id) => {
                      const cfg = STATUS_CONFIG[order.status];
                      if (cfg?.next) updateStatus.mutate({ orderId: id, newStatus: cfg.next });
                    }}
                    onPrint={() => printTicket(order)}
                    onMessage={() => setMessageOrder(order)}
                    latestMessage={latestUpdates.get(order.id)?.message}
                    onEta={() => { setEtaOrder(order); setEtaMinutes(order.kitchen_target_minutes ?? order.estimated_prep_minutes ?? 15); }}
                    busy={updateStatus.isPending && updateStatus.variables?.orderId === order.id}
                  />
                ))}
              </div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-20"
              >
                <div className="h-16 w-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
                  <UtensilsCrossed className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
                </div>
                <p className="text-muted-foreground font-medium">No active orders</p>
                <p className="text-xs text-muted-foreground/60 mt-1">
                  {activeTab === 'all' ? 'Orders will appear here in real-time' : `No ${activeTab} orders right now`}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </>}
      </div>
      {restaurantId && messageOrder && <KitchenOrderUpdates restaurantId={restaurantId} order={{ id: messageOrder.id, label: `${messageOrder.table_label} #${messageOrder.ticket_number ?? messageOrder.id.slice(0, 8)}`, status: orders.find(order => order.id === messageOrder.id)?.status ?? messageOrder.status, dueAt: orders.find(order => order.id === messageOrder.id)?.kitchen_due_at }} canSend onClose={() => setMessageOrder(null)} />}
      <Dialog open={!!etaOrder} onOpenChange={open => !open && !setEta.isPending && setEtaOrder(null)}><DialogContent><DialogHeader><DialogTitle>Expected ready time</DialogTitle><DialogDescription>Set remaining cooking time from now. The original target stays unchanged in reports.</DialogDescription></DialogHeader><label className="space-y-2 text-sm font-medium">Minutes remaining<Input aria-label="Minutes remaining" type="number" min={1} max={240} step={1} value={etaMinutes} onChange={event => setEtaMinutes(Number(event.target.value))} /></label><Button className="h-11" disabled={setEta.isPending || !Number.isInteger(etaMinutes) || etaMinutes < 1 || etaMinutes > 240} onClick={() => setEta.mutate()}>{setEta.isPending ? 'Saving…' : 'Save ready time'}</Button></DialogContent></Dialog>
    </AdminLayout>
  );
}

function KDSTicket({ order, index, queuePosition, onAdvance, onPrint, onMessage, onEta, latestMessage, busy }: {
  order: KDSOrder;
  index: number;
  queuePosition?: number;
  onAdvance: (id: string) => void;
  onPrint: () => void;
  onMessage: () => void;
  onEta: () => void;
  latestMessage?: string;
  busy: boolean;
}) {
  const { hasAnyRole } = useAuth();
  const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const totalQty = order.items.reduce((s, i) => s + i.quantity, 0);
  const urgency = order.status === 'ready' ? 'normal' : getUrgency(order.created_at);
  const urgencyStyle = URGENCY_STYLES[urgency];
  const [swipeProgress, setSwipeProgress] = useState(0);
  const [swiped, setSwiped] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const hasNext = !busy && !!config.next && (config.next !== 'served' || hasAnyRole(['owner', 'admin', 'manager', 'waiter', 'server']));

  const handleDrag = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number } }) => {
    if (!hasNext) return;
    const progress = Math.min(Math.max(-info.offset.x / 120, 0), 1);
    setSwipeProgress(progress);
  }, [hasNext]);

  const handleDragEnd = useCallback((_: MouseEvent | TouchEvent | PointerEvent, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (!hasNext) return;
    const threshold = -80;
    const velocityThreshold = -300;
    if (info.offset.x < threshold || info.velocity.x < velocityThreshold) {
      setSwiped(true);
      onAdvance(order.id);
      setTimeout(() => setSwiped(false), 400);
    }
    setSwipeProgress(0);
  }, [hasNext, onAdvance, order.id]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={`relative bg-card rounded-xl overflow-hidden card-shadow ring-1 ${config.ring} ${config.pulse ? 'ring-2' : ''} ${urgencyStyle.border} ${urgencyStyle.glow}`}
    >
      {/* Swipe action hint overlay */}
      {hasNext && swipeProgress > 0 && (
        <div
          className="absolute inset-y-0 right-0 flex items-center justify-center z-10 rounded-r-xl pointer-events-none"
          style={{
            width: `${Math.max(swipeProgress * 100, 20)}%`,
            backgroundColor: `hsl(var(--primary) / ${swipeProgress * 0.25})`,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: swipeProgress > 0.3 ? 1 : swipeProgress, scale: swipeProgress > 0.5 ? 1 : 0.8 }}
            className="flex flex-col items-center gap-1 text-primary"
          >
            <ArrowRight className="h-5 w-5" strokeWidth={2} />
            <span className="text-[10px] font-bold uppercase tracking-wider">{config.nextLabel}</span>
          </motion.div>
        </div>
      )}

      <motion.div
        ref={cardRef}
        drag={hasNext ? 'x' : false}
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        animate={swiped ? { x: -200, opacity: 0 } : { x: 0 }}
        transition={swiped ? { duration: 0.3 } : undefined}
        style={{ touchAction: 'pan-y' }}
        className="relative z-[1] bg-card"
      >
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              {queuePosition != null ? (
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center font-bold text-lg tabular-nums ${
                  queuePosition === 1
                    ? 'bg-destructive/10 text-destructive'
                    : queuePosition <= 3
                    ? 'bg-warning/10 text-warning'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {queuePosition}
                </div>
              ) : (
                <div className={`h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center`}>
                  <StatusIcon className={`h-4 w-4 ${config.color}`} strokeWidth={2} />
                </div>
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-card-foreground text-[15px]">
                    {order.table_label}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                    {config.label}
                  </span>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 mt-0.5 flex-wrap">
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Timer className="h-3 w-3" strokeWidth={1.5} />
                    <TimeAgo date={order.created_at} />
                  </span>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Hash className="h-3 w-3" strokeWidth={1.5} />
                    {totalQty} item{totalQty !== 1 ? 's' : ''}
                  </span>
                  {order.estimated_prep_minutes != null && (
                    <span className="text-[11px] text-primary font-medium flex items-center gap-1">
                      <ChefHat className="h-3 w-3" strokeWidth={1.5} />
                      ~{order.estimated_prep_minutes}m
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {urgency !== 'normal' && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${urgencyStyle.badge}`}>
                  <AlertTriangle className="h-3 w-3" strokeWidth={2} />
                  {urgencyStyle.label}
                </span>
              )}
              {order.ticket_number && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-secondary text-muted-foreground tabular-nums">
                  #{order.ticket_number}
                </span>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onPrint(); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                title="Print ticket"
              >
                <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pb-3">
          <div className="bg-secondary/50 rounded-lg px-3 py-2 space-y-1.5">
            {order.items.map(item => (
              <div key={item.id} className="flex items-start gap-2">
                <span className="text-sm font-bold tabular-nums text-card-foreground leading-none mt-0.5">{item.quantity}×</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-card-foreground">{item.name}</span>
                    {item.prep_time_minutes != null && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">({item.prep_time_minutes}m)</span>
                    )}
                  </div>
                  {item.selected_tags && item.selected_tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {item.selected_tags.map((tag: string) => (
                        <span key={tag} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-warning/10 text-warning text-[10px] font-semibold">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  {item.selected_addons.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      + {item.selected_addons.map(a => a.name).join(', ')}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-[11px] text-warning mt-0.5 truncate">⚠ {item.notes}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          {order.notes && (
            <p className="text-[11px] text-warning mt-2 px-1">📝 {order.notes}</p>
          )}
          {order.status === 'preparing' && <div className="mt-3 space-y-2 rounded-lg border bg-background/60 p-3">{order.kitchen_due_at ? <><p className="text-xs text-muted-foreground">Expected ready {format(new Date(order.kitchen_due_at), 'HH:mm')}</p><Countdown dueAt={order.kitchen_due_at} /></> : <p className="text-xs text-muted-foreground">Timer not started for this older ticket.</p>}<Button variant="outline" className="h-11 w-full text-xs" onClick={onEta}>Set remaining time</Button></div>}
          {latestMessage && <p className="mt-3 break-words rounded-lg bg-primary/5 p-2 text-xs leading-5"><span className="font-semibold">Sent to waiter: </span>{latestMessage}</p>}
          <Button variant="outline" className="mt-3 h-11 w-full gap-2 text-xs" onClick={onMessage}><MessageSquare className="h-4 w-4" />Message waiter</Button>
        </div>

        {/* Swipe hint for touch devices */}
        {hasNext && (
          <div className="px-4 pb-4">
            <Button
              onClick={() => onAdvance(order.id)}
              variant={order.status === 'ready' ? 'default' : 'outline'}
              className={`w-full h-10 gap-2 rounded-xl text-sm font-semibold ${
                queuePosition === 1 ? 'border-destructive/30 hover:bg-destructive/5' : ''
              }`}
            >
              {queuePosition === 1 && order.status !== 'preparing' && '🔥 '}
              {config.nextLabel}
              <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} />
            </Button>
            <p className="text-[10px] text-muted-foreground/50 text-center mt-1.5 sm:hidden">← swipe to advance</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
