import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  Plus, Receipt, Calendar, Trash2, Pencil, AlertTriangle, TrendingUp,
  DollarSign, CalendarDays, Search, X, ChevronDown,
} from 'lucide-react';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';

type Period = 'this_month' | '30days' | '90days' | 'all';

export default function ExpenseManagementPage() {
  const { format: fmt } = useCurrency();
  const { user } = useAuth();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('this_month');
  const [branchId, setBranchId] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#6366f1');
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [deleteCatId, setDeleteCatId] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    category_id: '',
    amount: '',
    description: '',
    vendor: '',
    reference_number: '',
    expense_date: format(new Date(), 'yyyy-MM-dd'),
    payment_method: 'cash',
  });

  const resetForm = () => {
    setForm({
      category_id: '',
      amount: '',
      description: '',
      vendor: '',
      reference_number: '',
      expense_date: format(new Date(), 'yyyy-MM-dd'),
      payment_method: 'cash',
    });
    setEditingExpense(null);
  };

  // Date range
  const dateRange = useMemo(() => {
    const now = new Date();
    if (period === 'this_month') return { start: startOfMonth(now), end: endOfMonth(now) };
    if (period === '30days') return { start: subDays(now, 29), end: now };
    if (period === '90days') return { start: subDays(now, 89), end: now };
    return { start: new Date('2020-01-01'), end: now };
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

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['expense_categories', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['expenses', restaurantId ?? 'none', period, branchId, categoryFilter],
    enabled: !!restaurantId,
    queryFn: async () => {
      let q = supabase
        .from('expenses')
        .select('*, expense_categories(name, icon, color)')
        .eq('restaurant_id', restaurantId!)
        .gte('expense_date', format(dateRange.start, 'yyyy-MM-dd'))
        .lte('expense_date', format(dateRange.end, 'yyyy-MM-dd'))
        .order('expense_date', { ascending: false });
      if (branchId !== 'all') q = q.eq('branch_id', branchId);
      if (categoryFilter !== 'all') q = q.eq('category_id', categoryFilter);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch budget alerts
  const { data: budgets = [] } = useQuery({
    queryKey: ['budget_alerts', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_alerts')
        .select('*, expense_categories(name)')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  // Add/update expense mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      if (editingExpense) {
        const { error } = await supabase
          .from('expenses')
          .update(data)
          .eq('id', editingExpense.id)
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('expenses')
          .insert({ ...data, restaurant_id: restaurantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(editingExpense ? 'Expense updated' : 'Expense added');
      setAddDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Expense deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Add category mutation
  const addCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No active restaurant');
      const trimmed = newCatName.trim();
      if (!trimmed) throw new Error('Category name is required');
      if (trimmed.length > 100) throw new Error('Category name must be less than 100 characters');
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({ name: trimmed, color: newCatColor, restaurant_id: restaurantId })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      setForm(f => ({ ...f, category_id: data.id }));
      setCatDialogOpen(false);
      setNewCatName('');
      setNewCatColor('#6366f1');
      setEditingCategory(null);
      toast.success('Category created');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No active restaurant');
      if (!editingCategory) throw new Error('No category selected');
      const trimmed = newCatName.trim();
      if (!trimmed) throw new Error('Category name is required');
      const { error } = await supabase
        .from('expense_categories')
        .update({ name: trimmed, color: newCatColor })
        .eq('id', editingCategory.id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      setCatDialogOpen(false);
      setNewCatName('');
      setNewCatColor('#6366f1');
      setEditingCategory(null);
      toast.success('Category updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const { error } = await supabase
        .from('expense_categories')
        .update({ is_active: false })
        .eq('id', id)
        .eq('restaurant_id', restaurantId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense_categories'] });
      setDeleteCatId(null);
      toast.success('Category deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openEditCategory = (cat: any) => {
    setEditingCategory(cat);
    setNewCatName(cat.name);
    setNewCatColor(cat.color || '#6366f1');
    setCatDialogOpen(true);
  };

  const openAddCategory = () => {
    setEditingCategory(null);
    setNewCatName('');
    setNewCatColor('#6366f1');
    setCatDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!form.category_id || !form.amount) {
      toast.error('Category and amount are required');
      return;
    }
    saveMutation.mutate({
      category_id: form.category_id,
      amount: parseFloat(form.amount),
      description: form.description || null,
      vendor: form.vendor || null,
      reference_number: form.reference_number || null,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      recorded_by: user?.id || null,
      branch_id: branchId !== 'all' ? branchId : null,
    });
  };

  const openEdit = (expense: any) => {
    setEditingExpense(expense);
    setForm({
      category_id: expense.category_id || '',
      amount: String(expense.amount),
      description: expense.description || '',
      vendor: expense.vendor || '',
      reference_number: expense.reference_number || '',
      expense_date: expense.expense_date,
      payment_method: expense.payment_method || 'cash',
    });
    setAddDialogOpen(true);
  };

  // Computed
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
  const categoryTotals = useMemo(() => {
    const map: Record<string, { name: string; total: number; color: string }> = {};
    expenses.forEach(e => {
      const cat = e.expense_categories as any;
      const catId = e.category_id || 'unknown';
      if (!map[catId]) map[catId] = { name: cat?.name || 'Uncategorized', total: 0, color: cat?.color || '#64748b' };
      map[catId].total += Number(e.amount);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [expenses]);

  // Budget alerts check
  const activeAlerts = useMemo(() => {
    return budgets.filter(b => {
      const catExpenses = expenses
        .filter(e => e.category_id === b.category_id)
        .reduce((s, e) => s + Number(e.amount), 0);
      return catExpenses >= Number(b.monthly_budget) * (Number(b.alert_threshold_pct) / 100);
    });
  }, [budgets, expenses]);

  const filteredExpenses = searchQuery
    ? expenses.filter(e =>
        (e.description || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.vendor || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (e.expense_categories as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : expenses;

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 xl:p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="display-heading text-xl">Expense Management</h1>
            <p className="text-sm text-muted-foreground mt-1">Track and manage all restaurant expenses</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <CalendarDays className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="this_month">This Month</SelectItem>
                <SelectItem value="30days">Last 30 Days</SelectItem>
                <SelectItem value="90days">Last 90 Days</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => { resetForm(); setAddDialogOpen(true); }} className="h-9 gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Budget alerts */}
        {activeAlerts.length > 0 && (
          <div className="space-y-2">
            {activeAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-3 bg-warning/5 border border-warning/15 rounded-xl p-3">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-sm text-card-foreground">
                  <span className="font-semibold">{(alert.expense_categories as any)?.name}</span> expenses have reached{' '}
                  {alert.alert_threshold_pct}% of the {fmt(Number(alert.monthly_budget))} monthly budget
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center mb-2">
                <DollarSign className="h-4 w-4 text-destructive" />
              </div>
              <p className="text-xl font-bold tabular-nums text-card-foreground">{fmt(totalExpenses)}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Total Expenses</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2">
                <Receipt className="h-4 w-4 text-primary" />
              </div>
              <p className="text-xl font-bold tabular-nums text-card-foreground">{expenses.length}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Entries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="h-8 w-8 rounded-lg bg-warning/10 flex items-center justify-center mb-2">
                <TrendingUp className="h-4 w-4 text-warning" />
              </div>
              <p className="text-xl font-bold tabular-nums text-card-foreground">{categoryTotals.length}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Categories Used</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center mb-2">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-xl font-bold tabular-nums text-card-foreground">{activeAlerts.length}</p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Budget Alerts</p>
            </CardContent>
          </Card>
        </div>

        {/* Category breakdown + management */}
        {categories.length > 0 && (
          <Collapsible defaultOpen>
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CollapsibleTrigger className="flex items-center gap-1.5 group cursor-pointer">
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                    <CardTitle className="text-sm font-semibold">Expense Categories</CardTitle>
                  </CollapsibleTrigger>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={openAddCategory}>
                    <Plus className="h-3 w-3" /> Add Category
                  </Button>
                </div>
              </CardHeader>
              <CollapsibleContent>
                <CardContent>
                  <div className="space-y-3">
                    {categories.map(cat => {
                      const catTotal = categoryTotals.find(ct => ct.name === cat.name);
                      const total = catTotal?.total || 0;
                      const pct = totalExpenses > 0 ? (total / totalExpenses) * 100 : 0;
                      return (
                        <div key={cat.id} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ background: cat.color || '#64748b' }} />
                              <span className="text-sm text-card-foreground">{cat.name}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {total > 0 && (
                                <>
                                  <span className="text-xs text-muted-foreground tabular-nums">{pct.toFixed(1)}%</span>
                                  <span className="text-sm font-semibold tabular-nums text-card-foreground">{fmt(total)}</span>
                                </>
                              )}
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditCategory(cat)}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteCatId(cat.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {total > 0 && (
                            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: cat.color || '#64748b' }} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* Search + filter */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <Input
              placeholder="Search expenses..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] h-9 text-sm">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Expense list */}
        <Card>
          <CardContent className="p-0">
            {filteredExpenses.length > 0 ? (
              <div className="divide-y divide-border">
                {filteredExpenses.map(expense => {
                  const cat = expense.expense_categories as any;
                  return (
                    <div key={expense.id} className="flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors">
                      <div
                        className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: `${cat?.color || '#64748b'}15` }}
                      >
                        <DollarSign className="h-4 w-4" style={{ color: cat?.color || '#64748b' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {expense.description || cat?.name || 'Expense'}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-muted-foreground">{cat?.name}</span>
                          {expense.vendor && (
                            <>
                              <span className="text-muted-foreground/30">·</span>
                              <span className="text-[11px] text-muted-foreground">{expense.vendor}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold tabular-nums text-destructive">{fmt(Number(expense.amount))}</p>
                        <p className="text-[11px] text-muted-foreground">{format(new Date(expense.expense_date), 'MMM dd, yyyy')}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(expense)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(expense.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <Receipt className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" strokeWidth={1} />
                <p className="text-muted-foreground text-sm">No expenses recorded for this period</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => { resetForm(); setAddDialogOpen(true); }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add your first expense
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Add/edit dialog */}
      <Dialog open={addDialogOpen} onOpenChange={(o) => { if (!o) { resetForm(); } setAddDialogOpen(o); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingExpense ? 'Edit Expense' : 'Add Expense'}</DialogTitle>
            <DialogDescription>Record a new expense entry for your restaurant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Category *</Label>
              <div className="flex gap-2 mt-1">
                <Select value={form.category_id} onValueChange={v => setForm(f => ({ ...f, category_id: v }))}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={openAddCategory} title="New category">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className="mt-1" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1" placeholder="What was this expense for?" rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Vendor</Label>
                <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} className="mt-1" placeholder="Supplier name" />
              </div>
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={form.payment_method} onValueChange={v => setForm(f => ({ ...f, payment_method: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="check">Check</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Reference / Invoice #</Label>
              <Input value={form.reference_number} onChange={e => setForm(f => ({ ...f, reference_number: e.target.value }))} className="mt-1" placeholder="INV-001" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setAddDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Saving...' : editingExpense ? 'Update' : 'Add Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/edit category dialog */}
      <Dialog open={catDialogOpen} onOpenChange={(o) => { if (!o) { setEditingCategory(null); setNewCatName(''); setNewCatColor('#6366f1'); } setCatDialogOpen(o); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Expense Category'}</DialogTitle>
            <DialogDescription>{editingCategory ? 'Update the category details.' : 'Create a new category to organize expenses.'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs">Category Name *</Label>
              <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} className="mt-1" placeholder="e.g. Utilities" maxLength={100} />
            </div>
            <div>
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-3 mt-1">
                <input type="color" value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="h-9 w-9 rounded border border-border cursor-pointer" />
                <Input value={newCatColor} onChange={e => setNewCatColor(e.target.value)} className="flex-1 font-mono text-sm" placeholder="#6366f1" maxLength={7} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancel</Button>
            {editingCategory ? (
              <Button onClick={() => updateCategoryMutation.mutate()} disabled={updateCategoryMutation.isPending || !newCatName.trim()}>
                {updateCategoryMutation.isPending ? 'Saving...' : 'Update Category'}
              </Button>
            ) : (
              <Button onClick={() => addCategoryMutation.mutate()} disabled={addCategoryMutation.isPending || !newCatName.trim()}>
                {addCategoryMutation.isPending ? 'Creating...' : 'Create Category'}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete category confirmation */}
      <Dialog open={!!deleteCatId} onOpenChange={(o) => { if (!o) setDeleteCatId(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>This will hide the category from future use. Existing expenses will keep their category assignment.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteCatId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteCatId && deleteCategoryMutation.mutate(deleteCatId)} disabled={deleteCategoryMutation.isPending}>
              {deleteCategoryMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
