import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useSettings } from '@/hooks/useSettings';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import {
  Receipt, Download, Calculator, Calendar, TrendingUp, FileText,
  ArrowUpRight, ArrowDownRight, BarChart3, Printer,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import {
  format, subDays, subMonths, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter,
  startOfYear, endOfYear, eachMonthOfInterval, isSameMonth, getQuarter, getYear,
} from 'date-fns';

type Period = 'month' | 'quarter' | 'year' | 'custom';

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
];

export default function TaxReportingPage() {
  const { format: fc } = useCurrency();
  const { data: settings } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const taxRate = settings?.tax_percentage ?? 10;
  const [period, setPeriod] = useState<Period>('month');
  const [tab, setTab] = useState('summary');

  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'month') return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy') };
    if (period === 'quarter') return { start: startOfQuarter(now), end: endOfQuarter(now), label: `Q${getQuarter(now)} ${getYear(now)}` };
    return { start: startOfYear(now), end: endOfYear(now), label: `${getYear(now)}` };
  }, [period]);

  // Fetch orders for the period
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['tax-orders', restaurantId ?? 'none', dateRange.start.toISOString(), dateRange.end.toISOString()],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, discount_amount, tax_rate, status, created_at, payment_method, paid_at')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .in('status', ['completed', 'delivered', 'paid']);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all orders for YTD comparison
  const { data: ytdOrders = [] } = useQuery({
    queryKey: ['tax-ytd-orders', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, total_amount, discount_amount, tax_rate, created_at, payment_method')
        .eq('restaurant_id', restaurantId!)
        .gte('created_at', startOfYear(new Date()).toISOString())
        .in('status', ['completed', 'delivered', 'paid']);
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses for income tax estimation
  const { data: expenses = [] } = useQuery({
    queryKey: ['tax-expenses', restaurantId ?? 'none', dateRange.start.toISOString()],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id, amount, expense_date')
        .eq('restaurant_id', restaurantId!)
        .gte('expense_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('expense_date', format(dateRange.end, 'yyyy-MM-dd'));
      if (error) throw error;
      return data;
    },
  });

  // Tax calculations
  const taxData = useMemo(() => {
    const grossSales = orders.reduce((s, o) => s + Number(o.total_amount), 0);
    const discounts = orders.reduce((s, o) => s + Number(o.discount_amount), 0);
    const netSales = grossSales - discounts;

    // Calculate tax collected per order based on its tax_rate
    const taxCollected = orders.reduce((s, o) => {
      const rate = Number(o.tax_rate) || 0;
      const orderNet = Number(o.total_amount) - Number(o.discount_amount);
      // tax = netAmount * (rate / (100 + rate)) for tax-inclusive pricing
      const tax = rate > 0 ? orderNet * (rate / (100 + rate)) : 0;
      return s + tax;
    }, 0);

    const preTaxSales = netSales - taxCollected;
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const taxableIncome = preTaxSales - totalExpenses;

    // Payment method breakdown
    const byPayment: Record<string, { sales: number; tax: number; count: number }> = {};
    orders.forEach(o => {
      const method = o.payment_method || 'other';
      if (!byPayment[method]) byPayment[method] = { sales: 0, tax: 0, count: 0 };
      const orderNet = Number(o.total_amount) - Number(o.discount_amount);
      const rate = Number(o.tax_rate) || 0;
      const tax = rate > 0 ? orderNet * (rate / (100 + rate)) : 0;
      byPayment[method].sales += orderNet;
      byPayment[method].tax += tax;
      byPayment[method].count += 1;
    });

    return {
      grossSales: Math.round(grossSales * 100) / 100,
      discounts: Math.round(discounts * 100) / 100,
      netSales: Math.round(netSales * 100) / 100,
      taxCollected: Math.round(taxCollected * 100) / 100,
      preTaxSales: Math.round(preTaxSales * 100) / 100,
      effectiveRate: preTaxSales > 0 ? Math.round((taxCollected / preTaxSales) * 10000) / 100 : 0,
      orderCount: orders.length,
      totalExpenses: Math.round(totalExpenses * 100) / 100,
      taxableIncome: Math.round(taxableIncome * 100) / 100,
      byPayment,
    };
  }, [orders, expenses]);

  // Monthly tax trend (YTD)
  const monthlyTrend = useMemo(() => {
    const months = eachMonthOfInterval({ start: startOfYear(new Date()), end: new Date() });
    return months.map(month => {
      const monthOrders = ytdOrders.filter(o => isSameMonth(new Date(o.created_at), month));
      const sales = monthOrders.reduce((s, o) => s + Number(o.total_amount) - Number(o.discount_amount), 0);
      const tax = monthOrders.reduce((s, o) => {
        const rate = Number(o.tax_rate) || 0;
        const net = Number(o.total_amount) - Number(o.discount_amount);
        return s + (rate > 0 ? net * (rate / (100 + rate)) : 0);
      }, 0);
      return {
        month: format(month, 'MMM'),
        sales: Math.round(sales * 100) / 100,
        tax: Math.round(tax * 100) / 100,
      };
    });
  }, [ytdOrders]);

  // YTD totals
  const ytdTotals = useMemo(() => {
    const sales = ytdOrders.reduce((s, o) => s + Number(o.total_amount) - Number(o.discount_amount), 0);
    const tax = ytdOrders.reduce((s, o) => {
      const rate = Number(o.tax_rate) || 0;
      const net = Number(o.total_amount) - Number(o.discount_amount);
      return s + (rate > 0 ? net * (rate / (100 + rate)) : 0);
    }, 0);
    return { sales: Math.round(sales * 100) / 100, tax: Math.round(tax * 100) / 100 };
  }, [ytdOrders]);

  // Export CSV
  const exportCSV = useCallback(() => {
    const rows = [
      ['Tax Report', dateRange.label],
      [''],
      ['Metric', 'Amount'],
      ['Gross Sales', taxData.grossSales.toFixed(2)],
      ['Discounts', taxData.discounts.toFixed(2)],
      ['Net Sales (incl. tax)', taxData.netSales.toFixed(2)],
      ['Sales Tax Collected', taxData.taxCollected.toFixed(2)],
      ['Pre-Tax Sales', taxData.preTaxSales.toFixed(2)],
      ['Effective Tax Rate', `${taxData.effectiveRate}%`],
      ['Total Orders', taxData.orderCount.toString()],
      [''],
      ['Payment Method Breakdown'],
      ['Method', 'Sales', 'Tax Collected', 'Orders'],
      ...Object.entries(taxData.byPayment).map(([method, data]) => [
        method, data.sales.toFixed(2), data.tax.toFixed(2), data.count.toString(),
      ]),
      [''],
      ['Deductible Expenses', taxData.totalExpenses.toFixed(2)],
      ['Estimated Taxable Income', taxData.taxableIncome.toFixed(2)],
      [''],
      ['Monthly Tax Trend (YTD)'],
      ['Month', 'Net Sales', 'Tax Collected'],
      ...monthlyTrend.map(m => [m.month, m.sales.toFixed(2), m.tax.toFixed(2)]),
      ['YTD Total', ytdTotals.sales.toFixed(2), ytdTotals.tax.toFixed(2)],
    ];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${dateRange.label.replace(/\s/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax report exported');
  }, [taxData, monthlyTrend, ytdTotals, dateRange]);

  // Print report
  const printReport = useCallback(() => {
    window.print();
  }, []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Tax Reporting</h1>
            <p className="text-sm text-muted-foreground">
              Sales tax summaries and exportable reports · Tax rate: {taxRate}%
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={period} onValueChange={v => setPeriod(v as Period)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={printReport}>
              <Printer className="h-4 w-4 mr-2" />Print
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tax Collected</p>
                  <p className="text-2xl font-bold text-foreground">{fc(taxData.taxCollected)}</p>
                  <p className="text-xs text-muted-foreground">{dateRange.label}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pre-Tax Sales</p>
                  <p className="text-2xl font-bold text-foreground">{fc(taxData.preTaxSales)}</p>
                  <p className="text-xs text-muted-foreground">{taxData.orderCount} orders</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Effective Tax Rate</p>
                  <p className="text-2xl font-bold text-foreground">{taxData.effectiveRate}%</p>
                  <p className="text-xs text-muted-foreground">Configured: {taxRate}%</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center">
                  <Calculator className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">YTD Tax Collected</p>
                  <p className="text-2xl font-bold text-foreground">{fc(ytdTotals.tax)}</p>
                  <p className="text-xs text-muted-foreground">Year to date</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="summary">Tax Summary</TabsTrigger>
            <TabsTrigger value="breakdown">Payment Breakdown</TabsTrigger>
            <TabsTrigger value="trend">Monthly Trend</TabsTrigger>
            <TabsTrigger value="income">Income Tax Est.</TabsTrigger>
          </TabsList>

          {/* Tax Summary */}
          <TabsContent value="summary">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Sales Tax Report — {dateRange.label}</CardTitle>
                  <CardDescription>Detailed sales tax calculation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Gross Sales</span>
                      <span className="font-medium text-foreground">{fc(taxData.grossSales)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Less: Discounts</span>
                      <span className="font-medium text-destructive">-{fc(taxData.discounts)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-foreground">Net Sales (incl. tax)</span>
                      <span className="font-bold text-foreground">{fc(taxData.netSales)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Less: Sales Tax Collected</span>
                      <span className="font-medium text-destructive">-{fc(taxData.taxCollected)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-foreground">Pre-Tax Sales Revenue</span>
                      <span className="font-bold text-lg text-foreground">{fc(taxData.preTaxSales)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-2 px-3 rounded-lg bg-primary/5 border border-primary/20">
                      <span className="text-sm font-semibold text-foreground">Sales Tax Payable</span>
                      <span className="font-bold text-lg text-primary">{fc(taxData.taxCollected)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-muted-foreground">Effective Tax Rate</span>
                      <span className="text-sm text-muted-foreground">{taxData.effectiveRate}%</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-xs text-muted-foreground">Number of Taxable Transactions</span>
                      <span className="text-sm text-muted-foreground">{taxData.orderCount}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tax vs Revenue</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Tax as % of Net Sales</span>
                        <span className="font-medium text-foreground">{taxData.netSales > 0 ? ((taxData.taxCollected / taxData.netSales) * 100).toFixed(1) : 0}%</span>
                      </div>
                      <Progress value={taxData.netSales > 0 ? (taxData.taxCollected / taxData.netSales) * 100 : 0} className="h-3" />
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Avg Tax/Order</p>
                        <p className="text-xl font-bold text-foreground">
                          {taxData.orderCount > 0 ? fc(taxData.taxCollected / taxData.orderCount) : fc(0)}
                        </p>
                      </div>
                      <div className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className="text-xs text-muted-foreground mb-1">Avg Order Value</p>
                        <p className="text-xl font-bold text-foreground">
                          {taxData.orderCount > 0 ? fc(taxData.netSales / taxData.orderCount) : fc(0)}
                        </p>
                      </div>
                    </div>
                    <Separator />
                    <div className="p-4 rounded-lg bg-muted/30 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Filing Reminder</p>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        <li className="flex items-start gap-2"><Calendar className="h-3 w-3 mt-0.5 shrink-0" />Sales tax of {fc(taxData.taxCollected)} is due for {dateRange.label}</li>
                        <li className="flex items-start gap-2"><FileText className="h-3 w-3 mt-0.5 shrink-0" />Export CSV report for your records or accountant</li>
                        <li className="flex items-start gap-2"><Receipt className="h-3 w-3 mt-0.5 shrink-0" />Configured tax rate: {taxRate}% (can be changed in Settings)</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Payment Breakdown */}
          <TabsContent value="breakdown">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tax by Payment Method</CardTitle>
                <CardDescription>Sales tax collected broken down by payment type</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Net Sales</TableHead>
                      <TableHead className="text-right">Tax Collected</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">% of Total Tax</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {Object.keys(taxData.byPayment).length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No data for this period</TableCell></TableRow>
                    ) : (
                      <>
                        {Object.entries(taxData.byPayment).map(([method, data]) => (
                          <TableRow key={method}>
                            <TableCell className="font-medium capitalize">{method}</TableCell>
                            <TableCell className="text-right">{fc(data.sales)}</TableCell>
                            <TableCell className="text-right font-medium">{fc(data.tax)}</TableCell>
                            <TableCell className="text-right">{data.count}</TableCell>
                            <TableCell className="text-right">
                              {taxData.taxCollected > 0 ? ((data.tax / taxData.taxCollected) * 100).toFixed(1) : 0}%
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-bold">
                          <TableCell>Total</TableCell>
                          <TableCell className="text-right">{fc(taxData.netSales)}</TableCell>
                          <TableCell className="text-right">{fc(taxData.taxCollected)}</TableCell>
                          <TableCell className="text-right">{taxData.orderCount}</TableCell>
                          <TableCell className="text-right">100%</TableCell>
                        </TableRow>
                      </>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Monthly Trend */}
          <TabsContent value="trend">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Monthly Tax Collection (YTD)</CardTitle>
                <CardDescription>Sales and tax collected each month this year</CardDescription>
              </CardHeader>
              <CardContent>
                {monthlyTrend.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No data yet this year</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={350}>
                      <BarChart data={monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip formatter={(v: number) => fc(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Legend />
                        <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Net Sales" />
                        <Bar dataKey="tax" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Tax Collected" />
                      </BarChart>
                    </ResponsiveContainer>
                    <Separator className="my-4" />
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead className="text-right">Net Sales</TableHead>
                          <TableHead className="text-right">Tax Collected</TableHead>
                          <TableHead className="text-right">Tax Rate</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {monthlyTrend.map(m => (
                          <TableRow key={m.month}>
                            <TableCell className="font-medium">{m.month}</TableCell>
                            <TableCell className="text-right">{fc(m.sales)}</TableCell>
                            <TableCell className="text-right font-medium">{fc(m.tax)}</TableCell>
                            <TableCell className="text-right">{m.sales > 0 ? ((m.tax / (m.sales - m.tax)) * 100).toFixed(1) : 0}%</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="border-t-2 font-bold">
                          <TableCell>YTD Total</TableCell>
                          <TableCell className="text-right">{fc(ytdTotals.sales)}</TableCell>
                          <TableCell className="text-right">{fc(ytdTotals.tax)}</TableCell>
                          <TableCell className="text-right">{ytdTotals.sales > 0 ? ((ytdTotals.tax / (ytdTotals.sales - ytdTotals.tax)) * 100).toFixed(1) : 0}%</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Income Tax Estimation */}
          <TabsContent value="income">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Income Tax Estimation — {dateRange.label}</CardTitle>
                  <CardDescription>Estimate based on revenue minus deductible expenses</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Pre-Tax Sales Revenue</span>
                      <span className="font-medium text-foreground">{fc(taxData.preTaxSales)}</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm text-muted-foreground">Less: Deductible Expenses</span>
                      <span className="font-medium text-destructive">-{fc(taxData.totalExpenses)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center py-2">
                      <span className="text-sm font-medium text-foreground">Estimated Taxable Income</span>
                      <span className={`font-bold text-lg ${taxData.taxableIncome >= 0 ? 'text-foreground' : 'text-destructive'}`}>{fc(taxData.taxableIncome)}</span>
                    </div>
                    <Separator />
                    {[15, 20, 25, 30].map(rate => (
                      <div key={rate} className="flex justify-between items-center py-1.5 px-3 rounded bg-muted/30">
                        <span className="text-sm text-muted-foreground">Est. Tax @ {rate}%</span>
                        <span className="font-medium text-foreground">{fc(Math.max(0, taxData.taxableIncome * rate / 100))}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tax Planning Notes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">Important Reminders</p>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Receipt className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        Sales tax of {fc(taxData.taxCollected)} collected this period should be remitted to tax authorities
                      </li>
                      <li className="flex items-start gap-2">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        Income tax estimates shown are approximate — consult your accountant for accurate filing
                      </li>
                      <li className="flex items-start gap-2">
                        <Calculator className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        Deductible expenses include all recorded operational costs from the Expenses module
                      </li>
                      <li className="flex items-start gap-2">
                        <Download className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                        Export reports as CSV to share with your accountant or bookkeeper
                      </li>
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Revenue / Expense Ratio</p>
                      <p className="text-lg font-bold text-foreground">
                        {taxData.totalExpenses > 0 ? (taxData.preTaxSales / taxData.totalExpenses).toFixed(1) : '∞'}x
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Net Margin</p>
                      <p className="text-lg font-bold text-foreground">
                        {taxData.preTaxSales > 0 ? ((taxData.taxableIncome / taxData.preTaxSales) * 100).toFixed(1) : 0}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
