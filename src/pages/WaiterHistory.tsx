import { useQuery } from '@tanstack/react-query';
import { useCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { ClipboardList, Timer, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatDistanceToNowStrict } from 'date-fns';
import WaiterLayout from '@/components/waiter/WaiterLayout';

export default function WaiterHistory() {
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;

  const { data: servedOrders = [] } = useQuery({
    queryKey: ['waiter_served_orders_full', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*, restaurant_tables(label), order_items(id, quantity, menu_item_id, notes, status, menu_items(name))')
        .eq('restaurant_id', restaurantId!)
        .eq('status', 'served')
        .order('updated_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: 15000,
  });

  return (
    <WaiterLayout title="Order History" subtitle={`${servedOrders.length} served orders`}>
      <div className="p-4 lg:p-6 xl:p-8 max-w-3xl">
        {servedOrders.length > 0 ? (
          <div className="space-y-3">
            {servedOrders.map((order, idx) => {
              const items: any[] = order.order_items ?? [];
              const totalQty = items.reduce((s: number, i: any) => s + i.quantity, 0);
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.3 }}
                  className="bg-card rounded-xl ring-1 ring-border p-4"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-card-foreground text-[15px]">
                          {order.restaurant_tables?.label ?? 'Takeaway'}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-muted/50 text-muted-foreground">
                          Served
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3 w-3" strokeWidth={1.5} />
                          {formatDistanceToNowStrict(new Date(order.updated_at), { addSuffix: true })}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Hash className="h-3 w-3" strokeWidth={1.5} />
                          {totalQty} item{totalQty !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                    <span className="text-base font-bold tabular-nums text-card-foreground">{fmt(Number(order.total_amount))}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    {items.map((i: any) => `${i.quantity}× ${i.menu_items?.name ?? 'Item'}`).join(', ')}
                  </p>
                </motion.div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="h-16 w-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <ClipboardList className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="text-muted-foreground font-medium">No served orders yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Orders you serve will appear here</p>
          </div>
        )}
      </div>
    </WaiterLayout>
  );
}
