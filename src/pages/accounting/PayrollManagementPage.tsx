import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  Users, Plus, Clock, DollarSign, Calendar, Banknote, FileText,
  TrendingUp, CheckCircle2, AlertCircle, CreditCard,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';

const PIE_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))',
];

const TIP_SOURCES = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'pool', label: 'Tip Pool' },
];

const SHIFT_STATUSES = [
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { value: 'completed', label: 'Completed', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
  { value: 'missed', label: 'Missed', color: 'bg-destructive/10 text-destructive border-destructive/30' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-muted text-muted-foreground border-border' },
];

const PAYROLL_STATUSES = [
  { value: 'draft', label: 'Draft', color: 'bg-muted text-muted-foreground border-border' },
  { value: 'approved', label: 'Approved', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  { value: 'paid', label: 'Paid', color: 'bg-green-500/10 text-green-600 border-green-500/30' },
];

export default function PayrollManagementPage() {
  const { user } = useAuth();
  const { format: fc } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState('shifts');
  const [shiftDialogOpen, setShiftDialogOpen] = useState(false);
  const [tipDialogOpen, setTipDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);

  // Shift form
  const [shiftForm, setShiftForm] = useState({
    user_id: '', shift_date: format(new Date(), 'yyyy-MM-dd'), start_time: '09:00', end_time: '17:00',
    hours_worked: 8, hourly_rate: 15, notes: '', status: 'scheduled',
  });

  // Tip form
  const [tipForm, setTipForm] = useState({
    user_id: '', tip_date: format(new Date(), 'yyyy-MM-dd'), amount: 0, source: 'cash', notes: '',
  });

  // Payroll form
  const [payrollForm, setPayrollForm] = useState({
    user_id: '', period_start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    period_end: format(endOfMonth(new Date()), 'yyyy-MM-dd'),
    base_pay: 0, tips_total: 0, bonuses: 0, deductions: 0, notes: '', status: 'draft',
  });

  // Fetch staff profiles — scoped to current restaurant via restaurant_members
  const { data: staffProfiles = [] } = useQuery({
    queryKey: ['staff-profiles', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('restaurant_members')
        .select('user_id')
        .eq('restaurant_id', restaurantId!);
      const memberIds = [...new Set((members || []).map(m => m.user_id))];
      if (memberIds.length === 0) return [];
      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', memberIds)
        .in('role', ['admin', 'manager', 'waiter', 'server', 'kitchen']);
      const userIds = [...new Set((roles || []).map(r => r.user_id))];
      if (userIds.length === 0) return [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);
      return (profiles || []).map(p => ({
        ...p,
        roles: (roles || []).filter(r => r.user_id === p.user_id).map(r => r.role),
      }));
    },
  });

  // Shifts
  const { data: shifts = [], isLoading: loadingShifts } = useQuery({
    queryKey: ['employee-shifts', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_shifts').select('*').eq('restaurant_id', restaurantId!).order('shift_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Tips
  const { data: tips = [], isLoading: loadingTips } = useQuery({
    queryKey: ['employee-tips', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('employee_tips').select('*').eq('restaurant_id', restaurantId!).order('tip_date', { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Payroll records
  const { data: payrolls = [], isLoading: loadingPayroll } = useQuery({
    queryKey: ['payroll-records', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('payroll_records').select('*').eq('restaurant_id', restaurantId!).order('period_end', { ascending: false }).limit(200);
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const addShift = useMutation({
    mutationFn: async (values: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const { error } = await supabase
        .from('employee_shifts')
        .insert({ ...values, restaurant_id: restaurantId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-shifts'] }); toast.success('Shift added'); setShiftDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const addTip = useMutation({
    mutationFn: async (values: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const { error } = await supabase
        .from('employee_tips')
        .insert({ ...values, restaurant_id: restaurantId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['employee-tips'] }); toast.success('Tip recorded'); setTipDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const addPayroll = useMutation({
    mutationFn: async (values: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const net_pay = values.base_pay + values.tips_total + values.bonuses - values.deductions;
      const { error } = await supabase
        .from('payroll_records')
        .insert({ ...values, net_pay, restaurant_id: restaurantId });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-records'] }); toast.success('Payroll record created'); setPayrollDialogOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const updatePayrollStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const updates: any = { status };
      if (status === 'paid') updates.paid_at = new Date().toISOString();
      const { error } = await supabase
        .from('payroll_records')
        .update(updates)
        .eq('id', id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['payroll-records'] }); toast.success('Status updated'); },
    onError: (e: any) => toast.error(e.message),
  });

  const getStaffName = (userId: string) => staffProfiles.find(p => p.user_id === userId)?.display_name || 'Unknown';

  // Stats
  const thisMonth = startOfMonth(new Date());
  const monthShifts = shifts.filter(s => new Date(s.shift_date) >= thisMonth);
  const monthTips = tips.filter(t => new Date(t.tip_date) >= thisMonth);
  const totalHours = monthShifts.reduce((s, sh) => s + Number(sh.hours_worked), 0);
  const totalWages = monthShifts.reduce((s, sh) => s + (Number(sh.hours_worked) * Number(sh.hourly_rate)), 0);
  const totalTips = monthTips.reduce((s, t) => s + Number(t.amount), 0);
  const totalPayroll = payrolls.filter(p => new Date(p.period_end) >= thisMonth).reduce((s, p) => s + Number(p.net_pay), 0);

  // Tips by source chart
  const tipsBySource = useMemo(() => {
    const map: Record<string, number> = {};
    monthTips.forEach(t => { map[t.source] = (map[t.source] || 0) + Number(t.amount); });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value: Math.round(value * 100) / 100 }));
  }, [monthTips]);

  // Hours by employee chart
  const hoursByEmployee = useMemo(() => {
    const map: Record<string, number> = {};
    monthShifts.forEach(s => {
      const name = getStaffName(s.user_id);
      map[name] = (map[name] || 0) + Number(s.hours_worked);
    });
    return Object.entries(map).map(([name, hours]) => ({ name, hours: Math.round(hours * 10) / 10 })).sort((a, b) => b.hours - a.hours).slice(0, 10);
  }, [monthShifts, staffProfiles]);

  // Auto-calculate hours when times change
  function calcHours(start: string, end: string) {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let diff = (eh * 60 + em) - (sh * 60 + sm);
    if (diff < 0) diff += 24 * 60;
    return Math.round((diff / 60) * 100) / 100;
  }

  // Auto-calculate payroll from shifts & tips
  function autoCalcPayroll(userId: string, periodStart: string, periodEnd: string) {
    const userShifts = shifts.filter(s => s.user_id === userId && s.shift_date >= periodStart && s.shift_date <= periodEnd && s.status === 'completed');
    const userTips = tips.filter(t => t.user_id === userId && t.tip_date >= periodStart && t.tip_date <= periodEnd);
    const basePay = userShifts.reduce((s, sh) => s + (Number(sh.hours_worked) * Number(sh.hourly_rate)), 0);
    const tipsTotal = userTips.reduce((s, t) => s + Number(t.amount), 0);
    setPayrollForm(f => ({ ...f, base_pay: Math.round(basePay * 100) / 100, tips_total: Math.round(tipsTotal * 100) / 100 }));
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Payroll Management</h1>
            <p className="text-sm text-muted-foreground">Manage shifts, tips, and payroll for staff</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dialog open={shiftDialogOpen} onOpenChange={setShiftDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Clock className="h-4 w-4 mr-2" />Add Shift</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Shift</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); addShift.mutate(shiftForm); }} className="space-y-4">
                  <div>
                    <Label>Employee</Label>
                    <Select value={shiftForm.user_id} onValueChange={v => setShiftForm(f => ({ ...f, user_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>{staffProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name} ({p.roles?.join(', ')})</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>Date</Label><Input type="date" value={shiftForm.shift_date} onChange={e => setShiftForm(f => ({ ...f, shift_date: e.target.value }))} /></div>
                    <div><Label>Start</Label><Input type="time" value={shiftForm.start_time} onChange={e => { const v = e.target.value; setShiftForm(f => ({ ...f, start_time: v, hours_worked: calcHours(v, f.end_time) })); }} /></div>
                    <div><Label>End</Label><Input type="time" value={shiftForm.end_time} onChange={e => { const v = e.target.value; setShiftForm(f => ({ ...f, end_time: v, hours_worked: calcHours(f.start_time, v) })); }} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>Hours</Label><Input type="number" step="0.01" value={shiftForm.hours_worked} onChange={e => setShiftForm(f => ({ ...f, hours_worked: Number(e.target.value) }))} /></div>
                    <div><Label>Hourly Rate</Label><Input type="number" step="0.01" value={shiftForm.hourly_rate} onChange={e => setShiftForm(f => ({ ...f, hourly_rate: Number(e.target.value) }))} /></div>
                    <div><Label>Status</Label>
                      <Select value={shiftForm.status} onValueChange={v => setShiftForm(f => ({ ...f, status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{SHIFT_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={shiftForm.notes} onChange={e => setShiftForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." /></div>
                  <Button type="submit" className="w-full" disabled={!shiftForm.user_id || addShift.isPending}>{addShift.isPending ? 'Saving...' : 'Add Shift'}</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={tipDialogOpen} onOpenChange={setTipDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm"><Banknote className="h-4 w-4 mr-2" />Record Tip</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Tip</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); addTip.mutate(tipForm); }} className="space-y-4">
                  <div>
                    <Label>Employee</Label>
                    <Select value={tipForm.user_id} onValueChange={v => setTipForm(f => ({ ...f, user_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>{staffProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div><Label>Amount</Label><Input type="number" step="0.01" min="0" value={tipForm.amount || ''} onChange={e => setTipForm(f => ({ ...f, amount: Number(e.target.value) }))} /></div>
                    <div><Label>Source</Label>
                      <Select value={tipForm.source} onValueChange={v => setTipForm(f => ({ ...f, source: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{TIP_SOURCES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label>Date</Label><Input type="date" value={tipForm.tip_date} onChange={e => setTipForm(f => ({ ...f, tip_date: e.target.value }))} /></div>
                  </div>
                  <div><Label>Notes</Label><Textarea value={tipForm.notes} onChange={e => setTipForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." /></div>
                  <Button type="submit" className="w-full" disabled={!tipForm.user_id || tipForm.amount <= 0 || addTip.isPending}>{addTip.isPending ? 'Saving...' : 'Record Tip'}</Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><FileText className="h-4 w-4 mr-2" />Create Payroll</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Payroll Record</DialogTitle></DialogHeader>
                <form onSubmit={e => { e.preventDefault(); addPayroll.mutate(payrollForm); }} className="space-y-4">
                  <div>
                    <Label>Employee</Label>
                    <Select value={payrollForm.user_id} onValueChange={v => { setPayrollForm(f => ({ ...f, user_id: v })); autoCalcPayroll(v, payrollForm.period_start, payrollForm.period_end); }}>
                      <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                      <SelectContent>{staffProfiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.display_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Period Start</Label><Input type="date" value={payrollForm.period_start} onChange={e => setPayrollForm(f => ({ ...f, period_start: e.target.value }))} /></div>
                    <div><Label>Period End</Label><Input type="date" value={payrollForm.period_end} onChange={e => setPayrollForm(f => ({ ...f, period_end: e.target.value }))} /></div>
                  </div>
                  {payrollForm.user_id && (
                    <Button type="button" variant="outline" size="sm" onClick={() => autoCalcPayroll(payrollForm.user_id, payrollForm.period_start, payrollForm.period_end)}>
                      Auto-calculate from shifts & tips
                    </Button>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Base Pay</Label><Input type="number" step="0.01" value={payrollForm.base_pay || ''} onChange={e => setPayrollForm(f => ({ ...f, base_pay: Number(e.target.value) }))} /></div>
                    <div><Label>Tips Total</Label><Input type="number" step="0.01" value={payrollForm.tips_total || ''} onChange={e => setPayrollForm(f => ({ ...f, tips_total: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div><Label>Bonuses</Label><Input type="number" step="0.01" value={payrollForm.bonuses || ''} onChange={e => setPayrollForm(f => ({ ...f, bonuses: Number(e.target.value) }))} /></div>
                    <div><Label>Deductions</Label><Input type="number" step="0.01" value={payrollForm.deductions || ''} onChange={e => setPayrollForm(f => ({ ...f, deductions: Number(e.target.value) }))} /></div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <span className="text-sm text-muted-foreground">Net Pay: </span>
                    <span className="font-bold text-foreground">{fc(payrollForm.base_pay + payrollForm.tips_total + payrollForm.bonuses - payrollForm.deductions)}</span>
                  </div>
                  <div><Label>Notes</Label><Textarea value={payrollForm.notes} onChange={e => setPayrollForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional..." /></div>
                  <Button type="submit" className="w-full" disabled={!payrollForm.user_id || addPayroll.isPending}>{addPayroll.isPending ? 'Creating...' : 'Create Payroll'}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Hours (Month)</p>
                  <p className="text-2xl font-bold text-foreground">{totalHours.toFixed(1)}h</p>
                  <p className="text-xs text-muted-foreground">{monthShifts.length} shifts</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Wages (Month)</p>
                  <p className="text-2xl font-bold text-foreground">{fc(totalWages)}</p>
                  <p className="text-xs text-muted-foreground">From completed shifts</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Tips (Month)</p>
                  <p className="text-2xl font-bold text-foreground">{fc(totalTips)}</p>
                  <p className="text-xs text-muted-foreground">{monthTips.length} tip entries</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-green-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Payroll (Month)</p>
                  <p className="text-2xl font-bold text-foreground">{fc(totalPayroll)}</p>
                  <p className="text-xs text-muted-foreground">Net pay disbursed</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-accent/50 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-accent-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="shifts">Shifts</TabsTrigger>
            <TabsTrigger value="tips">Tips</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
          </TabsList>

          {/* Shifts Tab */}
          <TabsContent value="shifts">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Employee Shifts</CardTitle>
                <CardDescription>Schedule and track employee work hours</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead className="text-right">Rate</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingShifts ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : shifts.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No shifts recorded</TableCell></TableRow>
                    ) : shifts.map(shift => {
                      const statusDef = SHIFT_STATUSES.find(s => s.value === shift.status);
                      return (
                        <TableRow key={shift.id}>
                          <TableCell className="font-medium">{getStaffName(shift.user_id)}</TableCell>
                          <TableCell>{format(new Date(shift.shift_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{shift.start_time} - {shift.end_time}</TableCell>
                          <TableCell className="text-right">{Number(shift.hours_worked).toFixed(1)}h</TableCell>
                          <TableCell className="text-right">{fc(shift.hourly_rate)}/hr</TableCell>
                          <TableCell className="text-right font-medium">{fc(Number(shift.hours_worked) * Number(shift.hourly_rate))}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusDef?.color || ''}`}>{statusDef?.label || shift.status}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">{shift.notes || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tips Tab */}
          <TabsContent value="tips">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Tip Records</CardTitle>
                <CardDescription>Track tips by employee, source, and date</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTips ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : tips.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No tips recorded</TableCell></TableRow>
                    ) : tips.map(tip => (
                      <TableRow key={tip.id}>
                        <TableCell className="font-medium">{getStaffName(tip.user_id)}</TableCell>
                        <TableCell>{format(new Date(tip.tip_date), 'MMM dd, yyyy')}</TableCell>
                        <TableCell className="text-right font-medium">{fc(tip.amount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs capitalize">{tip.source}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{tip.notes || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payroll Tab */}
          <TabsContent value="payroll">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Payroll Records</CardTitle>
                <CardDescription>Review and manage payroll for each pay period</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Base Pay</TableHead>
                      <TableHead className="text-right">Tips</TableHead>
                      <TableHead className="text-right">Bonuses</TableHead>
                      <TableHead className="text-right">Deductions</TableHead>
                      <TableHead className="text-right">Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPayroll ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : payrolls.length === 0 ? (
                      <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No payroll records</TableCell></TableRow>
                    ) : payrolls.map(pr => {
                      const statusDef = PAYROLL_STATUSES.find(s => s.value === pr.status);
                      return (
                        <TableRow key={pr.id}>
                          <TableCell className="font-medium">{getStaffName(pr.user_id)}</TableCell>
                          <TableCell className="text-sm">{format(new Date(pr.period_start), 'MMM dd')} – {format(new Date(pr.period_end), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="text-right">{fc(pr.base_pay)}</TableCell>
                          <TableCell className="text-right">{fc(pr.tips_total)}</TableCell>
                          <TableCell className="text-right">{fc(pr.bonuses)}</TableCell>
                          <TableCell className="text-right text-destructive">{fc(pr.deductions)}</TableCell>
                          <TableCell className="text-right font-bold">{fc(pr.net_pay)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${statusDef?.color || ''}`}>{statusDef?.label || pr.status}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {pr.status === 'draft' && (
                              <Button variant="ghost" size="sm" onClick={() => updatePayrollStatus.mutate({ id: pr.id, status: 'approved' })}>Approve</Button>
                            )}
                            {pr.status === 'approved' && (
                              <Button variant="ghost" size="sm" onClick={() => updatePayrollStatus.mutate({ id: pr.id, status: 'paid' })}>Mark Paid</Button>
                            )}
                            {pr.status === 'paid' && pr.paid_at && (
                              <span className="text-xs text-muted-foreground">Paid {format(new Date(pr.paid_at), 'MMM dd')}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Hours by Employee (This Month)</CardTitle>
                </CardHeader>
                <CardContent>
                  {hoursByEmployee.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No shift data this month</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={hoursByEmployee} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                        <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                        <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Hours" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Tips by Source (This Month)</CardTitle>
                </CardHeader>
                <CardContent>
                  {tipsBySource.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No tips recorded this month</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={tipsBySource} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                          {tipsBySource.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fc(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">Payroll Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Active Staff</p>
                      <p className="text-xl font-bold text-foreground">{staffProfiles.length}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Avg Hours/Employee</p>
                      <p className="text-xl font-bold text-foreground">{staffProfiles.length > 0 ? (totalHours / staffProfiles.length).toFixed(1) : 0}h</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Avg Tips/Employee</p>
                      <p className="text-xl font-bold text-foreground">{staffProfiles.length > 0 ? fc(totalTips / staffProfiles.length) : fc(0)}</p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Labor Cost</p>
                      <p className="text-xl font-bold text-foreground">{fc(totalWages + totalTips)}</p>
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
