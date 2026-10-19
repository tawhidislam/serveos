import { useState, useMemo, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrency } from '@/lib/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Receipt, CreditCard, Banknote, Smartphone,
  Percent, Tag, CheckCircle2, Search, Printer, RefreshCw, FileText, Download, CalendarIcon, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfDay, endOfDay, isBefore, isAfter, subDays, parseISO } from 'date-fns';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid } from 'recharts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import InvoiceReceipt, { type InvoiceData } from '@/components/InvoiceReceipt';
import { readPaymentAllocations } from '@/lib/pos-checkout';

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
  payment_method: string | null;
  payment_splits?: unknown;
  paid_at: string | null;
  tax_rate: number;
  discount_amount: number;
  restaurant_tables: { label: string } | null;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  menu_item_id: string;
  quantity: number;
  unit_price: number | null;
  notes: string | null;
  status: string;
  menu_items: { name: string; price: number } | null;
};

type PaymentMethod = 'cash' | 'card' | 'mobile';

const paymentMethods: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
];

/* ── component ─────────────────────────────────────── */
export default function BillingPage() {
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [searchQuery, setSearchQuery] = useState('');
  const [showPaid, setShowPaid] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>(undefined);
  const [dateTo, setDateTo] = useState<Date | undefined>(undefined);
  const [billOrder, setBillOrder] = useState<OrderRow | null>(null);
  const [taxRate, setTaxRate] = useState(10); // default 10%
  const [discountAmount, setDiscountAmount] = useState(0);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [showInvoice, setShowInvoice] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');

  /* ── queries ── */
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['billing_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label)')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderRow[];
    },
    refetchInterval: 10000,
  });

  /* ── realtime ── */
  useEffect(() => {
    const ch = supabase
      .channel('billing-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        qc.invalidateQueries({ queryKey: ['billing_orders'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const { data: billItems = [], isPending: billItemsPending, isError: billItemsError } = useQuery({
    queryKey: ['bill_items', billOrder?.id],
    enabled: !!billOrder,
    queryFn: async () => {
      if (!billOrder) return [];
      const { data, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name, price)')
        .eq('order_id', billOrder.id);
      if (error) throw error;
      return (data ?? []) as OrderItemRow[];
    },
  });

  /* ── mutations ── */
  const markPaid = useMutation({
    mutationFn: async ({
      orderId, payment, tax, discount,
    }: {
      orderId: string; payment: PaymentMethod; tax: number; discount: number;
    }) => {
      if (!restaurantId) throw new Error('Restaurant is not loaded.');
      const { error } = await supabase.rpc('pos_settle_order', { _restaurant: restaurantId, _order: orderId, _payment: payment, _tax_rate: tax, _discount: discount });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing_orders'] });
      setBillOrder(null);
      toast.success('Payment recorded');
    },
    onError: (e: any) => toast.error(e.message),
  });

  /* ── filtering ── */
  const filtered = useMemo(() => {
    let list = orders;
    if (!showPaid) {
      list = list.filter(o => !o.paid_at && o.status !== 'cancelled');
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
        o.restaurant_tables?.label?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [orders, showPaid, searchQuery, dateFrom, dateTo]);

  /* ── summary stats ── */
  const summary = useMemo(() => {
    const paid = filtered.filter(o => !!o.paid_at);
    const totalRevenue = paid.reduce((s, o) => s + o.total_amount, 0);
    const totalTax = paid.reduce((s, o) => s + o.total_amount * (o.tax_rate / (100 + o.tax_rate)), 0);
    const totalDiscount = paid.reduce((s, o) => s + o.discount_amount, 0);
    return { totalRevenue, totalTax, totalDiscount, paidCount: paid.length };
  }, [filtered]);

  /* ── payment method breakdown ── */
  const paymentBreakdown = useMemo(() => {
    const paid = filtered.filter(o => !!o.paid_at);
    const breakdown = { cash: 0, card: 0, mobile: 0 } as Record<string, number>;
    for (const o of paid) {
      const allocations = readPaymentAllocations(o.payment_splits);
      if (allocations.length) for (const allocation of allocations) breakdown[allocation.method] = (breakdown[allocation.method] ?? 0) + allocation.amount;
      else { const method = o.payment_method || 'cash'; breakdown[method] = (breakdown[method] ?? 0) + o.total_amount; }
    }
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    return { breakdown, total };
  }, [filtered]);

  /* ── daily revenue trend ── */
  const dailyRevenue = useMemo(() => {
    const paid = filtered.filter(o => !!o.paid_at);
    const dayMap = new Map<string, number>();
    for (const o of paid) {
      const day = format(new Date(o.paid_at!), 'yyyy-MM-dd');
      dayMap.set(day, (dayMap.get(day) ?? 0) + o.total_amount);
    }
    // Fill last 14 days (or range) with zeros for continuity
    const days: { date: string; label: string; revenue: number }[] = [];
    const sorted = Array.from(dayMap.keys()).sort();
    const start = sorted.length > 0 ? parseISO(sorted[0]) : subDays(new Date(), 13);
    const end = sorted.length > 0 ? parseISO(sorted[sorted.length - 1]) : new Date();
    const diff = Math.max(Math.ceil((end.getTime() - start.getTime()) / 86400000), 0);
    for (let i = 0; i <= diff; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = format(d, 'yyyy-MM-dd');
      days.push({ date: key, label: format(d, 'MMM d'), revenue: dayMap.get(key) ?? 0 });
    }
    return days;
  }, [filtered]);

  /* ── bill calculations ── */
  const subtotal = useMemo(
    () => billItems.reduce((s, i) => s + (i.unit_price ?? i.menu_items?.price ?? 0) * i.quantity, 0),
    [billItems],
  );
  const taxAmount = subtotal * (taxRate / 100);
  const grandTotal = subtotal + taxAmount - discountAmount;

  const openBill = (order: OrderRow) => {
    setBillOrder(order);
    setTaxRate(order.tax_rate ?? 0);
    setDiscountAmount(order.discount_amount || 0);
    setSelectedPayment((order.payment_method as PaymentMethod) || 'cash');
  };

  const exportCSV = () => {
    if (!filtered.length) { toast.info('No orders to export'); return; }
    const headers = ['Order ID', 'Table', 'Status', 'Total', 'Tax Rate %', 'Discount', 'Payment Method', 'Paid At', 'Created At'];
    const rows = filtered.map(o => [
      o.id,
      o.restaurant_tables?.label ?? '-',
      o.status,
      o.total_amount,
      o.tax_rate,
      o.discount_amount,
      o.payment_method ?? '-',
      o.paid_at ? format(new Date(o.paid_at), 'yyyy-MM-dd HH:mm') : '-',
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `billing_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} orders`);
  };

  return (
    <AdminLayout title="Billing & Payments" subtitle={`${filtered.filter(o => !o.paid_at).length} unpaid orders`}>
      <div className="p-4 lg:p-6 max-w-5xl space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <Input
              placeholder="Search by table or order ID…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1 text-xs', !dateFrom && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateFrom ? format(dateFrom, 'MMM d') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus />
              </PopoverContent>
            </Popover>
            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn('gap-1 text-xs', !dateTo && 'text-muted-foreground')}>
                  <CalendarIcon className="h-3.5 w-3.5" />
                  {dateTo ? format(dateTo, 'MMM d') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus />
              </PopoverContent>
            </Popover>
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            )}
            <button
              onClick={() => setShowPaid(p => !p)}
              className={`px-4 py-2 rounded-full text-xs font-medium transition-colors ${
                showPaid
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {showPaid ? 'Showing All' : 'Show Paid'}
            </button>
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1" disabled={!filtered.length}>
              <Download className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Summary Bar */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-card card-shadow ring-subtle rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
              <p className="text-lg font-semibold text-card-foreground">{fmt(summary.totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">{summary.paidCount} paid</p>
            </div>
            <div className="bg-card card-shadow ring-subtle rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Tax Collected</p>
              <p className="text-lg font-semibold text-card-foreground">{fmt(summary.totalTax)}</p>
            </div>
            <div className="bg-card card-shadow ring-subtle rounded-lg p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Discounts Given</p>
              <p className="text-lg font-semibold text-card-foreground">{fmt(summary.totalDiscount)}</p>
            </div>
          </div>
        )}

        {/* Payment Method Breakdown */}
        {paymentBreakdown.total > 0 && (
          <div className="bg-card card-shadow ring-subtle rounded-lg p-4">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Payment Method Breakdown</h3>
            <div className="space-y-2.5">
              {([
                { key: 'cash', label: 'Cash', icon: Banknote, color: 'bg-emerald-500' },
                { key: 'card', label: 'Card', icon: CreditCard, color: 'bg-blue-500' },
                { key: 'mobile', label: 'Mobile', icon: Smartphone, color: 'bg-violet-500' },
              ] as const).map(({ key, label, icon: Icon, color }) => {
                const amount = paymentBreakdown.breakdown[key] || 0;
                const pct = paymentBreakdown.total > 0 ? (amount / paymentBreakdown.total) * 100 : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex items-center gap-2 w-20 shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span className="text-xs text-muted-foreground">{label}</span>
                    </div>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.5, ease: 'easeOut' }}
                        className={`h-full ${color} rounded-full`}
                      />
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-32 justify-end">
                      <span className="text-xs font-medium tabular-nums text-card-foreground">{fmt(amount)}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums w-10 text-right">{pct.toFixed(0)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Daily Revenue Trend */}
        {dailyRevenue.length > 1 && (
          <div className="bg-card card-shadow ring-subtle rounded-lg p-4">
            <h3 className="text-sm font-semibold text-card-foreground mb-3">Daily Revenue Trend</h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyRevenue} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                    width={40}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    formatter={(value: number) => [fmt(value), 'Revenue']}
                    labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#revenueGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Orders List */}
        {isLoading ? (
          <div className="text-center py-16">
            <RefreshCw className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p>No orders to bill</p>
          </div>
        ) : (
          <div className="grid gap-3">
            <AnimatePresence mode="popLayout">
              {filtered.map(order => {
                const isPaid = !!order.paid_at;
                return (
                  <motion.div
                    key={order.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className={`bg-card card-shadow ring-subtle rounded-lg p-4 ${isPaid ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-card-foreground">
                            {order.restaurant_tables?.label ?? 'No table'}
                          </span>
                          <Badge variant={isPaid ? 'secondary' : 'default'} className="text-xs">
                            {isPaid ? 'Paid' : order.status}
                          </Badge>
                          {order.payment_method && (
                            <span className="text-xs text-muted-foreground capitalize">
                              via {order.payment_method}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(order.created_at), 'MMM d, h:mm a')}
                          <span className="mx-1">·</span>
                          #{order.id.slice(0, 8)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-lg font-bold tabular-nums text-card-foreground">
                          {fmt(Number(order.total_amount))}
                        </span>
                        {!isPaid && (
                          <Button size="sm" onClick={() => openBill(order)} className="gap-1">
                            <Receipt className="h-4 w-4" strokeWidth={1.5} />
                            Bill
                          </Button>
                        )}
                        {isPaid && (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-xs h-7"
                              onClick={() => {
                                // Load items for invoice
                                supabase
                                  .from('order_items')
                                  .select('*, menu_items(name, price)')
                                  .eq('order_id', order.id)
                                  .then(({ data: items }) => {
                                    const orderItems = (items ?? []) as any[];
                                    const sub = orderItems.reduce((s: number, i: any) => s + (i.unit_price ?? i.menu_items?.price ?? 0) * i.quantity, 0);
                                    const tax = order.tax_rate || 0;
                                    const taxAmt = sub * (tax / 100);
                                    const disc = order.discount_amount || 0;
                                    setInvoiceData({
                                      orderId: order.id,
                                      tableLabel: order.restaurant_tables?.label,
                                      createdAt: order.created_at,
                                      paidAt: order.paid_at,
                                      paymentMethod: order.payment_method,
                                      paymentSplits: readPaymentAllocations(order.payment_splits),
                                      items: orderItems.map((i: any) => ({
                                        name: i.menu_items?.name ?? 'Unknown',
                                        quantity: i.quantity,
                                        unitPrice: i.unit_price ?? i.menu_items?.price ?? 0,
                                        notes: i.notes,
                                      })),
                                      subtotal: sub,
                                      taxRate: tax,
                                      taxAmount: taxAmt,
                                      discountAmount: disc,
                                      grandTotal: Math.max(0, sub + taxAmt - disc),
                                    });
                                    setShowInvoice(true);
                                  });
                              }}
                            >
                              <FileText className="h-3 w-3" strokeWidth={1.5} />
                              Invoice
                            </Button>
                            {order.paid_at && (
                              <span className="text-xs text-success flex items-center gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                {format(new Date(order.paid_at), 'h:mm a')}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── Bill Dialog ── */}
      <Dialog open={!!billOrder} onOpenChange={open => !open && setBillOrder(null)}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" strokeWidth={1.5} />
              Bill — {billOrder?.restaurant_tables?.label ?? 'Order'}
            </DialogTitle>
            <DialogDescription>
              #{billOrder?.id.slice(0, 8)} · {billOrder && format(new Date(billOrder.created_at), 'MMM d, h:mm a')}
            </DialogDescription>
          </DialogHeader>

          {/* Items */}
          <div className="space-y-1 border-b border-border pb-3">
            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wider px-1 mb-2">
              <span>Item</span>
              <span>Amount</span>
            </div>
            {billItems.map(item => (
              <div key={item.id} className="flex items-start justify-between gap-2 py-1.5 px-1">
                <div className="min-w-0">
                  <p className="text-sm text-foreground">
                    <span className="text-muted-foreground">{item.quantity}×</span>{' '}
                    {item.menu_items?.name ?? 'Unknown'}
                  </p>
                  {item.notes && <p className="text-xs text-muted-foreground">{item.notes}</p>}
                </div>
                <span className="text-sm tabular-nums text-foreground shrink-0">
                  {fmt((item.unit_price ?? item.menu_items?.price ?? 0) * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Tax & Discount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm tabular-nums font-medium text-foreground">{fmt(subtotal)}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Percent className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground whitespace-nowrap">Tax %</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={taxRate}
                  onChange={e => setTaxRate(Number(e.target.value) || 0)}
                  className="h-8 w-20 text-right"
                />
              </div>
              <span className="text-sm tabular-nums text-foreground">+{fmt(taxAmount)}</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground">Discount</span>
                <Input
                  type="number"
                  min={0}
                  value={discountAmount}
                  onChange={e => setDiscountAmount(Number(e.target.value) || 0)}
                  className="h-8 w-24 text-right"
                />
              </div>
              {discountAmount > 0 && (
                <span className="text-sm tabular-nums text-destructive">-{fmt(discountAmount)}</span>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-semibold text-foreground">Total</span>
              <span className="text-xl font-bold tabular-nums text-foreground">
                {fmt(Math.max(0, grandTotal))}
              </span>
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Payment Method</p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map(pm => {
                const Icon = pm.icon;
                const active = selectedPayment === pm.key;
                return (
                  <button
                    key={pm.key}
                    onClick={() => setSelectedPayment(pm.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      active
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-border/80 bg-card'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
                      {pm.label}
                    </span>
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
              disabled={markPaid.isPending || billItemsPending || billItemsError || billItems.length === 0 || !Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100 || !Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > subtotal || Math.abs(discountAmount * 100 - Math.round(discountAmount * 100)) > 0.000001}
              onClick={() =>
                billOrder &&
                markPaid.mutate({
                  orderId: billOrder.id,
                  payment: selectedPayment,
                  tax: taxRate,
                  discount: discountAmount,
                })
              }
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              Mark as Paid — {fmt(Math.max(0, grandTotal))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Receipt Dialog */}
      <InvoiceReceipt open={showInvoice} onOpenChange={setShowInvoice} data={invoiceData} />
    </AdminLayout>
  );
}
