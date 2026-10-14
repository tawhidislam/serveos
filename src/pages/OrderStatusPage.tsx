import { useEffect, useState } from 'react';
import { useCurrency } from '@/lib/currency';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Clock, ChefHat, CheckCircle2, Truck, Package } from 'lucide-react';
import WebsiteNav from '@/components/website/WebsiteNav';

const statusSteps = [
  { key: 'pending', label: 'Order Placed', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle2 },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: CheckCircle2 },
  { key: 'served', label: 'Served', icon: Truck },
];

export default function OrderStatusPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const { format: fmt } = useCurrency();

  // Guests (no account) can't read the orders table directly — RLS blocks it.
  // We fall back to a security-definer lookup keyed by the unguessable order id
  // and poll it, since realtime also requires a readable row.
  const [isPublicFallback, setIsPublicFallback] = useState(false);

  const { data: order } = useQuery({
    queryKey: ['order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurants(slug)')
        .eq('id', orderId!)
        .maybeSingle();
      if (!error && data) {
        setIsPublicFallback(false);
        return data as any;
      }
      const { data: pub, error: pubError } = await supabase.rpc('get_public_order', { _order_id: orderId! });
      if (pubError) throw pubError;
      if (!pub) return null;
      setIsPublicFallback(true);
      const o = pub as any;
      return { ...o, restaurants: o.restaurant_slug ? { slug: o.restaurant_slug } : null };
    },
    enabled: !!orderId,
    refetchInterval: isPublicFallback ? 15_000 : false,
  });

  const { data: orderItems } = useQuery({
    queryKey: ['order_items', orderId, isPublicFallback],
    queryFn: async () => {
      if (isPublicFallback) {
        const { data, error } = await supabase.rpc('get_public_order_items', { _order_id: orderId! });
        if (error) throw error;
        return (data ?? []).map((i: any) => ({
          ...i,
          menu_items: { name: i.item_name, price: i.item_price },
        }));
      }
      const { data, error } = await supabase
        .from('order_items')
        .select('*, menu_items(name, price)')
        .eq('order_id', orderId!);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!orderId && (!isPublicFallback || !!order),
  });

  useEffect(() => {
    if (!orderId) return;
    const channel = supabase
      .channel(`order-${orderId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'order_items', filter: `order_id=eq.${orderId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ['order_items', orderId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient]);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading order...</p>
      </div>
    );
  }

  const currentStepIndex = statusSteps.findIndex(s => s.key === order.status);

  return (
    <div className="min-h-screen bg-background">
      <WebsiteNav slugOverride={order.restaurants?.slug} showAccount />
      <div className="p-4 pt-24">
        <div className="max-w-lg mx-auto">
        <div className="mb-8">
          <h1 className="display-heading">Order Status</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Order #{order.id.slice(0, 8).toUpperCase()}
          </p>
        </div>

        {order.order_type && order.order_type !== 'dine_in' && (
          <div className="bg-card card-shadow ring-subtle rounded-lg p-4 mb-6 space-y-1">
            <div className="flex items-center gap-2">
              {order.order_type === 'delivery'
                ? <Truck className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                : <Package className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />}
              <h2 className="label-ui">
                {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
              </h2>
            </div>
            {order.customer_name && (
              <p className="text-sm text-card-foreground">{order.customer_name}</p>
            )}
            {order.order_type === 'delivery' && order.delivery_address && (
              <p className="text-sm text-muted-foreground">{order.delivery_address}</p>
            )}
            <p className="text-xs text-muted-foreground">Pay in cash on {order.order_type === 'delivery' ? 'delivery' : 'pickup'}.</p>
          </div>
        )}



        {/* Status Progress */}
        <div className="bg-card card-shadow ring-subtle rounded-lg p-6 mb-6">
          <div className="space-y-6">
            {statusSteps.map((step, index) => {
              const isActive = index <= currentStepIndex;
              const isCurrent = index === currentStepIndex;
              const StepIcon = step.icon;

              return (
                <div key={step.key} className="flex items-center gap-4">
                  <motion.div
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'
                    }`}
                  >
                    <StepIcon className="h-5 w-5" strokeWidth={1.5} />
                  </motion.div>
                  <div>
                    <p className={`font-medium ${isActive ? 'text-card-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-muted-foreground">In progress...</p>
                    )}
                  </div>
                  {index < statusSteps.length - 1 && (
                    <div className={`flex-1 h-px ${isActive ? 'bg-success' : 'bg-border'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Order Items */}
        <div className="bg-card card-shadow ring-subtle rounded-lg p-4">
          <h2 className="label-ui mb-3">Items</h2>
          <div className="space-y-2">
            {orderItems?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold tabular-nums text-card-foreground">{item.quantity}×</span>
                  <span className="text-sm text-card-foreground">{item.menu_items?.name}</span>
                </div>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {fmt(Number(item.menu_items?.price ?? 0) * item.quantity)}
                </span>
              </div>
            ))}
          </div>
          <div className="border-t border-border mt-3 pt-3 flex items-center justify-between">
            <span className="font-semibold text-card-foreground">Total</span>
            <span className="font-bold tabular-nums text-card-foreground">{fmt(Number(order.total_amount))}</span>
          </div>
        </div>
        </div>
      </div>
    </div>
  );
}
