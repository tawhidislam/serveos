import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCurrency } from '@/lib/currency';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { DollarSign, Clock, ShoppingCart, LayoutGrid, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/admin/AdminLayout';
import StatCard from '@/components/admin/StatCard';
import RevenueChart from '@/components/admin/RevenueChart';
import OrderStatusCard from '@/components/admin/OrderStatusCard';
import TopItemsCard from '@/components/admin/TopItemsCard';
import CtaAnalyticsCard from '@/components/admin/CtaAnalyticsCard';

interface DashboardStats {
  todayRevenue: number;
  todayOrders: number;
  activeOrders: number;
  totalTables: number;
  occupiedTables: number;
  statusBreakdown: Record<string, number>;
  topItems: { name: string; count: number; revenue: number }[];
  revenueByHour: { hour: number; revenue: number }[];
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function AdminDashboard() {
  const { format: fmt, formatInt } = useCurrency();
  const queryClient = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;

  const { data: stats, dataUpdatedAt } = useQuery<DashboardStats>({
    queryKey: ['admin_dashboard_stats', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];

      const [ordersRes, tablesRes, todayOrdersRes, orderItemsRes] = await Promise.all([
        supabase.from('orders').select('id, total_amount, status, created_at').eq('restaurant_id', restaurantId!),
        supabase.from('restaurant_tables').select('id, status').eq('restaurant_id', restaurantId!),
        supabase.from('orders').select('id, total_amount, created_at, status').eq('restaurant_id', restaurantId!).gte('created_at', todayStr + 'T00:00:00'),
        supabase
          .from('order_items')
          .select('quantity, menu_item_id, menu_items(name, price), order_id, orders!inner(created_at, restaurant_id)')
          .eq('orders.restaurant_id', restaurantId!)
          .gte('orders.created_at', todayStr + 'T00:00:00'),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      if (tablesRes.error) throw tablesRes.error;
      if (todayOrdersRes.error) throw todayOrdersRes.error;
      if (orderItemsRes.error) throw orderItemsRes.error;

      const orders = ordersRes.data ?? [];
      const tables = tablesRes.data ?? [];
      const todayOrders = todayOrdersRes.data ?? [];
      const todayItems = orderItemsRes.data ?? [];

      const todayRevenue = todayOrders
        .filter(o => o.status !== 'cancelled')
        .reduce((s, o) => s + Number(o.total_amount), 0);

      const activeOrders = orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length;

      const statusBreakdown: Record<string, number> = {};
      for (const o of todayOrders) {
        statusBreakdown[o.status] = (statusBreakdown[o.status] ?? 0) + 1;
      }

      const itemMap = new Map<string, { name: string; count: number; revenue: number }>();
      for (const item of todayItems) {
        const mi = item.menu_items as any;
        if (!mi) continue;
        const key = item.menu_item_id;
        const existing = itemMap.get(key) ?? { name: mi.name, count: 0, revenue: 0 };
        existing.count += item.quantity;
        existing.revenue += item.quantity * Number(mi.price);
        itemMap.set(key, existing);
      }
      const topItems = Array.from(itemMap.values()).sort((a, b) => b.count - a.count).slice(0, 5);

      const hourMap = new Map<number, number>();
      for (const o of todayOrders) {
        if (o.status === 'cancelled') continue;
        const h = new Date(o.created_at).getHours();
        hourMap.set(h, (hourMap.get(h) ?? 0) + Number(o.total_amount));
      }
      const revenueByHour: { hour: number; revenue: number }[] = [];
      for (let h = 6; h <= 23; h++) {
        revenueByHour.push({ hour: h, revenue: hourMap.get(h) ?? 0 });
      }

      return {
        todayRevenue,
        todayOrders: todayOrders.length,
        activeOrders,
        totalTables: tables.length,
        occupiedTables: tables.filter(t => t.status === 'occupied').length,
        statusBreakdown,
        topItems,
        revenueByHour,
      };
    },
  });

  // Realtime subscription for faster updates
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['admin_dashboard_stats'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const statCards = [
    { label: "Today's Revenue", value: stats ? fmt(stats.todayRevenue) : '—', icon: DollarSign, color: 'text-success', bgColor: 'bg-success/10' },
    { label: 'Orders Today', value: stats?.todayOrders ?? '—', icon: ShoppingCart, color: 'text-primary', bgColor: 'bg-primary/10' },
    { label: 'Active Now', value: stats?.activeOrders ?? '—', icon: Clock, color: 'text-warning', bgColor: 'bg-warning/10' },
    { label: 'Table Occupancy', value: stats ? `${stats.occupiedTables}/${stats.totalTables}` : '—', icon: LayoutGrid, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  ];

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <AdminLayout title="Dashboard">
      <div className="p-4 lg:p-6 xl:p-8 space-y-6 max-w-[1280px]">
        {/* Welcome header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex items-end justify-between"
        >
          <div>
            <h2 className="text-xl lg:text-2xl font-bold tracking-tight text-foreground">
              {getGreeting()} 👋
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Here's what's happening with your restaurant today.
            </p>
          </div>
          {lastUpdated && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
              <RefreshCw className="h-3 w-3" strokeWidth={2} />
              Updated {lastUpdated}
            </div>
          )}
        </motion.div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {statCards.map((card, i) => (
            <StatCard key={card.label} {...card} index={i} />
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3">
            <RevenueChart data={stats?.revenueByHour ?? []} formatInt={formatInt} />
          </div>
          <div className="lg:col-span-2">
            <OrderStatusCard
              statusBreakdown={stats?.statusBreakdown ?? {}}
              todayOrders={stats?.todayOrders ?? 0}
            />
          </div>
        </div>

        {/* Top Items */}
        <TopItemsCard items={stats?.topItems ?? []} format={fmt} />

        {/* Website CTA performance */}
        <CtaAnalyticsCard />
      </div>
    </AdminLayout>
  );
}
