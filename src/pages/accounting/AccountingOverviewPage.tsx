import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import StatCard from '@/components/admin/StatCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, ShoppingCart,
  Wallet, Package, Users, ArrowRight, AlertTriangle, Shield, CalendarIcon, GitCompareArrows,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from 'recharts';
import { format, subDays, differenceInDays, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, startOfMonth } from 'date-fns';
import type { DateRange } from 'react-day-picker';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  'hsl(var(--destructive))',
];

const PRESET_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This month', days: -1 },
];

function computeMetrics(orders: any[], expenses: any[], payrollRecords: any[], inventoryItems: any[]) {
  const paidOrders = orders.filter(o => o.status === 'paid' || o.paid_at);
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalOrders = orders.length;
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const grossProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  const totalPayroll = payrollRecords.reduce((s, p) => s + Number(p.net_pay), 0);
  const inventoryValue = inventoryItems.reduce((s, i) => s + Number(i.current_stock) * Number(i.cost_per_unit), 0);
  const lowStockItems = inventoryItems.filter(i => Number(i.current_stock) <= Number(i.min_stock));
  const taxCollected = paidOrders.reduce((s, o) => {
    const rate = Number(o.tax_rate) || 0;
    const net = Number(o.total_amount) - Number(o.discount_amount);
    return s + (rate > 0 ? net * (rate / (100 + rate)) : 0);
  }, 0);
  return { totalRevenue, totalOrders, avgOrderValue, totalExpenses, grossProfit, profitMargin, totalPayroll, inventoryValue, lowStockItems, taxCollected };
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '—';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export default function AccountingOverviewPage() {
  const { format: fmt } = useCurrency();
  const navigate = useNavigate();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [compareMode, setCompareMode] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const from = dateRange.from || subDays(new Date(), 30);
  const to = dateRange.to || new Date();
  const fromISO = from.toISOString();
  const fromDate = format(from, 'yyyy-MM-dd');
  const toDate = format(to, 'yyyy-MM-dd');
  const daySpan = differenceInDays(to, from) + 1;

  // Previous period (same length, immediately before)
  const prevTo = subDays(from, 1);
  const prevFrom = subDays(prevTo, daySpan - 1);
  const prevFromISO = prevFrom.toISOString();
  const prevFromDate = format(prevFrom, 'yyyy-MM-dd');
  const prevToDate = format(prevTo, 'yyyy-MM-dd');

  const applyPreset = (days: number) => {
    if (days === -1) {
      setDateRange({ from: startOfMonth(new Date()), to: new Date() });
    } else {
      setDateRange({ from: subDays(new Date(), days - 1), to: new Date() });
    }
  };

  // Current period data
  const { data: orders = [] } = useQuery({
    queryKey: ['acct-overview-orders', restaurantId ?? 'none', fromISO, toDate],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('total_amount, discount_amount, tax_rate, status, payment_method, created_at, paid_at').eq('restaurant_id', restaurantId!).gte('created_at', fromISO).lte('created_at', to.toISOString());
      return data || [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['acct-overview-expenses', restaurantId ?? 'none', fromDate, toDate],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount, expense_date, category_id').eq('restaurant_id', restaurantId!).gte('expense_date', fromDate).lte('expense_date', toDate);
      return data || [];
    },
  });

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['acct-overview-exp-cats', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('expense_categories').select('id, name').eq('restaurant_id', restaurantId!);
      return data || [];
    },
  });

  const { data: inventoryItems = [] } = useQuery({
    queryKey: ['acct-overview-inventory', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('inventory_items').select('name, current_stock, min_stock, cost_per_unit, is_active').eq('restaurant_id', restaurantId!).eq('is_active', true);
      return data || [];
    },
  });

  const { data: payrollRecords = [] } = useQuery({
    queryKey: ['acct-overview-payroll', restaurantId ?? 'none', fromDate, toDate],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('net_pay, status, period_start').eq('restaurant_id', restaurantId!).gte('period_start', fromDate).lte('period_start', toDate);
      return data || [];
    },
  });

  // Audit logs are global (no restaurant_id column); kept as-is
  const { data: auditCount = 0 } = useQuery({
    queryKey: ['acct-overview-audit', fromISO],
    queryFn: async () => {
      const { count } = await supabase.from('audit_logs').select('id', { count: 'exact', head: true }).gte('changed_at', fromISO).lte('changed_at', to.toISOString());
      return count || 0;
    },
  });

  // Previous period data (only fetched when compare mode is on)
  const { data: prevOrders = [] } = useQuery({
    queryKey: ['acct-overview-prev-orders', restaurantId ?? 'none', prevFromISO, prevToDate],
    enabled: compareMode && !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('total_amount, discount_amount, tax_rate, status, payment_method, created_at, paid_at').eq('restaurant_id', restaurantId!).gte('created_at', prevFromISO).lte('created_at', prevTo.toISOString());
      return data || [];
    },
  });

  const { data: prevExpenses = [] } = useQuery({
    queryKey: ['acct-overview-prev-expenses', restaurantId ?? 'none', prevFromDate, prevToDate],
    enabled: compareMode && !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount, expense_date, category_id').eq('restaurant_id', restaurantId!).gte('expense_date', prevFromDate).lte('expense_date', prevToDate);
      return data || [];
    },
  });

  const { data: prevPayrollRecords = [] } = useQuery({
    queryKey: ['acct-overview-prev-payroll', restaurantId ?? 'none', prevFromDate, prevToDate],
    enabled: compareMode && !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('net_pay, status, period_start').eq('restaurant_id', restaurantId!).gte('period_start', prevFromDate).lte('period_start', prevToDate);
      return data || [];
    },
  });

  // Computations
  const metrics = useMemo(() => computeMetrics(orders, expenses, payrollRecords, inventoryItems), [orders, expenses, payrollRecords, inventoryItems]);
  const prevMetrics = useMemo(() => compareMode ? computeMetrics(prevOrders, prevExpenses, prevPayrollRecords, inventoryItems) : null, [compareMode, prevOrders, prevExpenses, prevPayrollRecords, inventoryItems]);

  // Chart data
  const dailyChart = useMemo(() => {
    if (daySpan <= 60) {
      const days = eachDayOfInterval({ start: from, end: to });
      return days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd');
        const rev = orders.filter(o => (o.status === 'paid' || o.paid_at) && format(new Date(o.created_at), 'yyyy-MM-dd') === dayStr).reduce((s, o) => s + Number(o.total_amount), 0);
        const exp = expenses.filter(e => e.expense_date === dayStr).reduce((s, e) => s + Number(e.amount), 0);
        return { date: format(day, 'MMM dd'), revenue: rev, expenses: exp };
      });
    } else if (daySpan <= 180) {
      const weeks = eachWeekOfInterval({ start: from, end: to });
      return weeks.map((weekStart, i) => {
        const weekEnd = i < weeks.length - 1 ? weeks[i + 1] : to;
        const rev = orders.filter(o => { const d = new Date(o.created_at); return (o.status === 'paid' || o.paid_at) && d >= weekStart && d < weekEnd; }).reduce((s, o) => s + Number(o.total_amount), 0);
        const exp = expenses.filter(e => { const d = new Date(e.expense_date); return d >= weekStart && d < weekEnd; }).reduce((s, e) => s + Number(e.amount), 0);
        return { date: format(weekStart, 'MMM dd'), revenue: rev, expenses: exp };
      });
    } else {
      const months = eachMonthOfInterval({ start: from, end: to });
      return months.map(monthStart => {
        const m = format(monthStart, 'yyyy-MM');
        const rev = orders.filter(o => (o.status === 'paid' || o.paid_at) && format(new Date(o.created_at), 'yyyy-MM') === m).reduce((s, o) => s + Number(o.total_amount), 0);
        const exp = expenses.filter(e => e.expense_date.startsWith(m)).reduce((s, e) => s + Number(e.amount), 0);
        return { date: format(monthStart, 'MMM yy'), revenue: rev, expenses: exp };
      });
    }
  }, [orders, expenses, from, to, daySpan]);

  // Comparison bar chart data
  const comparisonChart = useMemo(() => {
    if (!compareMode || !prevMetrics) return [];
    return [
      { name: 'Revenue', current: metrics.totalRevenue, previous: prevMetrics.totalRevenue },
      { name: 'Expenses', current: metrics.totalExpenses, previous: prevMetrics.totalExpenses },
      { name: 'Profit', current: metrics.grossProfit, previous: prevMetrics.grossProfit },
      { name: 'Payroll', current: metrics.totalPayroll, previous: prevMetrics.totalPayroll },
    ];
  }, [compareMode, metrics, prevMetrics]);

  // Expense breakdown by category
  const expensePie = useMemo(() => {
    const catMap = new Map<string, number>();
    expenses.forEach(e => {
      const catName = expenseCategories.find(c => c.id === e.category_id)?.name || 'Uncategorized';
      catMap.set(catName, (catMap.get(catName) || 0) + Number(e.amount));
    });
    return Array.from(catMap.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [expenses, expenseCategories]);

  const quickLinks = [
    { label: 'Sales & Revenue', path: '/admin/accounting/sales', icon: TrendingUp },
    { label: 'Expenses', path: '/admin/accounting/expenses', icon: Receipt },
    { label: 'Inventory', path: '/admin/accounting/inventory', icon: Package },
    { label: 'Payroll', path: '/admin/accounting/payroll', icon: Wallet },
    { label: 'Tax Reports', path: '/admin/accounting/tax', icon: DollarSign },
    { label: 'Profit & Loss', path: '/admin/accounting/pnl', icon: TrendingDown },
    { label: 'Forecasting', path: '/admin/accounting/forecasting', icon: TrendingUp },
    { label: 'Audit Trail', path: '/admin/accounting/audit', icon: Shield },
  ];

  const periodLabel = daySpan <= 60 ? 'Daily' : daySpan <= 180 ? 'Weekly' : 'Monthly';

  const CompareRow = ({ label, current, previous, isCurrency = true }: { label: string; current: number; previous: number; isCurrency?: boolean }) => {
    const change = previous === 0 ? (current > 0 ? 100 : 0) : ((current - previous) / previous) * 100;
    const isPositive = change >= 0;
    // For expenses/payroll, increase is bad
    const invertColor = label === 'Expenses' || label === 'Payroll';
    const colorClass = change === 0 ? 'text-muted-foreground' : (invertColor ? !isPositive : isPositive) ? 'text-green-500' : 'text-destructive';

    return (
      <div className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Previous</p>
            <p className="text-sm tabular-nums">{isCurrency ? fmt(previous) : previous}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="text-sm font-semibold tabular-nums">{isCurrency ? fmt(current) : current}</p>
          </div>
          <Badge variant="outline" className={cn('text-xs tabular-nums min-w-[60px] justify-center', colorClass)}>
            {pctChange(current, previous)}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header with date range picker */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Overview</h1>
            <p className="text-sm text-muted-foreground">
              {format(from, 'MMM dd, yyyy')} — {format(to, 'MMM dd, yyyy')} ({daySpan} days)
              {compareMode && <span className="text-muted-foreground/60"> vs {format(prevFrom, 'MMM dd')} — {format(prevTo, 'MMM dd')}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-2">
              <Switch id="compare" checked={compareMode} onCheckedChange={setCompareMode} />
              <Label htmlFor="compare" className="text-xs cursor-pointer flex items-center gap-1">
                <GitCompareArrows className="h-3.5 w-3.5" /> Compare
              </Label>
            </div>
            {PRESET_RANGES.map(p => (
              <Button key={p.label} variant="outline" size="sm" className="text-xs h-8" onClick={() => applyPreset(p.days)}>
                {p.label}
              </Button>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Custom
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => { if (range) setDateRange(range); }}
                  numberOfMonths={2}
                  disabled={(date) => date > new Date()}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* KPI Cards with comparison badges */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Revenue" value={fmt(metrics.totalRevenue)} icon={DollarSign} color="text-primary" bgColor="bg-primary/10" index={0}
            trend={compareMode && prevMetrics ? (metrics.totalRevenue >= prevMetrics.totalRevenue ? 'up' : 'down') : metrics.totalRevenue > 0 ? 'up' : 'neutral'}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.totalRevenue, prevMetrics.totalRevenue) : `${daySpan}d`} />
          <StatCard label="Total Expenses" value={fmt(metrics.totalExpenses)} icon={Receipt} color="text-destructive" bgColor="bg-destructive/10" index={1}
            trend={compareMode && prevMetrics ? (metrics.totalExpenses <= prevMetrics.totalExpenses ? 'up' : 'down') : undefined}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.totalExpenses, prevMetrics.totalExpenses) : undefined} />
          <StatCard label="Gross Profit" value={fmt(metrics.grossProfit)} icon={TrendingUp} color="text-success" bgColor="bg-success/10" index={2}
            trend={compareMode && prevMetrics ? (metrics.grossProfit >= prevMetrics.grossProfit ? 'up' : 'down') : metrics.grossProfit > 0 ? 'up' : 'down'}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.grossProfit, prevMetrics.grossProfit) : `${metrics.profitMargin.toFixed(1)}%`} />
          <StatCard label="Avg Order Value" value={fmt(metrics.avgOrderValue)} icon={ShoppingCart} color="text-chart-2" bgColor="bg-chart-2/10" index={3}
            trend={compareMode && prevMetrics ? (metrics.avgOrderValue >= prevMetrics.avgOrderValue ? 'up' : 'down') : undefined}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.avgOrderValue, prevMetrics.avgOrderValue) : undefined} />
        </div>

        {/* Secondary metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Tax Collected" value={fmt(metrics.taxCollected)} icon={DollarSign} color="text-warning" bgColor="bg-warning/10" index={4}
            trend={compareMode && prevMetrics ? (metrics.taxCollected >= prevMetrics.taxCollected ? 'up' : 'down') : undefined}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.taxCollected, prevMetrics.taxCollected) : undefined} />
          <StatCard label="Payroll" value={fmt(metrics.totalPayroll)} icon={Users} color="text-chart-3" bgColor="bg-chart-3/10" index={5}
            trend={compareMode && prevMetrics ? (metrics.totalPayroll <= prevMetrics.totalPayroll ? 'up' : 'down') : undefined}
            trendLabel={compareMode && prevMetrics ? pctChange(metrics.totalPayroll, prevMetrics.totalPayroll) : undefined} />
          <StatCard label="Inventory Value" value={fmt(metrics.inventoryValue)} icon={Package} color="text-chart-4" bgColor="bg-chart-4/10" index={6} />
          <StatCard label="Audit Events" value={auditCount} icon={Shield} color="text-chart-5" bgColor="bg-chart-5/10" index={7} />
        </div>

        {/* Comparison detail table */}
        {compareMode && prevMetrics && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <GitCompareArrows className="h-4 w-4 text-primary" />
                Period Comparison
                <Badge variant="secondary" className="text-xs font-normal ml-1">
                  {format(prevFrom, 'MMM dd')} – {format(prevTo, 'MMM dd')} vs {format(from, 'MMM dd')} – {format(to, 'MMM dd')}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CompareRow label="Revenue" current={metrics.totalRevenue} previous={prevMetrics.totalRevenue} />
              <CompareRow label="Expenses" current={metrics.totalExpenses} previous={prevMetrics.totalExpenses} />
              <CompareRow label="Gross Profit" current={metrics.grossProfit} previous={prevMetrics.grossProfit} />
              <CompareRow label="Avg Order Value" current={metrics.avgOrderValue} previous={prevMetrics.avgOrderValue} />
              <CompareRow label="Tax Collected" current={metrics.taxCollected} previous={prevMetrics.taxCollected} />
              <CompareRow label="Payroll" current={metrics.totalPayroll} previous={prevMetrics.totalPayroll} />
              <CompareRow label="Orders" current={metrics.totalOrders} previous={prevMetrics.totalOrders} isCurrency={false} />
            </CardContent>
          </Card>
        )}

        {/* Alerts */}
        {metrics.lowStockItems.length > 0 && (
          <Card className="border-warning/50">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 text-warning mb-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-semibold text-sm">Low Stock Alert</span>
                <Badge variant="outline" className="text-warning border-warning/30">{metrics.lowStockItems.length} items</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {metrics.lowStockItems.slice(0, 8).map(item => (
                  <Badge key={item.name} variant="secondary" className="text-xs">{item.name} ({Number(item.current_stock)} left)</Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts row */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">
                {compareMode ? 'Current vs Previous Period' : `Revenue vs Expenses (${periodLabel})`}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                {compareMode && comparisonChart.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonChart} barGap={4}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} formatter={(v: number) => fmt(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="previous" fill="hsl(var(--muted-foreground))" fillOpacity={0.4} radius={[4, 4, 0, 0]} name="Previous" />
                      <Bar dataKey="current" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Current" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChart}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.15} strokeWidth={2} name="Revenue" />
                      <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.1} strokeWidth={2} name="Expenses" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Expense Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {expensePie.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">No expense data</p>
              ) : (
                <div className="h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={expensePie} cx="50%" cy="50%" outerRadius={85} innerRadius={45} dataKey="value" paddingAngle={2}>
                        {expensePie.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--foreground))' }} formatter={(v: number) => fmt(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
              <div className="space-y-1 mt-2">
                {expensePie.slice(0, 5).map((cat, i) => (
                  <div key={cat.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-muted-foreground">{cat.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{fmt(cat.value)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick links */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Accounting Modules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {quickLinks.map(link => (
                <Button key={link.path} variant="outline" className="h-auto py-3 px-4 justify-start gap-3" onClick={() => navigate(link.path)}>
                  <link.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm">{link.label}</span>
                  <ArrowRight className="h-3 w-3 ml-auto text-muted-foreground" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
