import { useEffect, useState, useMemo } from 'react';
import { useOrderNotification } from '@/hooks/useNotifications';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrency } from '@/lib/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Link, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, Filter, ChevronDown, Clock, Eye, Merge, Split,
  UserPlus, Package, ChefHat, CheckCircle2, Truck, XCircle,
  Search, RefreshCw, AlertCircle, CalendarIcon, X, Printer, Volume2, VolumeX, Download, Trash2,
  Banknote, CreditCard, Smartphone, Wallet,
} from 'lucide-react';
import InvoiceReceipt, { InvoiceData } from '@/components/InvoiceReceipt';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

/* ── types ─────────────────────────────────────────── */
type OrderRow = {
  id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  table_id: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  payment_method: string | null;
  restaurant_tables: { label: string } | null;
  order_type: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  delivery_address: string | null;
  delivery_instructions: string | null;
  delivery_fee: number | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  menu_items: { name: string; price: number } | null;
};

type WaiterRow = {
  user_id: string;
  profiles: { display_name: string | null } | null;
};

const ALL_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled'] as const;

const statusMeta: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   class: 'bg-warning/10 text-warning',              icon: Clock },
  confirmed: { label: 'Confirmed', class: 'bg-primary/10 text-primary',              icon: Package },
  preparing: { label: 'Preparing', class: 'bg-primary/10 text-primary',              icon: ChefHat },
  ready:     { label: 'Ready',     class: 'bg-success/10 text-success',              icon: CheckCircle2 },
  served:    { label: 'Served',    class: 'bg-success/10 text-success',              icon: Truck },
  completed: { label: 'Completed', class: 'bg-muted text-muted-foreground',          icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive',      icon: XCircle },
};

/* ── component ─────────────────────────────────────── */
export default function AdminOrders() {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') || 'active';
  const initialTableSearch = searchParams.get('table_label') || '';
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [searchQuery, setSearchQuery] = useState(initialTableSearch);
  // searchQuery initialized above from query params
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [detailOrder, setDetailOrder] = useState<OrderRow | null>(null);
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);
  const [mergeMode, setMergeMode] = useState(false);
  const [splitOrder, setSplitOrder] = useState<OrderRow | null>(null);
  const [splitItems, setSplitItems] = useState<string[]>([]);
  const [assignOrder, setAssignOrder] = useState<OrderRow | null>(null);
  const [selectedWaiter, setSelectedWaiter] = useState<string>('');
  const [receiptData, setReceiptData] = useState<InvoiceData | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [deleteOrder, setDeleteOrder] = useState<OrderRow | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [settleOrder, setSettleOrder] = useState<OrderRow | null>(null);
  const [settlePayment, setSettlePayment] = useState<'cash' | 'card' | 'mobile'>('cash');

  const { checkForNew, requestPermission } = useOrderNotification({
    soundType: 'newOrder',
    enabled: soundEnabled,
    label: 'New order',
  });

  useEffect(() => { requestPermission(); }, [requestPermission]);

  /* ── queries ── */
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label)')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  // Auto-open order detail when navigating from notification
  useEffect(() => {
    const highlightId = searchParams.get('highlight');
    if (highlightId && orders.length > 0) {
      const found = orders.find(o => o.id === highlightId);
      if (found) {
        setDetailOrder(found);
      }
      setSearchParams({}, { replace: true });
    }
  }, [orders, searchParams, setSearchParams]);

  const { data: orderItems = [] } = useQuery({
    queryKey: ['admin_order_items', restaurantId ?? 'none', detailOrder?.id ?? splitOrder?.id],
    enabled: !!restaurantId && !!(detailOrder || splitOrder),
    queryFn: async () => {
      const orderId = detailOrder?.id ?? splitOrder?.id;
      if (!orderId) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name, price)')
        .eq('order_id', orderId);
      if (error) throw error;
      return (data ?? []) as OrderItemRow[];
    },
  });

  const { data: waiters = [] } = useQuery({
    queryKey: ['waiters_list'],
    enabled: !!assignOrder,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles')
        .select('user_id, profiles!inner(display_name)')
        .in('role', ['waiter', 'server']);
      if (error) throw error;
      return (data ?? []) as unknown as WaiterRow[];
    },
  });

  useEffect(() => {
    checkForNew(orders.map(o => o.id));
  }, [orders, checkForNew]);

  /* ── realtime ── */
  useEffect(() => {
    const ch = supabase
      .channel('admin-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['admin_orders'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'order_items' }, () => {
        qc.invalidateQueries({ queryKey: ['admin_order_items'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  /* ── mutations ── */
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('orders').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      toast.success('Status updated');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const settleOrderPayment = useMutation({
    mutationFn: async ({ id, payment }: { id: string; payment: string }) => {
      const { error } = await supabase.from('orders').update({
        payment_method: payment,
        paid_at: new Date().toISOString(),
      }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      setSettleOrder(null);
      toast.success('Payment settled!');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const mergeOrders = useMutation({
    mutationFn: async (orderIds: string[]) => {
      if (orderIds.length < 2) throw new Error('Select at least 2 orders');
      const targetId = orderIds[0];
      const sourceIds = orderIds.slice(1);

      // Move items from source orders into target (batched)
      const { error: moveErr } = await supabase
        .from('order_items')
        .update({ order_id: targetId })
        .in('order_id', sourceIds);
      if (moveErr) throw moveErr;

      // Recalculate total
      const { data: allItems } = await supabase
        .from('order_items')
        .select('quantity, menu_items(price)')
        .eq('order_id', targetId);
      const newTotal = (allItems ?? []).reduce(
        (s: number, i: any) => s + i.quantity * (i.menu_items?.price ?? 0), 0
      );
      await supabase.from('orders').update({ total_amount: newTotal }).eq('id', targetId);

      // Cancel source orders (batched)
      const { error: cancelErr } = await supabase
        .from('orders')
        .update({ status: 'cancelled', total_amount: 0 })
        .in('id', sourceIds);
      if (cancelErr) throw cancelErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      setMergeMode(false);
      setMergeSelection([]);
      toast.success('Orders merged');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const splitOrderMutation = useMutation({
    mutationFn: async ({ sourceOrderId, itemIds }: { sourceOrderId: string; itemIds: string[] }) => {
      if (!itemIds.length) throw new Error('Select items to split');
      const sourceOrder = orders.find(o => o.id === sourceOrderId);
      if (!sourceOrder) throw new Error('Order not found');

      // Create new order
      const { data: newOrder, error: createErr } = await supabase
        .from('orders')
        .insert({
          user_id: sourceOrder.user_id,
          table_id: sourceOrder.table_id,
          status: sourceOrder.status,
          total_amount: 0,
          restaurant_id: restaurantId!,
        })
        .select()
        .single();
      if (createErr) throw createErr;

      // Move selected items
      const { error: moveErr } = await supabase
        .from('order_items')
        .update({ order_id: newOrder.id })
        .in('id', itemIds);
      if (moveErr) throw moveErr;

      // Recalculate both totals
      for (const oid of [sourceOrderId, newOrder.id]) {
        const { data: items } = await supabase
          .from('order_items')
          .select('quantity, menu_items(price)')
          .eq('order_id', oid);
        const total = (items ?? []).reduce(
          (s: number, i: any) => s + i.quantity * (i.menu_items?.price ?? 0), 0
        );
        await supabase.from('orders').update({ total_amount: total }).eq('id', oid);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      setSplitOrder(null);
      setSplitItems([]);
      toast.success('Order split');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const assignWaiterMutation = useMutation({
    mutationFn: async ({ orderId, waiterId }: { orderId: string; waiterId: string }) => {
      // Store assigned waiter in order notes for now (could be a dedicated column)
      const order = orders.find(o => o.id === orderId);
      const waiter = waiters.find(w => w.user_id === waiterId);
      const waiterName = waiter?.profiles?.display_name ?? 'Unknown';
      const existingNotes = order?.notes ?? '';
      const newNotes = existingNotes
        ? `${existingNotes}\n[Assigned to: ${waiterName}]`
        : `[Assigned to: ${waiterName}]`;
      const { error } = await supabase.from('orders').update({ notes: newNotes }).eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      setAssignOrder(null);
      setSelectedWaiter('');
      toast.success('Waiter assigned');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Delete order items first
      const { error: itemsErr } = await supabase.from('order_items').delete().eq('order_id', orderId);
      if (itemsErr) throw itemsErr;
      // Delete the order
      const { error } = await supabase.from('orders').delete().eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_orders'] });
      setDeleteOrder(null);
      toast.success('Order deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });


  const filtered = useMemo(() => {
    let list = orders;
    if (statusFilter === 'active') {
      list = list.filter(o => !['completed', 'cancelled'].includes(o.status));
    } else if (statusFilter === 'unpaid') {
      list = list.filter(o => !o.paid_at && o.status !== 'cancelled');
    } else if (statusFilter !== 'all') {
      list = list.filter(o => o.status === statusFilter);
    }
    if (dateFrom) {
      const from = startOfDay(dateFrom);
      list = list.filter(o => !isBefore(new Date(o.created_at), from));
    }
    if (dateTo) {
      const to = endOfDay(dateTo);
      list = list.filter(o => !isAfter(new Date(o.created_at), to));
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(o =>
        o.id.toLowerCase().includes(q) ||
        o.restaurant_tables?.label?.toLowerCase().includes(q) ||
        o.notes?.toLowerCase().includes(q) ||
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.delivery_address?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, statusFilter, searchQuery, dateFrom, dateTo]);

  /* ── counts ── */
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: orders.length, active: 0, unpaid: 0 };
    for (const o of orders) {
      c[o.status] = (c[o.status] ?? 0) + 1;
      if (!['completed', 'cancelled'].includes(o.status)) c.active++;
      if (!o.paid_at && o.status !== 'cancelled') c.unpaid++;
    }
    return c;
  }, [orders]);

  const toggleMerge = (id: string) => {
    setMergeSelection(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const nextStatus = (s: string) => {
    const flow: Record<string, string> = {
      pending: 'confirmed', confirmed: 'preparing', preparing: 'ready', ready: 'served', served: 'completed',
    };
    return flow[s];
  };

  const exportCSV = () => {
    if (!filtered.length) { toast.info('No orders to export'); return; }
    const headers = ['Order ID', 'Table', 'Status', 'Total', 'Notes', 'Created At'];
    const rows = filtered.map(o => [
      o.id,
      o.restaurant_tables?.label ?? '-',
      o.status,
      o.total_amount,
      (o.notes ?? '').replace(/"/g, '""'),
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} orders`);
  };

  return (
    <AdminLayout title="Order Management" subtitle={`${counts.active} active orders`}>
      <div className="p-4 lg:p-6 max-w-6xl space-y-4">
        {/* Back to Tables + Merge controls */}
        <div className="flex items-center gap-2 justify-between">
          {searchParams.get('table_label') ? (
            <Link to="/admin/tables">
              <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground">
                <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
                Back to Tables
              </Button>
            </Link>
          ) : <div />}
          <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1">
            <Download className="h-4 w-4" strokeWidth={1.5} />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setSoundEnabled(e => !e)}
            title={soundEnabled ? 'Mute notifications' : 'Enable notifications'}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
          </Button>
          {mergeMode ? (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setMergeMode(false); setMergeSelection([]); }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={mergeSelection.length < 2 || mergeOrders.isPending}
                onClick={() => mergeOrders.mutate(mergeSelection)}
              >
                <Merge className="h-4 w-4 mr-1" strokeWidth={1.5} />
                Merge ({mergeSelection.length})
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setMergeMode(true)} className="gap-1">
              <Merge className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Merge Orders</span>
            </Button>
          )}
          </div>
        </div>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Search by table, order ID, or notes…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9", !dateFrom && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("gap-1.5 text-xs h-9", !dateTo && "text-muted-foreground")}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'MMM d') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
            {[
              { key: 'active', label: 'Active' },
              { key: 'unpaid', label: '💰 Unpaid' },
              { key: 'all', label: 'All' },
              ...ALL_STATUSES.map(s => ({ key: s, label: statusMeta[s]?.label ?? s })),
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                  statusFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                }`}
              >
                {f.label}
                {counts[f.key] != null && (
                  <span className="ml-1 opacity-70">({counts[f.key]})</span>
                )}
              </button>
            ))}
          </div>

        {/* Order List */}
        {isLoading ? (
          <div className="text-center py-16">
            <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p>No orders found</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(order => {
                const meta = statusMeta[order.status] ?? statusMeta.pending;
                const Icon = meta.icon;
                const next = nextStatus(order.status);
                const isSelected = mergeSelection.includes(order.id);

                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`bg-card card-shadow ring-subtle rounded-lg p-4 transition-all ${
                      mergeMode ? 'cursor-pointer' : ''
                    } ${isSelected ? 'ring-2 ring-primary' : ''}`}
                    onClick={mergeMode ? () => toggleMerge(order.id) : undefined}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {mergeMode && (
                            <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                              isSelected ? 'bg-primary border-primary' : 'border-border'
                            }`}>
                              {isSelected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-card-foreground">
                                {order.order_type === 'delivery'
                                  ? `Delivery — ${order.customer_name ?? 'Customer'}`
                                  : order.order_type === 'pickup'
                                    ? `Pickup — ${order.customer_name ?? 'Customer'}`
                                    : order.restaurant_tables?.label ?? 'No table'}
                              </span>
                              {order.order_type && order.order_type !== 'dine_in' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary">
                                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                                </span>
                              )}
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.class}`}>
                                <Icon className="h-3 w-3" strokeWidth={2} />
                                {meta.label}
                              </span>
                              {!order.paid_at && order.status !== 'cancelled' && (
                                <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-warning/10 text-warning">
                                  <Wallet className="h-3 w-3" strokeWidth={2} />
                                  Unpaid
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {format(new Date(order.created_at), 'MMM d, h:mm a')}
                              <span className="mx-1">·</span>
                              #{order.id.slice(0, 8)}
                            </p>
                            {order.customer_phone && (
                              <p className="text-xs text-muted-foreground mt-0.5">{order.customer_phone}</p>
                            )}
                            {order.delivery_address && (
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs">{order.delivery_address}</p>
                            )}
                            {order.delivery_instructions && (
                              <p className="text-xs text-muted-foreground mt-0.5 max-w-xs italic">{order.delivery_instructions}</p>
                            )}
                            {order.notes && (
                              <p className="text-xs text-muted-foreground mt-1 truncate max-w-xs">{order.notes}</p>
                            )}
                          </div>
                        </div>

                        <span className="text-sm font-bold tabular-nums text-card-foreground shrink-0">
                          {fmt(Number(order.total_amount))}
                        </span>
                      </div>


                      {!mergeMode && (
                        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-border/50">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setDetailOrder(order)}>
                            <Eye className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setSplitOrder(order); setSplitItems([]); }}>
                            <Split className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setAssignOrder(order); setSelectedWaiter(''); }}>
                            <UserPlus className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                          {!order.paid_at && order.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs gap-1 border-warning/50 text-warning hover:bg-warning/10"
                              onClick={() => { setSettleOrder(order); setSettlePayment('cash'); }}
                            >
                              <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Settle
                            </Button>
                          )}
                          {next && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs"
                              onClick={() => updateStatus.mutate({ id: order.id, status: next })}
                            >
                              → {statusMeta[next]?.label}
                            </Button>
                          )}
                          <div className="flex-1" />
                          {order.status !== 'cancelled' && order.status !== 'completed' && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => updateStatus.mutate({ id: order.id, status: 'cancelled' })}
                            >
                              <XCircle className="h-4 w-4" strokeWidth={1.5} />
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive/70 hover:text-destructive"
                            onClick={() => setDeleteOrder(order)}
                            title="Delete order"
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Order Detail Dialog ── */}
      <Dialog open={!!detailOrder} onOpenChange={open => !open && setDetailOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {detailOrder?.restaurant_tables?.label ?? 'Order'}
              {detailOrder && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta[detailOrder.status]?.class}`}>
                  {statusMeta[detailOrder.status]?.label}
                </span>
              )}
            </DialogTitle>
            <DialogDescription>
              {detailOrder && `Order #${detailOrder.id.slice(0, 8)} · ${format(new Date(detailOrder.created_at), 'MMM d, h:mm a')}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 max-h-80 overflow-y-auto">
            {orderItems.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {item.quantity}× {item.menu_items?.name ?? 'Unknown'}
                  </p>
                  {item.notes && <p className="text-xs text-muted-foreground mt-0.5">{item.notes}</p>}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${statusMeta[item.status]?.class ?? 'bg-muted text-muted-foreground'}`}>
                    {item.status}
                  </span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmt((item.menu_items?.price ?? 0) * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {detailOrder?.notes && (
            <div className="bg-secondary/50 rounded-md p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{detailOrder.notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-sm font-medium text-muted-foreground">Total</span>
            <span className="text-lg font-bold tabular-nums text-foreground">
              {fmt(Number(detailOrder?.total_amount ?? 0))}
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            {detailOrder && !detailOrder.paid_at && detailOrder.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-warning/50 text-warning hover:bg-warning/10"
                onClick={() => {
                  setSettleOrder(detailOrder);
                  setSettlePayment('cash');
                  setDetailOrder(null);
                }}
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
                Settle Payment
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => {
                if (!detailOrder) return;
                const subtotal = orderItems.reduce((s, i) => s + (i.menu_items?.price ?? 0) * i.quantity, 0);
                const taxRate = 0;
                const taxAmount = 0;
                const grandTotal = Number(detailOrder.total_amount);
                setReceiptData({
                  orderId: detailOrder.id,
                  tableLabel: detailOrder.restaurant_tables?.label,
                  createdAt: detailOrder.created_at,
                  items: orderItems.map(i => ({
                    name: i.menu_items?.name ?? 'Unknown',
                    quantity: i.quantity,
                    unitPrice: i.menu_items?.price ?? 0,
                    notes: i.notes,
                  })),
                  subtotal,
                  taxRate,
                  taxAmount,
                  discountAmount: 0,
                  grandTotal,
                });
                setReceiptOpen(true);
                setDetailOrder(null);
              }}
            >
              <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
              Print Receipt
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <InvoiceReceipt open={receiptOpen} onOpenChange={setReceiptOpen} data={receiptData} />

      {/* ── Settle Payment Dialog ── */}
      <Dialog open={!!settleOrder} onOpenChange={open => { if (!open) setSettleOrder(null); }}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" strokeWidth={1.5} />
              Settle Payment
            </DialogTitle>
            <DialogDescription>
              {settleOrder && (
                <>
                  Order #{settleOrder.id.slice(0, 8)} · {settleOrder.restaurant_tables?.label ?? 'No table'}
                  <br />
                  <span className="font-semibold text-foreground">{fmt(Number(settleOrder.total_amount))}</span>
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {([
                { key: 'cash' as const, label: 'Cash', icon: Banknote },
                { key: 'card' as const, label: 'Card', icon: CreditCard },
                { key: 'mobile' as const, label: 'Mobile', icon: Smartphone },
              ]).map(pm => {
                const PmIcon = pm.icon;
                const active = settlePayment === pm.key;
                return (
                  <button
                    key={pm.key}
                    onClick={() => setSettlePayment(pm.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      active ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80 bg-card'
                    }`}
                  >
                    <PmIcon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{pm.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={settleOrderPayment.isPending}
              onClick={() => settleOrder && settleOrderPayment.mutate({ id: settleOrder.id, payment: settlePayment })}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Split Order Dialog ── */}
      <Dialog open={!!splitOrder} onOpenChange={open => { if (!open) { setSplitOrder(null); setSplitItems([]); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Split Order</DialogTitle>
            <DialogDescription>
              Select items to move to a new order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {orderItems.length === 0 && (
              <p className="text-sm text-muted-foreground py-4 text-center">Loading items…</p>
            )}
            {orderItems.map(item => {
              const selected = splitItems.includes(item.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setSplitItems(prev =>
                    selected ? prev.filter(x => x !== item.id) : [...prev, item.id]
                  )}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors ${
                    selected ? 'bg-primary/10 ring-1 ring-primary' : 'bg-secondary/50 hover:bg-secondary'
                  }`}
                >
                  <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 ${
                    selected ? 'bg-primary border-primary' : 'border-border'
                  }`}>
                    {selected && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {item.quantity}× {item.menu_items?.name ?? 'Unknown'}
                    </p>
                  </div>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {fmt((item.menu_items?.price ?? 0) * item.quantity)}
                  </span>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={splitItems.length === 0 || splitItems.length === orderItems.length || splitOrderMutation.isPending}
              onClick={() => splitOrder && splitOrderMutation.mutate({ sourceOrderId: splitOrder.id, itemIds: splitItems })}
            >
              Split {splitItems.length} item{splitItems.length !== 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Waiter Dialog ── */}
      <Dialog open={!!assignOrder} onOpenChange={open => { if (!open) { setAssignOrder(null); setSelectedWaiter(''); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Waiter</DialogTitle>
            <DialogDescription>
              Assign a waiter to {assignOrder?.restaurant_tables?.label ?? 'this order'}.
            </DialogDescription>
          </DialogHeader>

          <Select value={selectedWaiter} onValueChange={setSelectedWaiter}>
            <SelectTrigger>
              <SelectValue placeholder="Select waiter…" />
            </SelectTrigger>
            <SelectContent>
              {waiters.map(w => (
                <SelectItem key={w.user_id} value={w.user_id}>
                  {w.profiles?.display_name ?? w.user_id.slice(0, 8)}
                </SelectItem>
              ))}
              {waiters.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">No waiters found</div>
              )}
            </SelectContent>
          </Select>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!selectedWaiter || assignWaiterMutation.isPending}
              onClick={() => assignOrder && assignWaiterMutation.mutate({ orderId: assignOrder.id, waiterId: selectedWaiter })}
            >
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteOrder} onOpenChange={open => !open && setDeleteOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Order</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete order #{deleteOrder?.id.slice(0, 8)}? This will remove all items and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteOrderMutation.isPending}
              onClick={() => deleteOrder && deleteOrderMutation.mutate(deleteOrder.id)}
            >
              {deleteOrderMutation.isPending ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
