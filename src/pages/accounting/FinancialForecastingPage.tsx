import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  TrendingUp, TrendingDown, Target, Calendar, BarChart3, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import {
  format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval,
  eachWeekOfInterval, startOfWeek, endOfWeek, subWeeks, addMonths, addWeeks,
  differenceInDays, isSameMonth,
} from 'date-fns';

type Horizon = '4weeks' | '3months' | '6months';
const HORIZONS: { value: Horizon; label: string; months: number }[] = [
  { value: '4weeks', label: 'Next 4 Weeks', months: 1 },
  { value: '3months', label: 'Next 3 Months', months: 3 },
  { value: '6months', label: 'Next 6 Months', months: 6 },
];

/** Simple linear regression: returns [slope, intercept] */
function linearRegression(points: { x: number; y: number }[]): [number, number] {
  const n = points.length;
  if (n < 2) return [0, points[0]?.y || 0];
  const sumX = points.reduce((s, p) => s + p.x, 0);
  const sumY = points.reduce((s, p) => s + p.y, 0);
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
  const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return [0, sumY / n];
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return [slope, intercept];
}

/** Weighted moving average (recent months weighted more) */
function weightedMovingAvg(values: number[], weights?: number[]): number {
  if (values.length === 0) return 0;
  const w = weights || values.map((_, i) => i + 1);
  const totalWeight = w.reduce((s, v) => s + v, 0);
  return values.reduce((s, v, i) => s + v * w[i], 0) / totalWeight;
}

export default function FinancialForecastingPage() {
  const { format: fc } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [horizon, setHorizon] = useState<Horizon>('3months');
  const [tab, setTab] = useState('overview');

  // Fetch historical orders (last 12 months)
  const { data: orders = [] } = useQuery({
    queryKey: ['forecast-orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const from = subMonths(new Date(), 12);
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, discount_amount, tax_rate, status, created_at, payment_method')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', from.toISOString())
        .in('status', ['completed', 'delivered', 'paid']);
      if (error) throw error;
      return data;
    },
  });

  // Fetch historical expenses (last 12 months)
  const { data: expenses = [] } = useQuery({
    queryKey: ['forecast-expenses', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const from = format(subMonths(new Date(), 12), 'yyyy-MM-dd');
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, expense_date, category_id')
        .eq('restaurant_id', restaurantId!)
        .gte('expense_date', from);
      if (error) throw error;
      return data;
    },
  });

  // Fetch expense categories
  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['forecast-expense-categories', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_categories').select('id, name').eq('restaurant_id', restaurantId!);
      if (error) throw error;
      return data;
    },
  });

  // Aggregate monthly historical data
  const monthlyData = useMemo(() => {
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(new Date()), 11), end: startOfMonth(new Date()) });
    return months.map(month => {
      const monthEnd = endOfMonth(month);
      const monthOrders = orders.filter(o => {
        const d = new Date(o.created_at);
        return d >= month && d <= monthEnd;
      });
      const monthExpenses = expenses.filter(e => {
        const d = new Date(e.expense_date);
        return d >= month && d <= monthEnd;
      });
      const revenue = monthOrders.reduce((s, o) => s + Number(o.total_amount), 0);
      const discounts = monthOrders.reduce((s, o) => s + Number(o.discount_amount), 0);
      const netRevenue = revenue - discounts;
      const totalExpenses = monthExpenses.reduce((s, e) => s + Number(e.amount), 0);
      const profit = netRevenue - totalExpenses;
      return {
        month,
        label: format(month, 'MMM yyyy'),
        shortLabel: format(month, 'MMM'),
        revenue: Math.round(netRevenue * 100) / 100,
        expenses: Math.round(totalExpenses * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        orderCount: monthOrders.length,
        avgOrderValue: monthOrders.length > 0 ? Math.round((netRevenue / monthOrders.length) * 100) / 100 : 0,
      };
    });
  }, [orders, expenses]);

  // Generate forecasts using linear regression + weighted moving average blend
  const forecast = useMemo(() => {
    const horizonDef = HORIZONS.find(h => h.value === horizon)!;
    const futureMonths = horizonDef.months;
    const historical = monthlyData.filter(m => m.revenue > 0 || m.expenses > 0);
    if (historical.length < 2) return { months: [], summary: null };

    // Revenue regression
    const revPoints = historical.map((m, i) => ({ x: i, y: m.revenue }));
    const [revSlope, revIntercept] = linearRegression(revPoints);
    const revWMA = weightedMovingAvg(historical.map(m => m.revenue));

    // Expense regression
    const expPoints = historical.map((m, i) => ({ x: i, y: m.expenses }));
    const [expSlope, expIntercept] = linearRegression(expPoints);
    const expWMA = weightedMovingAvg(historical.map(m => m.expenses));

    // Order count regression
    const ordPoints = historical.map((m, i) => ({ x: i, y: m.orderCount }));
    const [ordSlope, ordIntercept] = linearRegression(ordPoints);

    const n = historical.length;
    const forecastMonths = [];
    let totalForecastRevenue = 0;
    let totalForecastExpenses = 0;
    let totalForecastProfit = 0;

    for (let i = 0; i < futureMonths; i++) {
      const futureMonth = addMonths(new Date(), i + 1);
      const idx = n + i;

      // Blend: 60% regression, 40% weighted moving average
      const regRevenue = revSlope * idx + revIntercept;
      const forecastRevenue = Math.max(0, 0.6 * regRevenue + 0.4 * revWMA);

      const regExpenses = expSlope * idx + expIntercept;
      const forecastExpenses = Math.max(0, 0.6 * regExpenses + 0.4 * expWMA);

      const forecastOrders = Math.max(0, Math.round(ordSlope * idx + ordIntercept));
      const forecastProfit = forecastRevenue - forecastExpenses;

      // Confidence band (wider as we go further out)
      const confidence = 0.15 + (i * 0.05);
      const revLow = forecastRevenue * (1 - confidence);
      const revHigh = forecastRevenue * (1 + confidence);

      totalForecastRevenue += forecastRevenue;
      totalForecastExpenses += forecastExpenses;
      totalForecastProfit += forecastProfit;

      forecastMonths.push({
        month: futureMonth,
        label: format(startOfMonth(futureMonth), 'MMM yyyy'),
        shortLabel: format(startOfMonth(futureMonth), 'MMM'),
        revenue: Math.round(forecastRevenue * 100) / 100,
        revenueLow: Math.round(revLow * 100) / 100,
        revenueHigh: Math.round(revHigh * 100) / 100,
        expenses: Math.round(forecastExpenses * 100) / 100,
        profit: Math.round(forecastProfit * 100) / 100,
        orderCount: forecastOrders,
        isForecast: true,
      });
    }

    // Growth rates
    const lastMonth = historical[historical.length - 1];
    const prevMonth = historical.length >= 2 ? historical[historical.length - 2] : lastMonth;
    const revenueGrowth = prevMonth.revenue > 0 ? ((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100 : 0;
    const expenseGrowth = prevMonth.expenses > 0 ? ((lastMonth.expenses - prevMonth.expenses) / prevMonth.expenses) * 100 : 0;

    return {
      months: forecastMonths,
      summary: {
        totalForecastRevenue: Math.round(totalForecastRevenue * 100) / 100,
        totalForecastExpenses: Math.round(totalForecastExpenses * 100) / 100,
        totalForecastProfit: Math.round(totalForecastProfit * 100) / 100,
        avgMonthlyRevenue: Math.round((totalForecastRevenue / futureMonths) * 100) / 100,
        avgMonthlyExpenses: Math.round((totalForecastExpenses / futureMonths) * 100) / 100,
        revenueGrowth: Math.round(revenueGrowth * 10) / 10,
        expenseGrowth: Math.round(expenseGrowth * 10) / 10,
        revenueTrend: revSlope > 0 ? 'up' : revSlope < 0 ? 'down' : 'flat',
        expenseTrend: expSlope > 0 ? 'up' : expSlope < 0 ? 'down' : 'flat',
        profitMargin: totalForecastRevenue > 0 ? Math.round((totalForecastProfit / totalForecastRevenue) * 10000) / 100 : 0,
      },
    };
  }, [monthlyData, horizon]);

  // Combined chart data (historical + forecast)
  const chartData = useMemo(() => {
    const hist = monthlyData.map(m => ({
      label: m.shortLabel, revenue: m.revenue, expenses: m.expenses, profit: m.profit, isForecast: false,
      forecastRevenue: undefined as number | undefined,
      forecastExpenses: undefined as number | undefined,
      forecastProfit: undefined as number | undefined,
      revenueLow: undefined as number | undefined,
      revenueHigh: undefined as number | undefined,
    }));
    // Bridge: last historical point also starts forecast line
    if (hist.length > 0 && forecast.months.length > 0) {
      const last = hist[hist.length - 1];
      last.forecastRevenue = last.revenue;
      last.forecastExpenses = last.expenses;
      last.forecastProfit = last.profit;
    }
    const fc2 = forecast.months.map(m => ({
      label: m.shortLabel, revenue: undefined as number | undefined, expenses: undefined as number | undefined, profit: undefined as number | undefined, isForecast: true,
      forecastRevenue: m.revenue, forecastExpenses: m.expenses, forecastProfit: m.profit,
      revenueLow: m.revenueLow, revenueHigh: m.revenueHigh,
    }));
    return [...hist, ...fc2];
  }, [monthlyData, forecast]);

  // Expense category forecasts
  const categoryForecasts = useMemo(() => {
    const catMap: Record<string, number[]> = {};
    const months = eachMonthOfInterval({ start: subMonths(startOfMonth(new Date()), 11), end: startOfMonth(new Date()) });
    
    expenses.forEach(e => {
      const catName = expenseCategories.find(c => c.id === e.category_id)?.name || 'Uncategorized';
      if (!catMap[catName]) catMap[catName] = new Array(months.length).fill(0);
      const monthIdx = months.findIndex(m => isSameMonth(m, new Date(e.expense_date)));
      if (monthIdx >= 0) catMap[catName][monthIdx] += Number(e.amount);
    });

    return Object.entries(catMap).map(([name, values]) => {
      const nonZero = values.filter(v => v > 0);
      const avg = nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
      const trend = nonZero.length >= 2 ? linearRegression(nonZero.map((y, x) => ({ x, y })))[0] : 0;
      const forecast = Math.max(0, weightedMovingAvg(nonZero.length > 0 ? nonZero : [0]));
      return { name, avgMonthly: Math.round(avg * 100) / 100, forecast: Math.round(forecast * 100) / 100, trend: trend > 0 ? 'up' : trend < 0 ? 'down' : 'flat' as const };
    }).sort((a, b) => b.forecast - a.forecast);
  }, [expenses, expenseCategories]);

  const hasData = monthlyData.some(m => m.revenue > 0 || m.expenses > 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Financial Forecasting</h1>
            <p className="text-sm text-muted-foreground">Predict future earnings using historical data</p>
          </div>
          <Select value={horizon} onValueChange={v => setHorizon(v as Horizon)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{HORIZONS.map(h => <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        {!hasData ? (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-40" />
            <p className="text-lg font-medium">Not enough data yet</p>
            <p className="text-sm">Forecasts will appear once you have order and expense history.</p>
          </CardContent></Card>
        ) : (
          <>
            {/* Summary Cards */}
            {forecast.summary && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Projected Revenue</p>
                        <p className="text-2xl font-bold text-foreground">{fc(forecast.summary.totalForecastRevenue)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {forecast.summary.revenueTrend === 'up' ? <ArrowUpRight className="h-3 w-3 text-green-500" /> : <ArrowDownRight className="h-3 w-3 text-destructive" />}
                          <span className={`text-xs ${forecast.summary.revenueTrend === 'up' ? 'text-green-500' : 'text-destructive'}`}>
                            {forecast.summary.revenueGrowth > 0 ? '+' : ''}{forecast.summary.revenueGrowth}% trend
                          </span>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <TrendingUp className="h-5 w-5 text-primary" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Projected Expenses</p>
                        <p className="text-2xl font-bold text-foreground">{fc(forecast.summary.totalForecastExpenses)}</p>
                        <div className="flex items-center gap-1 mt-1">
                          {forecast.summary.expenseTrend === 'up' ? <ArrowUpRight className="h-3 w-3 text-destructive" /> : <ArrowDownRight className="h-3 w-3 text-green-500" />}
                          <span className={`text-xs ${forecast.summary.expenseTrend === 'up' ? 'text-destructive' : 'text-green-500'}`}>
                            {forecast.summary.expenseGrowth > 0 ? '+' : ''}{forecast.summary.expenseGrowth}% trend
                          </span>
                        </div>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Projected Profit</p>
                        <p className={`text-2xl font-bold ${forecast.summary.totalForecastProfit >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fc(forecast.summary.totalForecastProfit)}</p>
                        <p className="text-xs text-muted-foreground">{forecast.summary.profitMargin}% margin</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center">
                        <Target className="h-5 w-5 text-accent-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-muted-foreground">Avg Monthly Revenue</p>
                        <p className="text-2xl font-bold text-foreground">{fc(forecast.summary.avgMonthlyRevenue)}</p>
                        <p className="text-xs text-muted-foreground">Expected per month</p>
                      </div>
                      <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                <TabsTrigger value="overview">Revenue Forecast</TabsTrigger>
                <TabsTrigger value="profitloss">Profit Forecast</TabsTrigger>
                <TabsTrigger value="budget">Budget Planning</TabsTrigger>
              </TabsList>

              {/* Revenue Forecast */}
              <TabsContent value="overview">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Revenue & Expense Forecast</CardTitle>
                        <CardDescription>Historical data with projected trend (dashed lines)</CardDescription>
                      </div>
                      <Badge variant="outline" className="text-xs">Linear Regression + WMA Blend</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.08} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fc(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Legend />
                        {/* Historical */}
                        <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={2} name="Revenue" connectNulls={false} />
                        <Area type="monotone" dataKey="expenses" stroke="hsl(var(--destructive))" fill="none" strokeWidth={2} name="Expenses" connectNulls={false} />
                        {/* Forecast */}
                        <Area type="monotone" dataKey="forecastRevenue" stroke="hsl(var(--primary))" fill="url(#fcGrad)" strokeWidth={2} strokeDasharray="6 4" name="Forecast Revenue" connectNulls />
                        <Area type="monotone" dataKey="forecastExpenses" stroke="hsl(var(--destructive))" fill="none" strokeWidth={2} strokeDasharray="6 4" name="Forecast Expenses" connectNulls />
                        {/* Confidence band */}
                        <Area type="monotone" dataKey="revenueHigh" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.06} name="Upper Bound" connectNulls />
                        <Area type="monotone" dataKey="revenueLow" stroke="none" fill="hsl(var(--background))" fillOpacity={1} name="Lower Bound" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Profit Forecast */}
              <TabsContent value="profitloss">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Profit Trend & Forecast</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                          <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <Tooltip formatter={(v: number) => fc(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                          <ReferenceLine y={0} stroke="hsl(var(--border))" />
                          <Bar dataKey="profit" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Actual Profit" />
                          <Bar dataKey="forecastProfit" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Forecast Profit" opacity={0.7} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Forecast Breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Month</TableHead>
                            <TableHead className="text-right">Revenue</TableHead>
                            <TableHead className="text-right">Expenses</TableHead>
                            <TableHead className="text-right">Profit</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {forecast.months.map(m => (
                            <TableRow key={m.label}>
                              <TableCell className="font-medium">{m.label}</TableCell>
                              <TableCell className="text-right">{fc(m.revenue)}</TableCell>
                              <TableCell className="text-right">{fc(m.expenses)}</TableCell>
                              <TableCell className={`text-right font-medium ${m.profit >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fc(m.profit)}</TableCell>
                            </TableRow>
                          ))}
                          {forecast.summary && (
                            <>
                              <TableRow className="border-t-2">
                                <TableCell className="font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold">{fc(forecast.summary.totalForecastRevenue)}</TableCell>
                                <TableCell className="text-right font-bold">{fc(forecast.summary.totalForecastExpenses)}</TableCell>
                                <TableCell className={`text-right font-bold ${forecast.summary.totalForecastProfit >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fc(forecast.summary.totalForecastProfit)}</TableCell>
                              </TableRow>
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Budget Planning */}
              <TabsContent value="budget">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Expense Category Forecasts</CardTitle>
                      <CardDescription>Projected monthly costs by category</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Category</TableHead>
                            <TableHead className="text-right">Avg Monthly</TableHead>
                            <TableHead className="text-right">Forecast</TableHead>
                            <TableHead>Trend</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryForecasts.length === 0 ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No expense data</TableCell></TableRow>
                          ) : categoryForecasts.map(cat => (
                            <TableRow key={cat.name}>
                              <TableCell className="font-medium">{cat.name}</TableCell>
                              <TableCell className="text-right">{fc(cat.avgMonthly)}</TableCell>
                              <TableCell className="text-right font-medium">{fc(cat.forecast)}</TableCell>
                              <TableCell>
                                {cat.trend === 'up' ? (
                                  <Badge variant="outline" className="text-xs text-destructive border-destructive/30 bg-destructive/10">↑ Rising</Badge>
                                ) : cat.trend === 'down' ? (
                                  <Badge variant="outline" className="text-xs text-green-600 border-green-500/30 bg-green-500/10">↓ Falling</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-xs">→ Stable</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Budget Recommendations</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {forecast.summary && (
                        <>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                            <p className="text-sm font-medium text-foreground">Monthly Revenue Target</p>
                            <p className="text-2xl font-bold text-primary">{fc(forecast.summary.avgMonthlyRevenue)}</p>
                            <p className="text-xs text-muted-foreground">Based on current growth trajectory</p>
                          </div>
                          <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                            <p className="text-sm font-medium text-foreground">Recommended Expense Budget</p>
                            <p className="text-2xl font-bold text-foreground">{fc(forecast.summary.avgMonthlyExpenses)}</p>
                            <p className="text-xs text-muted-foreground">To maintain {forecast.summary.profitMargin}% profit margin</p>
                          </div>
                          <Separator />
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Key Insights</p>
                            <ul className="space-y-1.5 text-sm text-muted-foreground">
                              {forecast.summary.revenueTrend === 'up' && <li className="flex items-start gap-2"><ArrowUpRight className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />Revenue is trending upward — consider investing in growth</li>}
                              {forecast.summary.revenueTrend === 'down' && <li className="flex items-start gap-2"><ArrowDownRight className="h-4 w-4 text-destructive shrink-0 mt-0.5" />Revenue is declining — review pricing and marketing strategies</li>}
                              {forecast.summary.expenseTrend === 'up' && <li className="flex items-start gap-2"><ArrowUpRight className="h-4 w-4 text-destructive shrink-0 mt-0.5" />Expenses are rising — audit costs for optimization opportunities</li>}
                              {forecast.summary.profitMargin < 10 && <li className="flex items-start gap-2"><TrendingDown className="h-4 w-4 text-destructive shrink-0 mt-0.5" />Profit margin below 10% — focus on cost reduction or revenue growth</li>}
                              {forecast.summary.profitMargin >= 15 && <li className="flex items-start gap-2"><TrendingUp className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />Healthy profit margin — consider reinvesting in the business</li>}
                              <li className="flex items-start gap-2"><Calendar className="h-4 w-4 text-primary shrink-0 mt-0.5" />Forecasts use a blend of linear regression and weighted moving averages</li>
                            </ul>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
