import { useState, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useSettings } from '@/hooks/useSettings';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Download, Printer, FileText, GitCompareArrows } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';

const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = subMonths(new Date(), i);
  return { value: format(d, 'yyyy-MM'), label: format(d, 'MMMM yyyy') };
});

function calcReport(orders: any[], expenses: any[], expenseCategories: any[], payrollRecords: any[], inventoryTxns: any[]) {
  const paidOrders = orders.filter(o => o.status === 'paid' || o.paid_at);
  const totalRevenue = paidOrders.reduce((s, o) => s + Number(o.total_amount), 0);
  const totalDiscounts = paidOrders.reduce((s, o) => s + Number(o.discount_amount), 0);
  const taxCollected = paidOrders.reduce((s, o) => {
    const rate = Number(o.tax_rate) || 0;
    const net = Number(o.total_amount) - Number(o.discount_amount);
    return s + (rate > 0 ? net * (rate / (100 + rate)) : 0);
  }, 0);
  const netRevenue = totalRevenue - taxCollected;

  const paymentBreakdown = new Map<string, number>();
  paidOrders.forEach(o => {
    const m = o.payment_method || 'Unknown';
    paymentBreakdown.set(m, (paymentBreakdown.get(m) || 0) + Number(o.total_amount));
  });

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const expByCat = new Map<string, number>();
  expenses.forEach(e => {
    const name = expenseCategories.find(c => c.id === e.category_id)?.name || 'Uncategorized';
    expByCat.set(name, (expByCat.get(name) || 0) + Number(e.amount));
  });

  const totalPayroll = payrollRecords.reduce((s, p) => s + Number(p.net_pay), 0);
  const totalBasePay = payrollRecords.reduce((s, p) => s + Number(p.base_pay), 0);
  const totalTips = payrollRecords.reduce((s, p) => s + Number(p.tips_total), 0);
  const totalBonuses = payrollRecords.reduce((s, p) => s + Number(p.bonuses), 0);
  const totalDeductions = payrollRecords.reduce((s, p) => s + Number(p.deductions), 0);
  const inventoryCost = inventoryTxns.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.total_cost), 0);
  const totalCosts = totalExpenses + totalPayroll + inventoryCost;
  const grossProfit = netRevenue - totalExpenses - inventoryCost;
  const netProfit = netRevenue - totalCosts;
  const profitMargin = netRevenue > 0 ? (netProfit / netRevenue) * 100 : 0;

  return {
    totalRevenue, totalDiscounts, taxCollected, netRevenue,
    totalOrders: orders.length, paidOrders: paidOrders.length,
    paymentBreakdown: Array.from(paymentBreakdown.entries()).sort((a, b) => b[1] - a[1]),
    totalExpenses, expByCat: Array.from(expByCat.entries()).sort((a, b) => b[1] - a[1]),
    totalPayroll, totalBasePay, totalTips, totalBonuses, totalDeductions,
    inventoryCost, totalCosts, grossProfit, netProfit, profitMargin,
  };
}

function usePeriodData(monthValue: string, restaurantId: string | undefined, enabled = true) {
  const [year, month] = monthValue.split('-').map(Number);
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(from);
  const fromISO = from.toISOString();
  const toISO = to.toISOString();
  const fromDate = format(from, 'yyyy-MM-dd');
  const toDate = format(to, 'yyyy-MM-dd');
  const tenantEnabled = enabled && !!restaurantId;

  const { data: orders = [] } = useQuery({
    queryKey: ['report-orders', restaurantId ?? 'none', monthValue],
    enabled: tenantEnabled,
    queryFn: async () => {
      const { data } = await supabase.from('orders').select('total_amount, discount_amount, tax_rate, status, payment_method, paid_at, created_at').eq('restaurant_id', restaurantId!).gte('created_at', fromISO).lte('created_at', toISO);
      return data || [];
    },
  });
  const { data: expenses = [] } = useQuery({
    queryKey: ['report-expenses', restaurantId ?? 'none', monthValue],
    enabled: tenantEnabled,
    queryFn: async () => {
      const { data } = await supabase.from('expenses').select('amount, expense_date, category_id').eq('restaurant_id', restaurantId!).gte('expense_date', fromDate).lte('expense_date', toDate);
      return data || [];
    },
  });
  const { data: payrollRecords = [] } = useQuery({
    queryKey: ['report-payroll', restaurantId ?? 'none', monthValue],
    enabled: tenantEnabled,
    queryFn: async () => {
      const { data } = await supabase.from('payroll_records').select('net_pay, base_pay, tips_total, bonuses, deductions, status, period_start').eq('restaurant_id', restaurantId!).gte('period_start', fromDate).lte('period_start', toDate);
      return data || [];
    },
  });
  const { data: inventoryTxns = [] } = useQuery({
    queryKey: ['report-inv-txns', restaurantId ?? 'none', monthValue],
    enabled: tenantEnabled,
    queryFn: async () => {
      const { data } = await supabase.from('inventory_transactions').select('total_cost, type, transaction_date').eq('restaurant_id', restaurantId!).gte('transaction_date', fromDate).lte('transaction_date', toDate);
      return data || [];
    },
  });

  return { orders, expenses, payrollRecords, inventoryTxns };
}

function pctChange(current: number, previous: number): string | null {
  if (previous === 0 && current === 0) return null;
  if (previous === 0) return '+100%';
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

export default function MonthlyReportPage() {
  const { format: fmt } = useCurrency();
  const { data: settings } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[0].value);
  const [compareMode, setCompareMode] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  // Previous month value
  const [year, month] = selectedMonth.split('-').map(Number);
  const prevMonthDate = subMonths(new Date(year, month - 1), 1);
  const prevMonthValue = format(prevMonthDate, 'yyyy-MM');
  const prevMonthLabel = format(prevMonthDate, 'MMM yyyy');

  const { data: expenseCategories = [] } = useQuery({
    queryKey: ['report-exp-cats', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase.from('expense_categories').select('id, name').eq('restaurant_id', restaurantId!);
      return data || [];
    },
  });

  const current = usePeriodData(selectedMonth, restaurantId);
  const prev = usePeriodData(prevMonthValue, restaurantId, compareMode);

  const report = useMemo(() => calcReport(current.orders, current.expenses, expenseCategories, current.payrollRecords, current.inventoryTxns), [current.orders, current.expenses, expenseCategories, current.payrollRecords, current.inventoryTxns]);
  const prevReport = useMemo(() => compareMode ? calcReport(prev.orders, prev.expenses, expenseCategories, prev.payrollRecords, prev.inventoryTxns) : null, [compareMode, prev.orders, prev.expenses, expenseCategories, prev.payrollRecords, prev.inventoryTxns]);

  const exportCSV = () => {
    const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;
    const header = compareMode ? ['Metric', monthLabel, prevMonthLabel, 'Change'] : ['Metric', monthLabel];
    const addRow = (label: string, cur: number, isCurrency = true): string[] => {
      const curStr = isCurrency ? cur.toFixed(2) : String(cur);
      if (!compareMode || !prevReport) return [label, curStr];
      // Find matching prev value - handled per-row below
      return [label, curStr];
    };

    const rows: string[][] = [
      ['Monthly Financial Summary', monthLabel, ...(compareMode ? [`vs ${prevMonthLabel}`] : [])],
      ['Restaurant', settings?.restaurant_name || ''],
      ['Generated', format(new Date(), 'yyyy-MM-dd HH:mm')],
      [],
      header,
      ['--- REVENUE ---'],
    ];

    const r = (label: string, cur: number, prev: number | undefined, isCurrency = true) => {
      const curStr = isCurrency ? cur.toFixed(2) : String(cur);
      if (!compareMode || prev === undefined) return [label, curStr];
      const prevStr = isCurrency ? prev.toFixed(2) : String(prev);
      return [label, curStr, prevStr, pctChange(cur, prev) || '—'];
    };

    rows.push(
      r('Total Revenue', report.totalRevenue, prevReport?.totalRevenue),
      r('Discounts Given', report.totalDiscounts, prevReport?.totalDiscounts),
      r('Tax Collected', report.taxCollected, prevReport?.taxCollected),
      r('Net Revenue', report.netRevenue, prevReport?.netRevenue),
      r('Total Orders', report.totalOrders, prevReport?.totalOrders, false),
      r('Paid Orders', report.paidOrders, prevReport?.paidOrders, false),
      [],
      ['--- EXPENSES ---'],
      r('Total Expenses', report.totalExpenses, prevReport?.totalExpenses),
      ...report.expByCat.map(([c, v]) => {
        const pv = prevReport?.expByCat.find(([pc]) => pc === c)?.[1];
        return r(c, v, pv);
      }),
      [],
      ['--- PAYROLL ---'],
      r('Base Pay', report.totalBasePay, prevReport?.totalBasePay),
      r('Tips', report.totalTips, prevReport?.totalTips),
      r('Bonuses', report.totalBonuses, prevReport?.totalBonuses),
      r('Deductions', report.totalDeductions, prevReport?.totalDeductions),
      r('Net Payroll', report.totalPayroll, prevReport?.totalPayroll),
      [],
      ['--- INVENTORY ---'],
      r('Inventory Purchases', report.inventoryCost, prevReport?.inventoryCost),
      [],
      ['--- PROFITABILITY ---'],
      r('Gross Profit', report.grossProfit, prevReport?.grossProfit),
      r('Total Costs', report.totalCosts, prevReport?.totalCosts),
      r('Net Profit', report.netProfit, prevReport?.netProfit),
      [
        'Profit Margin %',
        report.profitMargin.toFixed(1) + '%',
        ...(compareMode && prevReport ? [prevReport.profitMargin.toFixed(1) + '%', pctChange(report.profitMargin, prevReport.profitMargin) || '—'] : []),
      ],
    );

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financial-summary-${selectedMonth}${compareMode ? `-vs-${prevMonthValue}` : ''}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  const monthLabel = MONTHS.find(m => m.value === selectedMonth)?.label || selectedMonth;

  // Row component with optional comparison
  const Row = ({ label, value, prevValue, bold, negative, invertTrend }: {
    label: string; value: string; prevValue?: string | null; bold?: boolean; negative?: boolean; invertTrend?: boolean;
  }) => {
    // Parse numbers for change badge
    let changeBadge: React.ReactNode = null;
    if (compareMode && prevValue !== undefined && prevValue !== null) {
      const curNum = parseFloat(value.replace(/[^0-9.\-]/g, '')) || 0;
      const prevNum = parseFloat(prevValue.replace(/[^0-9.\-]/g, '')) || 0;
      const change = pctChange(curNum, prevNum);
      if (change) {
        const isUp = change.startsWith('+');
        const colorClass = invertTrend ? (isUp ? 'text-destructive' : 'text-green-500') : (isUp ? 'text-green-500' : 'text-destructive');
        changeBadge = <span className={cn('text-[10px] tabular-nums font-medium', colorClass)}>{change}</span>;
      }
    }

    return (
      <div className={cn('flex items-center justify-between py-1.5', bold && 'font-semibold')}>
        <span className="text-muted-foreground flex-1">{label}</span>
        {compareMode && prevValue !== undefined && prevValue !== null && (
          <span className="text-muted-foreground/60 text-xs tabular-nums w-24 text-right mr-3 print:mr-2">{prevValue}</span>
        )}
        <span className={cn('tabular-nums text-right', negative ? 'text-destructive' : 'text-foreground', compareMode ? 'w-24' : '')}>{value}</span>
        {compareMode && <span className="w-14 text-right">{changeBadge}</span>}
      </div>
    );
  };

  const SectionHeader = () => compareMode ? (
    <div className="flex items-center justify-between pb-1 mb-1 border-b border-border text-[10px] text-muted-foreground/60 uppercase tracking-wider">
      <span className="flex-1" />
      <span className="w-24 text-right mr-3 print:mr-2">{prevMonthLabel}</span>
      <span className="w-24 text-right">{format(new Date(year, month - 1), 'MMM yyyy')}</span>
      <span className="w-14 text-right">Chg</span>
    </div>
  ) : null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Monthly Financial Report</h1>
            <p className="text-sm text-muted-foreground">
              Printable summary for any month
              {compareMode && <span className="text-muted-foreground/60"> — comparing with {prevMonthLabel}</span>}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-2 mr-1">
              <Switch id="compare-report" checked={compareMode} onCheckedChange={setCompareMode} />
              <Label htmlFor="compare-report" className="text-xs cursor-pointer flex items-center gap-1">
                <GitCompareArrows className="h-3.5 w-3.5" /> Compare
              </Label>
            </div>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {MONTHS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCSV} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
              <Printer className="h-3.5 w-3.5" /> Print / PDF
            </Button>
          </div>
        </div>

        <div ref={printRef} className="print:p-8">
          <div className="hidden print:block mb-6">
            <h1 className="text-2xl font-bold">{settings?.restaurant_name || 'Restaurant'}</h1>
            <h2 className="text-lg text-muted-foreground">
              Monthly Financial Summary — {monthLabel}
              {compareMode && ` vs ${prevMonthLabel}`}
            </h2>
            <p className="text-xs text-muted-foreground">Generated {format(new Date(), 'MMMM dd, yyyy \'at\' h:mm a')}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 print:gap-4">
            {/* Revenue */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary print:hidden" /> Revenue
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <SectionHeader />
                <Row label="Gross Revenue" value={fmt(report.totalRevenue)} prevValue={prevReport ? fmt(prevReport.totalRevenue) : null} bold />
                <Row label="Discounts" value={`(${fmt(report.totalDiscounts)})`} prevValue={prevReport ? `(${fmt(prevReport.totalDiscounts)})` : null} invertTrend />
                <Row label="Tax Collected" value={fmt(report.taxCollected)} prevValue={prevReport ? fmt(prevReport.taxCollected) : null} />
                <Separator className="my-2" />
                <Row label="Net Revenue" value={fmt(report.netRevenue)} prevValue={prevReport ? fmt(prevReport.netRevenue) : null} bold />
                <div className="pt-2">
                  <Row label="Total Orders" value={String(report.totalOrders)} prevValue={prevReport ? String(prevReport.totalOrders) : null} />
                  <Row label="Paid Orders" value={String(report.paidOrders)} prevValue={prevReport ? String(prevReport.paidOrders) : null} />
                </div>
              </CardContent>
            </Card>

            {/* Payment Methods */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                {report.paymentBreakdown.length === 0 ? (
                  <p className="text-muted-foreground py-4 text-center">No payment data</p>
                ) : (
                  <>
                    <SectionHeader />
                    {report.paymentBreakdown.map(([method, amount]) => {
                      const prevAmt = prevReport?.paymentBreakdown.find(([m]) => m === method)?.[1];
                      return (
                        <Row key={method} label={method.charAt(0).toUpperCase() + method.slice(1)} value={fmt(amount)} prevValue={prevAmt !== undefined ? fmt(prevAmt) : compareMode ? fmt(0) : null} />
                      );
                    })}
                  </>
                )}
              </CardContent>
            </Card>

            {/* Expenses */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Expenses</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <SectionHeader />
                <Row label="Total Expenses" value={fmt(report.totalExpenses)} prevValue={prevReport ? fmt(prevReport.totalExpenses) : null} bold invertTrend />
                <Separator className="my-2" />
                {report.expByCat.map(([cat, amount]) => {
                  const prevAmt = prevReport?.expByCat.find(([c]) => c === cat)?.[1];
                  return <Row key={cat} label={cat} value={fmt(amount)} prevValue={prevAmt !== undefined ? fmt(prevAmt) : compareMode ? fmt(0) : null} invertTrend />;
                })}
                {report.expByCat.length === 0 && (
                  <p className="text-muted-foreground py-2 text-center text-xs">No expenses recorded</p>
                )}
              </CardContent>
            </Card>

            {/* Payroll */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Payroll</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <SectionHeader />
                <Row label="Base Pay" value={fmt(report.totalBasePay)} prevValue={prevReport ? fmt(prevReport.totalBasePay) : null} invertTrend />
                <Row label="Tips" value={fmt(report.totalTips)} prevValue={prevReport ? fmt(prevReport.totalTips) : null} />
                <Row label="Bonuses" value={fmt(report.totalBonuses)} prevValue={prevReport ? fmt(prevReport.totalBonuses) : null} />
                <Row label="Deductions" value={`(${fmt(report.totalDeductions)})`} prevValue={prevReport ? `(${fmt(prevReport.totalDeductions)})` : null} />
                <Separator className="my-2" />
                <Row label="Net Payroll" value={fmt(report.totalPayroll)} prevValue={prevReport ? fmt(prevReport.totalPayroll) : null} bold invertTrend />
              </CardContent>
            </Card>

            {/* Inventory */}
            <Card className="print:shadow-none print:border">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Inventory</CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <SectionHeader />
                <Row label="Inventory Purchases" value={fmt(report.inventoryCost)} prevValue={prevReport ? fmt(prevReport.inventoryCost) : null} bold invertTrend />
              </CardContent>
            </Card>

            {/* Profitability */}
            <Card className="print:shadow-none print:border border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Profitability</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-0.5">
                <SectionHeader />
                <Row label="Net Revenue" value={fmt(report.netRevenue)} prevValue={prevReport ? fmt(prevReport.netRevenue) : null} />
                <Row label="Total Expenses" value={`(${fmt(report.totalExpenses)})`} prevValue={prevReport ? `(${fmt(prevReport.totalExpenses)})` : null} invertTrend />
                <Row label="Inventory Costs" value={`(${fmt(report.inventoryCost)})`} prevValue={prevReport ? `(${fmt(prevReport.inventoryCost)})` : null} invertTrend />
                <Separator className="my-2" />
                <Row label="Gross Profit" value={fmt(report.grossProfit)} prevValue={prevReport ? fmt(prevReport.grossProfit) : null} bold negative={report.grossProfit < 0} />
                <Row label="Payroll" value={`(${fmt(report.totalPayroll)})`} prevValue={prevReport ? `(${fmt(prevReport.totalPayroll)})` : null} invertTrend />
                <Separator className="my-2" />
                <Row label="Net Profit" value={fmt(report.netProfit)} prevValue={prevReport ? fmt(prevReport.netProfit) : null} bold negative={report.netProfit < 0} />
                <Row label="Profit Margin" value={`${report.profitMargin.toFixed(1)}%`} prevValue={prevReport ? `${prevReport.profitMargin.toFixed(1)}%` : null} bold negative={report.profitMargin < 0} />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
