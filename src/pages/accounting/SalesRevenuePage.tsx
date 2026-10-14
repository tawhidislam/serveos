import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, ShoppingCart, CreditCard, Banknote, Receipt,
  ArrowUpRight, ArrowDownRight, CalendarDays, BarChart3,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, LineChart, Line, Area, AreaChart,
} from 'recharts';
import { format, subDays, startOfDay, endOfDay, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval } from 'date-fns';

type Period = 'today' | '7days' | '30days' | '90days';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: '7days', label: 'Last 7 Days' },
  { value: '30days', label: 'Last 30 Days' },
  { value: '90days', label: 'Last 90 Days' },
];

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(24, 80%, 65%)',
  'hsl(200, 70%, 55%)',
];

export default function SalesRevenuePage() {
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [period, setPeriod] = useState<Period>('30days');
  const [branchId, setBranchId] = useState<string>('all');

  const dateRange = useMemo(() => {
    const end = endOfDay(new Date());
    const start = period === 'today' ? startOfDay(new Date())
      : period === '7days' ? startOfDay(subDays(new Date(), 6))
      : period === '30days' ? startOfDay(subDays(new Date(), 29))
      : startOfDay(subDays(new Date(), 89));
    return { start, end };
  }, [period]);

  // Fetch branches
  const { data: branches = [] } = useQuery({
    queryKey: ['branches', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch orders in range
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['sales_orders', restaurantId ?? 'none', period, branchId],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, total_amount, status, payment_method, created_at, branch_id, tax_rate, discount_amount')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .in('status', ['served', 'completed', 'ready', 'preparing', 'confirmed', 'pending']);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q.order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch previous period for comparison
  const { data: prevOrders = [] } = useQuery({
    queryKey: ['sales_orders_prev', restaurantId ?? 'none', period, branchId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const days = period === 'today' ? 1 : period === '7days' ? 7 : period === '30days' ? 30 : 90;
      const prevEnd = subDays(dateRange.start, 1);
      const prevStart = subDays(dateRange.start, days);
      let q = supabase
        .from('orders')
        .select('id, total_amount, status, created_at, branch_id')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', startOfDay(prevStart).toISOString())
        .lte('created_at', endOfDay(prevEnd).toISOString())
        .in('status', ['served', 'completed', 'ready', 'preparing', 'confirmed', 'pending']);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Computed metrics
  const paidOrders = orders.filter(o => ['served', 'completed'].includes(o.status));
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / paidOrders.length || 0 : 0;
  const totalTax = paidOrders.reduce((s, o) => s + (Number(o.total_amount) * Number(o.tax_rate || 0) / 100), 0);
  const totalDiscount = paidOrders.reduce((s, o) => s + Number(o.discount_amount || 0), 0);

  const prevRevenue = prevOrders.filter(o => ['served', 'completed'].includes(o.status)).reduce((s, o) => s + Number(o.total_amount), 0);
  const revChange = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;
  const prevOrderCount = prevOrders.length;
  const orderChange = prevOrderCount > 0 ? ((totalOrders - prevOrderCount) / prevOrderCount) * 100 : 0;

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    paidOrders.forEach(o => {
      const method = o.payment_method || 'unspecified';
      map[method] = (map[method] || 0) + Number(o.total_amount);
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    })).sort((a, b) => b.value - a.value);
  }, [paidOrders]);

  // Daily revenue chart data
  const dailyData = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
    return days.map(day => {
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayOrders = paidOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr);
      return {
        date: period === 'today' ? format(day, 'HH:mm') : period === '90days' ? format(day, 'MMM dd') : format(day, 'EEE dd'),
        revenue: dayOrders.reduce((s, o) => s + Number(o.total_amount), 0),
        orders: dayOrders.length,
      };
    });
  }, [paidOrders, dateRange, period]);

  // Order status breakdown
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    orders.forEach(o => {
      map[o.status] = (map[o.status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [orders]);

  const statCards = [
    {
      title: 'Total Revenue',
      value: fmt(totalRevenue),
      change: revChange,
      icon: DollarSign,
      color: 'text-success',
      bg: 'bg-success/10',
    },
    {
      title: 'Total Orders',
      value: totalOrders.toString(),
      change: orderChange,
      icon: ShoppingCart,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      title: 'Avg. Order Value',
      value: fmt(avgOrderValue),
      change: null,
      icon: Receipt,
      color: 'text-warning',
      bg: 'bg-warning/10',
    },
    {
      title: 'Tax Collected',
      value: fmt(totalTax),
      change: null,
      icon: Banknote,
      color: 'text-muted-foreground',
      bg: 'bg-secondary',
    },
  ];

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 xl:p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="display-heading text-xl">Sales & Revenue</h1>
            <p className="text-sm text-muted-foreground mt-1">Track your restaurant's financial performance</p>
          </div>
          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-[160px] h-9 text-sm">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {statCards.map(card => (
            <Card key={card.title} className="relative overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className={`h-9 w-9 rounded-xl ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`h-4 w-4 ${card.color}`} strokeWidth={1.5} />
                  </div>
                  {card.change !== null && card.change !== 0 && (
                    <span className={`flex items-center gap-0.5 text-[11px] font-semibold ${card.change > 0 ? 'text-success' : 'text-destructive'}`}>
                      {card.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(card.change).toFixed(1)}%
                    </span>
                  )}
                </div>
                <p className="text-[22px] font-bold text-card-foreground mt-3 tabular-nums">{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{card.title}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Revenue chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              Revenue Over Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    interval={period === '90days' ? 6 : period === '30days' ? 3 : 0}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '13px',
                      boxShadow: 'var(--shadow-elevated)',
                    }}
                    formatter={(value: number) => [fmt(value), 'Revenue']}
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
          </CardContent>
        </Card>

        {/* Bottom row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Payment methods */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Payment Methods
              </CardTitle>
            </CardHeader>
            <CardContent>
              {paymentBreakdown.length > 0 ? (
                <div className="flex items-center gap-6">
                  <div className="h-[180px] w-[180px] shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={paymentBreakdown}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          strokeWidth={0}
                        >
                          {paymentBreakdown.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '12px',
                            fontSize: '12px',
                          }}
                          formatter={(value: number) => [fmt(value)]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-2">
                    {paymentBreakdown.map((item, idx) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }}
                        />
                        <span className="text-sm text-card-foreground flex-1">{item.name}</span>
                        <span className="text-sm font-semibold tabular-nums text-card-foreground">{fmt(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No payment data for this period</p>
              )}
            </CardContent>
          </Card>

          {/* Order status breakdown */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                Order Status Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              {statusBreakdown.length > 0 ? (
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusBreakdown} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                        tickLine={false}
                        axisLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'hsl(var(--card))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '12px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">No orders for this period</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Summary row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Discounts Given</p>
              <p className="text-lg font-bold text-destructive tabular-nums mt-1">{fmt(totalDiscount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Net Revenue</p>
              <p className="text-lg font-bold text-success tabular-nums mt-1">{fmt(totalRevenue - totalDiscount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Completed Orders</p>
              <p className="text-lg font-bold text-card-foreground tabular-nums mt-1">{paidOrders.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Pending Orders</p>
              <p className="text-lg font-bold text-warning tabular-nums mt-1">{orders.filter(o => ['pending', 'confirmed'].includes(o.status)).length}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
