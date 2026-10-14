import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  DollarSign, TrendingUp, TrendingDown, Receipt, Minus, ArrowUpRight, ArrowDownRight,
  CalendarDays, BarChart3, PieChart as PieChartIcon,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, eachMonthOfInterval, startOfDay, endOfDay } from 'date-fns';

type Period = 'this_month' | '3months' | '6months' | '12months';

const PIE_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--success))',
  'hsl(var(--warning))',
  'hsl(var(--destructive))',
  'hsl(24, 80%, 65%)',
  'hsl(200, 70%, 55%)',
  'hsl(280, 60%, 55%)',
  'hsl(340, 70%, 55%)',
];

export default function ProfitLossPage() {
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [period, setPeriod] = useState<Period>('this_month');
  const [branchId, setBranchId] = useState('all');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'this_month') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === '3months') return { start: startOfMonth(subDays(now, 89)), end: endOfDay(now) };
    if (period === '6months') return { start: startOfMonth(subDays(now, 179)), end: endOfDay(now) };
    return { start: startOfMonth(subDays(now, 364)), end: endOfDay(now) };
  }, [period]);

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

  // Revenue (completed orders)
  const { data: orders = [] } = useQuery({
    queryKey: ['pl_orders', restaurantId ?? 'none', period, branchId],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('orders')
        .select('id, total_amount, status, created_at, discount_amount, tax_rate, branch_id')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .in('status', ['served', 'completed']);
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q.order('created_at');
      if (error) throw error;
      return data || [];
    },
  });

  // Expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ['pl_expenses', restaurantId ?? 'none', period, branchId],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, expense_categories(name, color)')
        .eq('restaurant_id', restaurantId!)
        .gte('expense_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('expense_date', format(dateRange.end, 'yyyy-MM-dd'));
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      const { data, error } = await q.order('expense_date');
      if (error) throw error;
      return data || [];
    },
  });

  // Computed
  const totalRevenue = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalDiscounts = orders.reduce((s, o) => s + Number(o.discount_amount || 0), 0);
  const totalTax = orders.reduce((s, o) => s + (Number(o.total_amount) * Number(o.tax_rate || 0) / 100), 0);
  const netRevenue = totalRevenue - totalDiscounts;
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const netProfit = netRevenue - totalExpenses;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  // Expense by category for pie
  const expenseByCategory = useMemo(() => {
    const map: Record<string, { name: string; value: number; color: string }> = {};
    expenses.forEach(e => {
      const cat = e.expense_categories as any;
      const key = e.category_id || 'other';
      if (!map[key]) map[key] = { name: cat?.name || 'Other', value: 0, color: cat?.color || '#64748b' };
      map[key].value += Number(e.amount);
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [expenses]);

  // Monthly P&L chart
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: dateRange.start, end: dateRange.end });
    return months.map(month => {
      const monthStr = format(month, 'yyyy-MM');
      const monthRevenue = orders
        .filter(o => format(new Date(o.created_at), 'yyyy-MM') === monthStr)
        .reduce((s, o) => s + Number(o.total_amount), 0);
      const monthExpenses = expenses
        .filter(e => format(new Date(e.expense_date), 'yyyy-MM') === monthStr)
        .reduce((s, e) => s + Number(e.amount), 0);
      return {
        month: format(month, 'MMM yyyy'),
        revenue: monthRevenue,
        expenses: monthExpenses,
        profit: monthRevenue - monthExpenses,
      };
    });
  }, [orders, expenses, dateRange]);

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 xl:p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="display-heading text-xl">Profit & Loss</h1>
            <p className="text-sm text-muted-foreground mt-1">Financial performance overview</p>
          </div>
          <div className="flex items-center gap-2">
            {branches.length > 1 && (
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger className="w-[160px] h-9 text-sm"><SelectValue placeholder="All Branches" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="12months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Key metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="h-9 w-9 rounded-xl bg-success/10 flex items-center justify-center">
                <DollarSign className="h-4 w-4 text-success" />
              </div>
              <p className="text-[22px] font-bold tabular-nums text-card-foreground mt-3">{fmt(netRevenue)}</p>
              <p className="text-[11px] text-muted-foreground">Net Revenue</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="h-9 w-9 rounded-xl bg-destructive/10 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-[22px] font-bold tabular-nums text-card-foreground mt-3">{fmt(totalExpenses)}</p>
              <p className="text-[11px] text-muted-foreground">Total Expenses</p>
            </CardContent>
          </Card>
          <Card className={netProfit >= 0 ? 'border-success/20' : 'border-destructive/20'}>
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${netProfit >= 0 ? 'bg-success/10' : 'bg-destructive/10'}`}>
                {netProfit >= 0 ? <TrendingUp className="h-4 w-4 text-success" /> : <TrendingDown className="h-4 w-4 text-destructive" />}
              </div>
              <p className={`text-[22px] font-bold tabular-nums mt-3 ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                {fmt(Math.abs(netProfit))}
              </p>
              <p className="text-[11px] text-muted-foreground">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <p className={`text-[22px] font-bold tabular-nums mt-3 ${profitMargin >= 0 ? 'text-card-foreground' : 'text-destructive'}`}>
                {profitMargin.toFixed(1)}%
              </p>
              <p className="text-[11px] text-muted-foreground">Profit Margin</p>
            </CardContent>
          </Card>
        </div>

        {/* P&L statement */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Profit & Loss Statement</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold text-card-foreground">Income</span>
                <span className="text-sm font-bold tabular-nums text-card-foreground">{fmt(totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 pl-4 text-sm">
                <span className="text-muted-foreground">Gross Revenue</span>
                <span className="tabular-nums text-card-foreground">{fmt(totalRevenue)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 pl-4 text-sm">
                <span className="text-muted-foreground">Discounts</span>
                <span className="tabular-nums text-destructive">-{fmt(totalDiscounts)}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 pl-4 text-sm">
                <span className="text-muted-foreground">Tax Collected</span>
                <span className="tabular-nums text-card-foreground">{fmt(totalTax)}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-t border-border">
                <span className="text-sm font-semibold text-card-foreground">Net Revenue</span>
                <span className="text-sm font-bold tabular-nums text-success">{fmt(netRevenue)}</span>
              </div>

              <div className="h-3" />

              <div className="flex items-center justify-between py-2">
                <span className="text-sm font-semibold text-card-foreground">Expenses</span>
                <span className="text-sm font-bold tabular-nums text-destructive">{fmt(totalExpenses)}</span>
              </div>
              {expenseByCategory.map(cat => (
                <div key={cat.name} className="flex items-center justify-between py-1.5 pl-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                    <span className="text-muted-foreground">{cat.name}</span>
                  </div>
                  <span className="tabular-nums text-card-foreground">{fmt(cat.value)}</span>
                </div>
              ))}
              {expenseByCategory.length === 0 && (
                <div className="py-1.5 pl-4 text-sm text-muted-foreground italic">No expenses recorded</div>
              )}

              <div className="h-1" />
              <div className={`flex items-center justify-between py-3 border-t-2 border-border ${netProfit >= 0 ? '' : ''}`}>
                <span className="text-base font-bold text-card-foreground">{netProfit >= 0 ? 'Net Profit' : 'Net Loss'}</span>
                <span className={`text-lg font-bold tabular-nums ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {netProfit < 0 && '-'}{fmt(Math.abs(netProfit))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts row */}
        {monthlyData.length > 1 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly comparison */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Monthly Revenue vs Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip
                        contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                        formatter={(value: number, name: string) => [fmt(value), name.charAt(0).toUpperCase() + name.slice(1)]}
                      />
                      <Bar dataKey="revenue" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} barSize={24} />
                      <Bar dataKey="expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} barSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Expense pie */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <PieChartIcon className="h-4 w-4 text-muted-foreground" />
                  Expense Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                {expenseByCategory.length > 0 ? (
                  <div className="flex items-center gap-6">
                    <div className="h-[200px] w-[200px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={expenseByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                            {expenseByCategory.map((entry, idx) => (
                              <Cell key={idx} fill={entry.color || PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '12px', fontSize: '12px' }}
                            formatter={(value: number) => [fmt(value)]}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {expenseByCategory.slice(0, 6).map((item, idx) => (
                        <div key={item.name} className="flex items-center gap-2 text-sm">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: item.color || PIE_COLORS[idx % PIE_COLORS.length] }} />
                          <span className="text-card-foreground flex-1 truncate">{item.name}</span>
                          <span className="font-semibold tabular-nums text-card-foreground">{fmt(item.value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-8 text-center">No expense data to display</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
