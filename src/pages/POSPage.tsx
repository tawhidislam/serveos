import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format as dateFmt } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useCurrency } from '@/lib/currency';
import AdminLayout from '@/components/admin/AdminLayout';
import WaiterLayout from '@/components/waiter/WaiterLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Minus, Trash2, Receipt, CreditCard, Banknote, Smartphone,
  Percent, Tag, CheckCircle2, ShoppingCart, UtensilsCrossed,
  DollarSign, ArrowDownUp, Wallet, X, SplitSquareHorizontal, FileText,
  Printer, History, RotateCcw, Clock,
} from 'lucide-react';
import InvoiceReceipt, { type InvoiceData } from '@/components/InvoiceReceipt';
import { escapeReceiptText, posCheckoutResultSchema, posInvoice, readPaymentAllocations, splitPaymentAmounts, type PaymentAllocation } from '@/lib/pos-checkout';
import type { Json } from '@/integrations/supabase/types';

type PaymentMethod = 'cash' | 'card' | 'mobile' | 'pay_later';
type CartItem = {
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes: string;
  categoryId: string;
};

const paymentMethods: { key: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { key: 'cash', label: 'Cash', icon: Banknote },
  { key: 'card', label: 'Card', icon: CreditCard },
  { key: 'mobile', label: 'Mobile', icon: Smartphone },
  { key: 'pay_later', label: 'Pay Later', icon: Clock },
];

export default function POSPage() {
  const { user, hasAnyRole, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const isAdminOrManager = hasAnyRole(['owner', 'admin', 'manager']);

  // State
  const isMobile = useIsMobile();
  const [showMobileCart, setShowMobileCart] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSplitBill, setShowSplitBill] = useState(false);
  const [showDrawer, setShowDrawer] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [showRecentOrders, setShowRecentOrders] = useState(false);
  const [autoPrint, setAutoPrint] = useState(() => localStorage.getItem('pos_auto_print') === 'true');
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<PaymentMethod>('cash');

  // Split bill state
  const [splitCount, setSplitCount] = useState(2);
  const [splitPayments, setSplitPayments] = useState<PaymentAllocation[]>([]);
  const checkoutRequest = useRef<{ fingerprint: string; key: string } | null>(null);

  // Cash drawer state
  const [drawerAction, setDrawerAction] = useState<'open' | 'close' | 'cash_in' | 'cash_out'>('open');
  const [drawerAmount, setDrawerAmount] = useState(0);
  const [drawerNotes, setDrawerNotes] = useState('');

  // Queries
  const { data: categories = [] } = useQuery({
    queryKey: ['pos_categories', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId!).order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase.channel(`pos-availability-${restaurantId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items', filter: `restaurant_id=eq.${restaurantId}` }, () => { void qc.invalidateQueries({ queryKey: ['pos_menu_items', restaurantId] }); }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [restaurantId, qc]);

  const { data: menuItems = [] } = useQuery({
    queryKey: ['pos_menu_items', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    refetchInterval: 10000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('is_available', true)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: tables = [] } = useQuery({
    queryKey: ['pos_tables', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurant_tables').select('id, label, status').eq('restaurant_id', restaurantId!).order('label');
      if (error) throw error;
      return data;
    },
  });

  const { data: settings } = useQuery({
    queryKey: ['pos_settings', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurant_settings').select('*').eq('restaurant_id', restaurantId!).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: activeDrawer } = useQuery({
    queryKey: ['active_drawer', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cash_drawer_sessions')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'open')
        .order('opened_at', { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data.length > 0) ? data[0] : null;
    },
  });

  // Recent completed orders for reprint
  const { data: recentOrders = [] } = useQuery({
    queryKey: ['pos_recent_orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, created_at, paid_at, payment_method, payment_splits, total_amount, table_id, tax_rate, discount_amount, status, order_items(quantity, unit_price, notes, menu_items(name, price))')
        .eq('restaurant_id', restaurantId!)
        .not('paid_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  // Set tax from settings
  useEffect(() => {
    if (settings?.tax_percentage != null) setTaxRate(Number(settings.tax_percentage));
  }, [settings?.tax_percentage]);

  // Save auto-print preference
  useEffect(() => {
    localStorage.setItem('pos_auto_print', autoPrint ? 'true' : 'false');
  }, [autoPrint]);

  // Mutations
  const createOrder = useMutation({
    mutationFn: async ({ payment, tax, discount, payments }: { payment: PaymentMethod | 'split'; tax: number; discount: number; payments?: PaymentAllocation[] }) => {
      if (!user) throw new Error('Not authenticated');
      if (!restaurantId || !cart.length) throw new Error('Add items to the cart first.');
      if (!settings) throw new Error('Wait for restaurant settings to load before checkout.');
      const payload = {
        items: cart.map(item => ({ menu_item_id: item.menuItemId, quantity: item.quantity, notes: item.notes || null, expected_price: item.price })),
        table_id: selectedTable, tax_rate: tax, discount_amount: discount, payment, notes: orderNotes || null,
        ...(payments ? { payments } : {}),
      };
      const fingerprint = JSON.stringify({ restaurantId, payload });
      if (checkoutRequest.current?.fingerprint !== fingerprint) checkoutRequest.current = { fingerprint, key: crypto.randomUUID() };
      const { data, error } = await supabase.rpc('pos_checkout', {
        _restaurant: restaurantId, _request_key: checkoutRequest.current!.key, _payload: payload as unknown as Json,
      });
      if (error) throw error;
      return posCheckoutResultSchema.parse(data);
    },
    onSuccess: result => {
      const isPayLater = !result.order.paid_at;

      if (!isPayLater) {
        // Build invoice data before clearing cart
        const tableLabel = selectedTable ? tables.find(t => t.id === selectedTable)?.label : null;
        const inv = posInvoice(result, tableLabel);
        setInvoiceData(inv);
        setShowInvoice(true);

        // Auto-print if enabled
        if (autoPrint) {
          setTimeout(() => triggerPrintFromData(inv), 200);
        }
      }

      qc.invalidateQueries({ queryKey: ['active_drawer'] });
      qc.invalidateQueries({ queryKey: ['pos_recent_orders'] });
      setCart([]);
      setSelectedTable(null);
      setOrderNotes('');
      setDiscountAmount(0);
      setShowCheckout(false);
      setShowSplitBill(false); setSplitPayments([]); setSplitCount(2);
      checkoutRequest.current = null;
      toast.success(isPayLater ? 'Order sent to kitchen! Payment pending.' : 'Order placed & paid!');
    },
    onError: (e: Error) => { qc.invalidateQueries({ queryKey: ['pos_menu_items'] }); toast.error(e.message); },
  });

  // Build print HTML and trigger print from InvoiceData
  const triggerPrintFromData = (inv: InvoiceData) => {
    const rName = settings?.restaurant_name ?? 'Restaurant';
    const invNum = `INV-${inv.orderId.slice(0, 8).toUpperCase()}`;
    const orderDate = dateFmt(new Date(inv.createdAt), 'MMM d, yyyy');
    const orderTime = dateFmt(new Date(inv.createdAt), 'h:mm a');
    const itemsHTML = inv.items.map(item => `
      <div class="row"><span>${item.quantity}× ${escapeReceiptText(item.name)}</span><span>${fmt(item.unitPrice * item.quantity)}</span></div>
      ${item.notes ? `<div class="notes">⚠ ${escapeReceiptText(item.notes)}</div>` : ''}
    `).join('');
    const html = `<!DOCTYPE html><html><head><title>${invNum}</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',Courier,monospace;font-size:12px;padding:20px;max-width:320px;margin:0 auto;color:#000;background:#fff}.header{text-align:center;margin-bottom:8px}.header h1{font-size:18px;font-weight:bold;margin-bottom:4px}.header p{font-size:10px;color:#666;margin-bottom:2px}.divider{border:none;border-top:1px dashed #333;margin:10px 0}.row{display:flex;justify-content:space-between;padding:3px 0;font-size:12px}.row.light{color:#666;font-size:11px}.row.red{color:#c00}.row.total{font-size:16px;font-weight:bold;padding:6px 0}.notes{font-size:10px;color:#888;padding-left:16px;padding-bottom:2px}.footer{text-align:center;margin-top:16px;font-size:10px;color:#888}.footer p{margin-bottom:2px}@media print{body{padding:8px}@page{margin:10mm;size:80mm auto}}</style>
    </head><body>
      <div class="header"><h1>${escapeReceiptText(rName)}</h1><p>${invNum}</p><p>${orderDate} · ${orderTime}</p>${inv.tableLabel ? `<p>Table: ${escapeReceiptText(inv.tableLabel)}</p>` : ''}</div>
      <hr class="divider"/>${itemsHTML}<hr class="divider"/>
      <div class="row light"><span>Subtotal</span><span>${fmt(inv.subtotal)}</span></div>
      <div class="row light"><span>Tax (${inv.taxRate}%)</span><span>+${fmt(inv.taxAmount)}</span></div>
      ${inv.discountAmount > 0 ? `<div class="row red"><span>Discount</span><span>-${fmt(inv.discountAmount)}</span></div>` : ''}
      <hr class="divider"/><div class="row total"><span>TOTAL</span><span>${fmt(inv.grandTotal)}</span></div>
      ${inv.paymentMethod ? `<div class="row light"><span>Paid via</span><span style="text-transform:capitalize">${inv.paymentMethod}</span></div>` : ''}
      ${(inv.paymentSplits?.length ?? 0) > 1 ? inv.paymentSplits!.map((part, index) => `<div class="row light"><span>Split ${index + 1} (${part.method})</span><span>${fmt(part.amount)}</span></div>`).join('') : ''}
      <hr class="divider"/><div class="footer"><p>Thank you for dining with us!</p><p>#${inv.orderId.slice(0, 8)}</p></div>
    </body></html>`;

    const printWindow = window.open('', '_blank', 'width=400,height=700');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
    }
  };

  // Reprint receipt for a past order
  const reprintReceipt = (order: typeof recentOrders[number]) => {
    const orderItems = (order.order_items || []).map(oi => ({
      name: oi.menu_items?.name || 'Unknown',
      quantity: oi.quantity,
      unitPrice: Number(oi.unit_price ?? oi.menu_items?.price ?? 0),
      notes: oi.notes || null,
    }));
    const sub = orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    const taxAmt = sub * ((order.tax_rate || 0) / 100);
    const tableLabel = order.table_id ? tables.find(t => t.id === order.table_id)?.label : null;
    const inv: InvoiceData = {
      orderId: order.id,
      tableLabel,
      createdAt: order.created_at,
      paidAt: order.paid_at,
      paymentMethod: order.payment_method,
      paymentSplits: readPaymentAllocations(order.payment_splits),
      items: orderItems,
      subtotal: sub,
      taxRate: order.tax_rate || 0,
      taxAmount: taxAmt,
      discountAmount: Number(order.discount_amount) || 0,
      grandTotal: Number(order.total_amount),
    };
    setInvoiceData(inv);
    setShowInvoice(true);
  };

  const drawerMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Not authenticated');
      if (drawerAction === 'open') {
        const { error } = await supabase.from('cash_drawer_sessions').insert({
          opened_by: user.id,
          restaurant_id: restaurantId,
          opening_balance: drawerAmount,
          notes: drawerNotes || null,
        });
        if (error) throw error;
      } else if (drawerAction === 'close' && activeDrawer) {
        const { error } = await supabase
          .from('cash_drawer_sessions')
          .update({
            closed_by: user.id,
            closing_balance: drawerAmount,
            status: 'closed',
            closed_at: new Date().toISOString(),
            notes: drawerNotes || activeDrawer.notes,
          })
          .eq('id', activeDrawer.id);
        if (error) throw error;
      } else if (activeDrawer) {
        const field = drawerAction === 'cash_in' ? 'cash_in' : 'cash_out';
        const current = Number(activeDrawer[field]) || 0;
        const updateData = field === 'cash_in'
          ? { cash_in: current + drawerAmount }
          : { cash_out: current + drawerAmount };
        const { error } = await supabase
          .from('cash_drawer_sessions')
          .update(updateData)
          .eq('id', activeDrawer.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active_drawer'] });
      setShowDrawer(false);
      setDrawerAmount(0);
      setDrawerNotes('');
      toast.success(drawerAction === 'open' ? 'Drawer opened' : drawerAction === 'close' ? 'Drawer closed' : 'Drawer updated');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Cart helpers
  const addToCart = (item: typeof menuItems[0]) => {
    setCart(prev => {
      const existing = prev.find(c => c.menuItemId === item.id);
      if (existing) {
        return prev.map(c => c.menuItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { menuItemId: item.id, name: item.name, price: Number(item.price), quantity: 1, notes: '', categoryId: item.category_id }];
    });
  };

  const updateQty = (menuItemId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.menuItemId !== menuItemId) return c;
      const newQty = c.quantity + delta;
      return newQty <= 0 ? c : { ...c, quantity: newQty };
    }));
  };

  const removeFromCart = (menuItemId: string) => {
    setCart(prev => prev.filter(c => c.menuItemId !== menuItemId));
  };

  // Calculations
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxAmount = Math.round(Math.round(subtotal * 100) * taxRate / 100) / 100;
  const grandTotal = Math.max(0, Math.round((subtotal + taxAmount - discountAmount) * 100) / 100);
  const totalItems = cart.reduce((s, i) => s + i.quantity, 0);
  const checkoutValid = cart.length > 0 && cart.every(item => item.quantity <= 100) && Number.isFinite(taxRate) && taxRate >= 0 && taxRate <= 100 && Number.isFinite(discountAmount) && discountAmount >= 0 && discountAmount <= subtotal && Math.round(discountAmount * 100) / 100 === discountAmount;

  // Filtering
  const filteredItems = useMemo(() => {
    let items = menuItems;
    if (selectedCategory) items = items.filter(i => i.category_id === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q));
    }
    return items;
  }, [menuItems, selectedCategory, searchQuery]);

  const splitAmount = splitPaymentAmounts(grandTotal, splitCount)[splitPayments.length] ?? 0;

  // Pick layout only once roles are resolved; default to AdminLayout while
  // loading so admins/owners don't briefly see the waiter shell. ProtectedRoute
  // already gates access to this page.
  const Layout = authLoading || isAdminOrManager ? AdminLayout : WaiterLayout;

  return (
    <Layout title="Point of Sale">
      <div className="flex flex-col md:flex-row h-[calc(100dvh-8.5rem)] md:h-[calc(100vh-3.5rem)] min-h-0">
        {/* ─── Left: Menu Grid ─────────────────────────── */}
        <div className={`flex-1 flex flex-col min-w-0 md:border-r border-border ${isMobile && showMobileCart ? 'hidden' : ''}`}>
          {/* Search + Categories */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <Input
                placeholder="Search menu items…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
              <button
                onClick={() => setSelectedCategory(null)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  !selectedCategory ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                All
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Items Grid */}
          <div className="flex-1 overflow-y-auto p-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.menuItemId === item.id);
                return (
                  <motion.button
                    key={item.id}
                    aria-label={`Add ${item.name} to cart`}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => addToCart(item)}
                    className={`relative p-3 rounded-xl text-left transition-all ${
                      inCart
                        ? 'bg-primary/10 ring-2 ring-primary/30'
                        : 'bg-card ring-1 ring-border hover:ring-primary/20'
                    }`}
                  >
                    {inCart && (
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                        {inCart.quantity}
                      </span>
                    )}
                    <p className="text-sm font-medium text-card-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.description}</p>
                    <p className="text-sm font-bold text-primary mt-1.5 tabular-nums">{fmt(Number(item.price))}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ─── Right: Cart & Checkout ──────────────────── */}
        <div className={`${isMobile ? (showMobileCart ? 'flex' : 'hidden') : 'w-[340px] lg:w-[380px]'} flex-col bg-card shrink-0 ${isMobile ? 'flex-1' : ''}`}>
          {/* Mobile back button */}
          {isMobile && (
            <div className="p-2 border-b border-border">
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => setShowMobileCart(false)}>
                <X className="h-4 w-4" strokeWidth={1.5} />
                Back to Menu
              </Button>
            </div>
          )}
          {/* Table Selection */}
          <div className="p-3 border-b border-border">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Table</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedTable(null)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  !selectedTable ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                Takeaway
              </button>
              {tables.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTable(t.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    selectedTable === t.id ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-muted-foreground">Tap items to add</p>
              </div>
            ) : (
              <AnimatePresence>
                {cart.map(item => (
                  <motion.div
                    key={item.menuItemId}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-card-foreground truncate">{item.name}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{fmt(item.price)} each</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button aria-label={`Decrease ${item.name} quantity`} onClick={() => updateQty(item.menuItemId, -1)} className="h-6 w-6 rounded bg-background flex items-center justify-center hover:bg-accent">
                        <Minus className="h-3 w-3" strokeWidth={2} />
                      </button>
                      <span className="w-6 text-center text-xs font-bold tabular-nums">{item.quantity}</span>
                      <button aria-label={`Increase ${item.name} quantity`} disabled={item.quantity >= 100} onClick={() => updateQty(item.menuItemId, 1)} className="h-6 w-6 rounded bg-background flex items-center justify-center hover:bg-accent">
                        <Plus className="h-3 w-3" strokeWidth={2} />
                      </button>
                    </div>
                    <span className="text-xs font-bold tabular-nums w-16 text-right">{fmt(item.price * item.quantity)}</span>
                    <button aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.menuItemId)} className="h-6 w-6 rounded flex items-center justify-center text-muted-foreground hover:text-destructive">
                      <X className="h-3 w-3" strokeWidth={2} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Cart Summary & Actions */}
          {cart.length > 0 && (
            <div className="border-t border-border p-3 space-y-3">
              <Input
                placeholder="Order notes…"
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="space-y-1 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal ({totalItems} items)</span>
                  <span className="tabular-nums">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Tax ({taxRate}%)</span>
                  <span className="tabular-nums">+{fmt(taxAmount)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                    <span className="tabular-nums">-{fmt(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-card-foreground pt-1 border-t border-border">
                  <span>Total</span>
                  <span className="tabular-nums">{fmt(grandTotal)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs gap-1"
                  disabled={!settings}
                  onClick={() => setShowSplitBill(true)}
                >
                  <SplitSquareHorizontal className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Split Bill
                </Button>
                <Button
                  size="sm"
                  className="text-xs gap-1"
                  disabled={!settings}
                  onClick={() => setShowCheckout(true)}
                >
                  <Receipt className="h-3.5 w-3.5" strokeWidth={1.5} />
                  Checkout
                </Button>
              </div>
            </div>
          )}

          {/* POS Actions */}
          <div className="border-t border-border p-3 space-y-2">
            {/* Auto-print toggle */}
            <label className="flex items-center gap-2 cursor-pointer px-1">
              <input
                type="checkbox"
                checked={autoPrint}
                onChange={e => setAutoPrint(e.target.checked)}
                className="rounded border-input"
              />
              <span className="text-[11px] text-muted-foreground">Auto-print receipt after checkout</span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => setShowRecentOrders(true)}
              >
                <History className="h-3.5 w-3.5" strokeWidth={1.5} />
                Recent Orders
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-xs gap-1.5"
                onClick={() => {
                  setDrawerAction(activeDrawer ? 'close' : 'open');
                  setDrawerAmount(0);
                  setDrawerNotes('');
                  setShowDrawer(true);
                }}
              >
                <Wallet className="h-3.5 w-3.5" strokeWidth={1.5} />
                {activeDrawer ? 'Drawer' : 'Open Drawer'}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Cart FAB */}
      {isMobile && !showMobileCart && (
        <button
          aria-label="View cart"
          onClick={() => setShowMobileCart(true)}
          className="fixed bottom-20 right-4 z-50 h-14 min-w-14 px-4 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center gap-2 md:bottom-6 md:right-6"
        >
          <ShoppingCart className="h-5 w-5" strokeWidth={2} />
          {totalItems > 0 && (
            <>
              <span className="text-sm font-bold">{totalItems}</span>
              <span className="text-xs opacity-80">· {fmt(grandTotal)}</span>
            </>
          )}
        </button>
      )}

      {/* ─── Checkout Dialog ────────────────────────── */}
      <Dialog open={showCheckout} onOpenChange={open => { if (!createOrder.isPending) setShowCheckout(open); }}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" strokeWidth={1.5} />
              Checkout
            </DialogTitle>
            <DialogDescription>
              {selectedTable ? tables.find(t => t.id === selectedTable)?.label : 'Takeaway'} · {totalItems} items
            </DialogDescription>
          </DialogHeader>

          {/* Items summary */}
          <div className="space-y-1 border-b border-border pb-3 max-h-40 overflow-y-auto">
            {cart.map(item => (
              <div key={item.menuItemId} className="flex justify-between text-sm py-0.5 px-1">
                <span><span className="text-muted-foreground">{item.quantity}×</span> {item.name}</span>
                <span className="tabular-nums">{fmt(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          {/* Tax & Discount */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-sm tabular-nums font-medium">{fmt(subtotal)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Percent className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground whitespace-nowrap">Tax %</span>
                <Input aria-label="Tax percentage" disabled={createOrder.isPending} type="number" min={0} max={100} value={taxRate} onChange={e => setTaxRate(Number(e.target.value) || 0)} className="h-8 w-20 text-right" />
              </div>
              <span className="text-sm tabular-nums">+{fmt(taxAmount)}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 flex-1">
                <Tag className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-sm text-muted-foreground">Discount</span>
                <Input aria-label="Discount amount" disabled={createOrder.isPending} type="number" min={0} max={subtotal} step="0.01" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value) || 0)} className="h-8 w-24 text-right" />
              </div>
              {discountAmount > 0 && <span className="text-sm tabular-nums text-destructive">-{fmt(discountAmount)}</span>}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-base font-semibold">Total</span>
              <span className="text-xl font-bold tabular-nums">{fmt(grandTotal)}</span>
            </div>
          </div>

          {/* Payment Method */}
          {!checkoutValid && <p role="alert" className="text-sm text-destructive">Use quantities from 1 to 100, tax from 0 to 100%, and a discount no greater than the subtotal.</p>}
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Payment Method</p>
            <div className="grid grid-cols-4 gap-2">
              {paymentMethods.map(pm => {
                const Icon = pm.icon;
                const active = selectedPayment === pm.key;
                return (
                  <button
                    key={pm.key}
                    disabled={createOrder.isPending}
                    onClick={() => setSelectedPayment(pm.key)}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border-2 transition-all ${
                      active ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80 bg-card'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>{pm.label}</span>
                  </button>
                );
              })}
            </div>
            {selectedPayment === 'pay_later' && (
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {selectedTable
                  ? 'Order will be sent to kitchen. Payment collected later from the table.'
                  : 'Walk-in tab — order will be sent to kitchen. Payment collected later.'}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button disabled={createOrder.isPending} variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={createOrder.isPending || !checkoutValid}
              onClick={() => createOrder.mutate({ payment: selectedPayment, tax: taxRate, discount: discountAmount })}
              className="gap-1"
            >
              {selectedPayment === 'pay_later' ? (
                <><UtensilsCrossed className="h-4 w-4" strokeWidth={1.5} /> Send to Kitchen</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" strokeWidth={1.5} /> Pay {fmt(grandTotal)}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Split Bill Dialog ──────────────────────── */}
      <Dialog open={showSplitBill} onOpenChange={open => { if (!createOrder.isPending) { setShowSplitBill(open); if (!open) { setSplitPayments([]); setSplitCount(2); } } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SplitSquareHorizontal className="h-5 w-5" strokeWidth={1.5} />
              Split Bill
            </DialogTitle>
            <DialogDescription>
              Total: {fmt(grandTotal)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Equal split */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Split Equally</p>
              <div className="flex items-center gap-3">
                <button aria-label="Fewer split payments" disabled={splitPayments.length > 0 || createOrder.isPending} onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <Minus className="h-4 w-4" strokeWidth={2} />
                </button>
                <div className="text-center flex-1">
                  <p className="text-2xl font-bold tabular-nums">{splitCount}</p>
                  <p className="text-xs text-muted-foreground">people</p>
                </div>
                <button aria-label="More split payments" disabled={splitPayments.length > 0 || createOrder.isPending || splitCount >= 20} onClick={() => setSplitCount(splitCount + 1)} className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80">
                  <Plus className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                <p className="text-xs text-muted-foreground">Next payment</p>
                <p className="text-xl font-bold tabular-nums text-primary">{fmt(splitAmount)}</p>
              </div>
            </div>

            {/* Per-split payment methods */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Pay Split #{(splitPayments.length + 1)}</p>
              <div className="grid grid-cols-3 gap-2">
                {paymentMethods.filter(pm => pm.key !== 'pay_later').map(pm => {
                  const Icon = pm.icon;
                  return (
                    <Button
                      key={pm.key}
                      variant="outline"
                      size="sm"
                      disabled={createOrder.isPending || !checkoutValid || grandTotal <= 0}
                      className="flex-col gap-1 h-auto py-2 text-xs"
                      onClick={() => {
                        const newPayments: PaymentAllocation[] = [...splitPayments, { method: pm.key as PaymentAllocation['method'], amount: splitAmount }];
                        if (newPayments.length >= splitCount) {
                          createOrder.mutate({ payment: 'split', payments: newPayments, tax: taxRate, discount: discountAmount });
                        } else {
                          setSplitPayments(newPayments);
                          toast.success(`Split ${newPayments.length}/${splitCount} recorded via ${pm.label}`);
                        }
                      }}
                    >
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      {pm.label}
                    </Button>
                  );
                })}
              </div>
              {splitPayments.length > 0 && (
                <div className="mt-2 space-y-1">
                  {splitPayments.map((sp, i) => (
                    <div key={i} className="flex justify-between text-xs text-muted-foreground">
                      <span>Split {i + 1}: {sp.method}</span>
                      <span className="tabular-nums">{fmt(sp.amount)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-primary font-medium">
                    {splitCount - splitPayments.length} split(s) remaining
                  </p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button disabled={createOrder.isPending} variant="outline" onClick={() => { setSplitPayments([]); setSplitCount(2); }}>Cancel</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cash Drawer Dialog ─────────────────────── */}
      <Dialog open={showDrawer} onOpenChange={setShowDrawer}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" strokeWidth={1.5} />
              Cash Drawer
            </DialogTitle>
            <DialogDescription>
              {activeDrawer ? 'Drawer is currently open' : 'No active drawer session'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {activeDrawer && (
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-lg bg-success/5 border border-success/10">
                  <p className="text-xs text-muted-foreground">Opening</p>
                  <p className="text-sm font-bold tabular-nums text-success">{fmt(Number(activeDrawer.opening_balance))}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <p className="text-xs text-muted-foreground">Cash In</p>
                  <p className="text-sm font-bold tabular-nums text-primary">{fmt(Number(activeDrawer.cash_in))}</p>
                </div>
                <div className="p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                  <p className="text-xs text-muted-foreground">Cash Out</p>
                  <p className="text-sm font-bold tabular-nums text-destructive">{fmt(Number(activeDrawer.cash_out))}</p>
                </div>
                <div className="p-2 rounded-lg bg-secondary">
                  <p className="text-xs text-muted-foreground">Expected</p>
                  <p className="text-sm font-bold tabular-nums">
                    {fmt(Number(activeDrawer.opening_balance) + Number(activeDrawer.cash_in) - Number(activeDrawer.cash_out))}
                  </p>
                </div>
              </div>
            )}

            {/* Action tabs */}
            <div className="flex gap-1 overflow-x-auto">
              {(activeDrawer ? [
                { key: 'cash_in' as const, label: 'Cash In' },
                { key: 'cash_out' as const, label: 'Cash Out' },
                { key: 'close' as const, label: 'Close Drawer' },
              ] : [
                { key: 'open' as const, label: 'Open Drawer' },
              ]).map(a => (
                <button
                  key={a.key}
                  onClick={() => setDrawerAction(a.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    drawerAction === a.key ? 'bg-foreground text-background' : 'bg-secondary text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              <Input
                type="number"
                min={0}
                placeholder={drawerAction === 'open' ? 'Opening balance' : drawerAction === 'close' ? 'Closing balance' : 'Amount'}
                value={drawerAmount || ''}
                onChange={e => setDrawerAmount(Number(e.target.value) || 0)}
                className="h-10"
              />
              <Input
                placeholder="Notes (optional)"
                value={drawerNotes}
                onChange={e => setDrawerNotes(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              disabled={drawerMutation.isPending || !Number.isFinite(drawerAmount) || drawerAmount < 0}
              onClick={() => drawerMutation.mutate()}
              className="gap-1"
            >
              <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
              {drawerAction === 'open' ? 'Open Drawer' : drawerAction === 'close' ? 'Close Drawer' : 'Confirm'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recent Orders Dialog */}
      <Dialog open={showRecentOrders} onOpenChange={setShowRecentOrders}>
        <DialogContent className="max-w-md max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" strokeWidth={1.5} />
              Recent Orders
            </DialogTitle>
            <DialogDescription>Reprint receipts for recent completed orders</DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5 max-h-[60dvh] overflow-y-auto">
            {recentOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent orders</p>
            ) : (
              recentOrders.map(order => {
                const tbl = order.table_id ? tables.find(t => t.id === order.table_id)?.label : 'Takeaway';
                const itemCount = (order.order_items || []).reduce((s, oi) => s + oi.quantity, 0);
                return (
                  <div
                    key={order.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">#{order.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-[10px] h-4">{tbl}</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm font-bold tabular-nums">{fmt(Number(order.total_amount))}</span>
                        <span className="text-[11px] text-muted-foreground">· {itemCount} items</span>
                        <span className="text-[11px] text-muted-foreground capitalize">· {order.payment_method}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {dateFmt(new Date(order.created_at), 'MMM d, h:mm a')}
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => {
                          reprintReceipt(order);
                          setShowRecentOrders(false);
                        }}
                      >
                        <FileText className="h-3 w-3" strokeWidth={1.5} />
                        View
                      </Button>
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => {
                          const orderItems = (order.order_items || []).map(oi => ({
                            name: oi.menu_items?.name || 'Unknown',
                            quantity: oi.quantity,
                            unitPrice: Number(oi.unit_price ?? oi.menu_items?.price ?? 0),
                            notes: oi.notes || null,
                          }));
                          const sub = orderItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
                          const taxAmt = sub * ((order.tax_rate || 0) / 100);
                          const tableLabel = order.table_id ? tables.find(t => t.id === order.table_id)?.label : null;
                          const inv: InvoiceData = {
                            orderId: order.id,
                            tableLabel,
                            createdAt: order.created_at,
                            paidAt: order.paid_at,
                            paymentMethod: order.payment_method,
                            paymentSplits: readPaymentAllocations(order.payment_splits),
                            items: orderItems,
                            subtotal: sub,
                            taxRate: order.tax_rate || 0,
                            taxAmount: taxAmt,
                            discountAmount: Number(order.discount_amount) || 0,
                            grandTotal: Number(order.total_amount),
                          };
                          setShowRecentOrders(false);
                          triggerPrintFromData(inv);
                        }}
                      >
                        <Printer className="h-3 w-3" strokeWidth={1.5} />
                        Print
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Close</Button>
            </DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Receipt Dialog */}
      <InvoiceReceipt open={showInvoice} onOpenChange={setShowInvoice} data={invoiceData} />
    </Layout>
  );
}
