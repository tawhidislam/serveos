import { useQuery } from '@tanstack/react-query';
import { useCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Clock, ChefHat, CheckCircle2, Truck, Package,
  XCircle, RotateCcw, ShoppingCart, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '@/stores/cartStore';
import { toast } from 'sonner';
import { format } from 'date-fns';

type OrderWithItems = {
  id: string;
  status: string;
  total_amount: number;
  notes: string | null;
  created_at: string;
  table_id: string | null;
  restaurant_tables: { label: string } | null;
  order_items: {
    id: string;
    quantity: number;
    notes: string | null;
    menu_items: { id: string; name: string; price: number } | null;
  }[];
};

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   class: 'bg-warning/10 text-warning',         icon: Clock },
  confirmed: { label: 'Confirmed', class: 'bg-primary/10 text-primary',         icon: Package },
  preparing: { label: 'Preparing', class: 'bg-primary/10 text-primary',         icon: ChefHat },
  ready:     { label: 'Ready',     class: 'bg-success/10 text-success',         icon: CheckCircle2 },
  served:    { label: 'Served',    class: 'bg-success/10 text-success',         icon: Truck },
  completed: { label: 'Completed', class: 'bg-muted text-muted-foreground',     icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function OrderHistory() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const { format: fmt } = useCurrency();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['customer_orders', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, notes, menu_items(id, name, price))')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OrderWithItems[];
    },
  });

  const exportCSV = () => {
    if (!orders.length) { toast.info('No orders to export'); return; }
    const headers = ['Order ID', 'Table', 'Status', 'Total', 'Items', 'Notes', 'Created At'];
    const rows = orders.map(o => [
      o.id,
      o.restaurant_tables?.label ?? '-',
      o.status,
      o.total_amount,
      o.order_items.map(i => `${i.menu_items?.name ?? '?'} x${i.quantity}`).join('; '),
      (o.notes ?? '').replace(/"/g, '""'),
      format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-orders_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${orders.length} orders`);
  };

  const handleReorder = (order: OrderWithItems) => {
    let count = 0;
    for (const item of order.order_items) {
      if (item.menu_items) {
        for (let i = 0; i < item.quantity; i++) {
          addItem({
            menuItemId: item.menu_items.id,
            name: item.menu_items.name,
            price: item.menu_items.price,
          });
          count++;
        }
      }
    }
    toast.success(`${count} item${count !== 1 ? 's' : ''} added to cart`);
    navigate('/menu');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <ShoppingCart className="h-12 w-12 text-muted-foreground/30 mb-4" strokeWidth={1} />
        <p className="text-muted-foreground mb-4">Sign in to view your order history</p>
        <Button asChild><Link to="/auth">Sign In</Link></Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border px-4 py-4 sticky top-0 z-30">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link to="/menu" className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <ArrowLeft className="h-4 w-4 text-foreground" strokeWidth={1.5} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold tracking-tight text-card-foreground">My Orders</h1>
            <p className="text-xs text-muted-foreground">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="ml-auto">
            <Button size="sm" variant="outline" onClick={exportCSV} className="gap-1" disabled={!orders.length}>
              <Download className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        {isLoading ? (
          <div className="text-center py-16">
            <div className="h-6 w-6 mx-auto rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p>No orders yet</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/menu">Browse Menu</Link>
            </Button>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {orders.map((order, i) => {
              const meta = statusConfig[order.status] ?? statusConfig.pending;
              const Icon = meta.icon;
              const canReorder = !['cancelled'].includes(order.status);
              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-card card-shadow ring-subtle rounded-lg overflow-hidden"
                >
                  {/* Header */}
                  <div className="p-4 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-card-foreground">
                          #{order.id.slice(0, 8)}
                        </span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${meta.class}`}>
                          <Icon className="h-3 w-3" strokeWidth={2} />
                          {meta.label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {format(new Date(order.created_at), 'MMM d, yyyy · h:mm a')}
                        {order.restaurant_tables?.label && (
                          <span> · {order.restaurant_tables.label}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-base font-bold tabular-nums text-card-foreground shrink-0">
                      {fmt(Number(order.total_amount))}
                    </span>
                  </div>

                  {/* Items */}
                  <div className="px-4 pb-3 space-y-1">
                    {order.order_items.slice(0, 4).map(item => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          <span className="text-foreground">{item.quantity}×</span> {item.menu_items?.name ?? 'Unknown'}
                        </span>
                        <span className="text-muted-foreground tabular-nums text-xs">
                          {fmt((item.menu_items?.price ?? 0) * item.quantity)}
                        </span>
                      </div>
                    ))}
                    {order.order_items.length > 4 && (
                      <p className="text-xs text-muted-foreground">+{order.order_items.length - 4} more items</p>
                    )}
                  </div>

                  {/* Actions */}
                  {canReorder && (
                    <div className="px-4 pb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 w-full"
                        onClick={() => handleReorder(order)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Reorder
                      </Button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
