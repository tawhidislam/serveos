import { useEffect, useState, useRef } from 'react';
import { useCurrency } from '@/lib/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import {
  ClipboardList, ChefHat, Clock,
  CheckCircle2, Bell, Volume2, VolumeX, UtensilsCrossed,
  Timer, Hash, AlertCircle, ChevronDown, ArrowLeft, ArrowRightLeft, Printer, Pencil,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useStatusChangeNotification, useOrderNotification, playSoundPreset, getEventSoundPreset } from '@/hooks/useNotifications';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import WaiterLayout from '@/components/waiter/WaiterLayout';
import InvoiceReceipt, { type InvoiceData } from '@/components/InvoiceReceipt';
import ModifyOrderDialog from '@/components/waiter/ModifyOrderDialog';
import { useSettings } from '@/hooks/useSettings';

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
  const [activeTab, setActiveTab] = useState<'all' | 'ready' | 'preparing' | 'pending' | 'served' | 'table'>('all');
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [modifyOrder, setModifyOrder] = useState<any | null>(null);
  const { data: settings } = useSettings();

  const handlePrintInvoice = (order: any) => {
    const items = (order.order_items ?? []).map((item: any) => ({
      name: item.menu_items?.name ?? 'Item',
      quantity: item.quantity,
      unitPrice: item.menu_items?.price ?? 0,
      notes: item.notes,
    }));
    const subtotal = items.reduce((s: number, i: any) => s + i.unitPrice * i.quantity, 0);
    const taxRate = Number(order.tax_rate) || Number(settings?.tax_percentage) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const discountAmount = Number(order.discount_amount) || 0;
    const grandTotal = subtotal + taxAmount - discountAmount;

    setInvoiceData({
      orderId: order.id,
      tableLabel: order.restaurant_tables?.label ?? null,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      paymentMethod: order.payment_method,
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

  const { data: activeOrders = [] } = useQuery({
    queryKey: ['waiter_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, menu_item_id, notes, status, menu_items(name, price))')
        .eq('restaurant_id', restaurantId!)
        .in('status', ['pending', 'confirmed', 'preparing', 'ready'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 5000,
  });

  const { data: servedOrders = [] } = useQuery({
    queryKey: ['waiter_served_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, menu_item_id, notes, status, menu_items(name, price))')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'served')
        .order('updated_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

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
    queryKey: ['waiter_calls_pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waiter_calls' as any)
        .select('id, table_id, created_at, status, restaurant_tables(label)')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as any[];
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
    checkForNew(activeOrders.map((o: any) => o.id));
  }, [activeOrders, checkForNew]);

  useEffect(() => {
    checkStatusChanges(activeOrders.map((o: any) => ({ id: o.id, status: o.status })));
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
        .from('waiter_calls' as any)
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: null })
        .eq('id', callId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_calls_pending'] });
      toast.success('Call dismissed');
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
      queryClient.invalidateQueries({ queryKey: ['waiter_served_orders'] });
      toast.success('Order updated');
    },
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
  });

  const readyOrders = activeOrders.filter(o => o.status === 'ready');
  const preparingOrders = activeOrders.filter(o => o.status === 'preparing');
  const pendingOrders = activeOrders.filter(o => o.status === 'pending' || o.status === 'confirmed');
  const tableOrders = activeOrders.filter(o => o.table_id != null);

  const filteredOrders = activeTab === 'all'
    ? activeOrders
    : activeTab === 'ready'
    ? readyOrders
    : activeTab === 'preparing'
    ? preparingOrders
    : activeTab === 'served'
    ? servedOrders
    : activeTab === 'table'
    ? tableOrders
    : pendingOrders;

  const tabs = [
    { id: 'all' as const, label: 'All', count: activeOrders.length },
    { id: 'table' as const, label: 'Table QR', count: tableOrders.length },
    { id: 'ready' as const, label: 'Ready', count: readyOrders.length },
    { id: 'preparing' as const, label: 'Cooking', count: preparingOrders.length },
    { id: 'pending' as const, label: 'Pending', count: pendingOrders.length },
    { id: 'served' as const, label: 'Served', count: servedOrders.length },
  ];

  const subtitle = `${activeOrders.length} active · ${readyOrders.length} ready`;

  return (
    <WaiterLayout title="Service" subtitle={subtitle}>
      <div className="p-3 sm:p-4 lg:p-6 xl:p-8 max-w-3xl">
        {/* Sound toggle */}
        <div className="flex items-center justify-end mb-4">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSoundEnabled(p => !p)}
          >
            {soundEnabled ? (
              <Volume2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            ) : (
              <VolumeX className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            )}
          </Button>
        </div>

        {/* ─── Waiter calls banner ────────────────────────── */}
        <AnimatePresence>
          {waiterCalls.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-4 space-y-2"
            >
              {waiterCalls.map((call: any) => (
                <div
                  key={call.id}
                  className="bg-primary/5 border border-primary/15 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                  <span className="relative flex h-2.5 w-2.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-primary">
                      🔔 {(call as any).restaurant_tables?.label || 'Table'} is calling
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(call.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 h-8 text-xs"
                    onClick={() => dismissWaiterCall.mutate(call.id)}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                    Dismiss
                  </Button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Stats strip ────────────────────────────────── */}
        {readyOrders.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            className="bg-success/5 border border-success/10 rounded-xl mb-4"
          >
            <div className="px-4 py-2.5 flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
              </span>
              <span className="text-sm font-semibold text-success">
                {readyOrders.length} order{readyOrders.length !== 1 ? 's' : ''} ready to serve
              </span>
            </div>
          </motion.div>
        )}

        {/* ─── Tab filters ────────────────────────────────── */}
        <div className="mb-4">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide -mx-3 px-3 sm:-mx-4 sm:px-4">
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

        {/* ─── Order cards ────────────────────────────────── */}
        <AnimatePresence mode="popLayout">
          {filteredOrders.length > 0 ? (
            <div className="space-y-3">
              {filteredOrders.map((order, idx) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  fmt={fmt}
                  onServe={() => updateStatus.mutate({ orderId: order.id, status: 'served' })}
                  onUpdateStatus={(status: string) => updateStatus.mutate({ orderId: order.id, status })}
                  onReassignTable={(tableId) => reassignTable.mutate({ orderId: order.id, tableId })}
                  onPrintInvoice={() => handlePrintInvoice(order)}
                  onModifyOrder={() => setModifyOrder(order)}
                  tables={tables}
                  index={idx}
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
                <ClipboardList className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
              </div>
              <p className="text-muted-foreground font-medium">No active orders</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {activeTab === 'all' ? 'Orders will appear here in real-time' : `No ${activeTab} orders right now`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <InvoiceReceipt open={invoiceOpen} onOpenChange={setInvoiceOpen} data={invoiceData} />
      <ModifyOrderDialog open={!!modifyOrder} onOpenChange={(o) => !o && setModifyOrder(null)} order={modifyOrder} />
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
}: {
  order: any;
  fmt: (n: number) => string;
  onServe: () => void;
  onUpdateStatus: (status: string) => void;
  onReassignTable: (tableId: string | null) => void;
  onPrintInvoice: () => void;
  onModifyOrder: () => void;
  tables: { id: string; label: string }[];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showTablePicker, setShowTablePicker] = useState(false);
  const config = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;
  const items: any[] = order.order_items ?? [];
  const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
  const isReady = order.status === 'ready';
  const hasNotes = items.some((i: any) => i.notes) || order.notes;

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
  }, [x, isReady]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    if (isReady && info.offset.x < SWIPE_THRESHOLD) {
      if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
      onServe();
    }
  };

  const cardContent = (
    <>
      {/* Card header — tappable to expand */}
      <div
        className="px-4 pt-4 pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className={`h-9 w-9 rounded-lg ${config.bg} flex items-center justify-center`}>
              <StatusIcon className={`h-4 w-4 ${config.color}`} strokeWidth={2} />
            </div>
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-card-foreground text-[15px]">
                  {order.restaurant_tables?.label ?? 'Takeaway'}
                </span>
                {order.table_id && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider bg-accent text-accent-foreground flex items-center gap-0.5">
                    <UtensilsCrossed className="h-2.5 w-2.5" strokeWidth={2} />
                    QR
                  </span>
                )}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${config.bg} ${config.color}`}>
                  {config.label}
                </span>
                {hasNotes && !expanded && (
                  <AlertCircle className="h-3.5 w-3.5 text-warning" strokeWidth={2} />
                )}
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
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-base font-bold tabular-nums text-card-foreground">{fmt(Number(order.total_amount))}</span>
            <motion.div
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            </motion.div>
          </div>
        </div>
      </div>

      {/* Collapsed preview */}
      {!expanded && items.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-muted-foreground truncate">
            {items.map((i: any) => `${i.quantity}× ${i.menu_items?.name ?? 'Item'}`).join(', ')}
          </p>
        </div>
      )}

      {/* Expanded full item list */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3">
              <div className="bg-secondary/50 rounded-lg px-3 py-2.5 space-y-2">
                {items.map((item: any) => (
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
              {order.notes && (
                <div className="mt-2 px-1 flex items-start gap-1.5">
                  <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" strokeWidth={2} />
                  <p className="text-[11px] text-warning">{order.notes}</p>
                </div>
              )}

              {/* Action links */}
              <div className="mt-2 flex items-center gap-2 sm:gap-3 flex-wrap">
                <button
                  onClick={(e) => { e.stopPropagation(); onPrintInvoice(); }}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  <Printer className="h-3 w-3" strokeWidth={2} />
                  Print Invoice
                </button>

                {order.status !== 'served' && (
                  <>
                    <span className="text-border">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onModifyOrder(); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <Pencil className="h-3 w-3" strokeWidth={2} />
                      Modify
                    </button>
                    <span className="text-border">|</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowTablePicker(p => !p); }}
                      className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
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

      {/* Action footer — order processing */}
      {order.status !== 'served' && (
        <div className="px-4 pb-3 space-y-2">
          <div className="flex gap-2">
            {(order.status === 'pending' || order.status === 'confirmed') && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs font-semibold"
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus('confirmed'); }}
                  disabled={order.status === 'confirmed'}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Confirm
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs font-semibold bg-primary hover:bg-primary/90"
                  onClick={(e) => { e.stopPropagation(); onUpdateStatus('preparing'); }}
                >
                  <ChefHat className="h-3.5 w-3.5 mr-1" />
                  Start Cooking
                </Button>
              </>
            )}
            {order.status === 'preparing' && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs font-semibold bg-success hover:bg-success/90 text-success-foreground"
                onClick={(e) => { e.stopPropagation(); onUpdateStatus('ready'); }}
              >
                <Bell className="h-3.5 w-3.5 mr-1" />
                Mark Ready
              </Button>
            )}
            {isReady && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs font-semibold bg-success hover:bg-success/90 text-success-foreground"
                onClick={(e) => { e.stopPropagation(); onServe(); }}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Mark Served
              </Button>
            )}
            {order.status !== 'ready' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => { e.stopPropagation(); onUpdateStatus('cancelled'); }}
              >
                Cancel
              </Button>
            )}
          </div>
          {isReady && (
            <p className="text-[11px] text-muted-foreground text-center flex items-center justify-center gap-1.5">
              <ArrowLeft className="h-3 w-3" strokeWidth={2} />
              Or swipe left to serve
            </p>
          )}
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
      className={`relative rounded-xl overflow-hidden ${isReady ? '' : ''}`}
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
        drag={isReady ? 'x' : false}
        dragConstraints={{ left: -150, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        className={`relative bg-card rounded-xl overflow-hidden card-shadow ring-1 ${config.ring} ${isReady ? 'ring-2' : ''}`}
      >
        {cardContent}
      </motion.div>
    </motion.div>
  );
}
