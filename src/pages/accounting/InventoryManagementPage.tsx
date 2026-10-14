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
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { FilterBar } from '@/components/admin/ResponsiveTable';
import DataPagination, { usePagination } from '@/components/admin/DataPagination';

import { toast } from 'sonner';
import {
  Package, Plus, AlertTriangle, TrendingDown, Trash2, ArrowDownRight, ArrowUpRight,
  BarChart3, Search, Filter, PackageOpen, ShoppingCart, Minus, RotateCcw,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth } from 'date-fns';
import MenuRecipesTab from '@/components/accounting/MenuRecipesTab';
import RestockTab from '@/components/accounting/RestockTab';
import InventoryAnalyticsTab from '@/components/accounting/InventoryAnalyticsTab';




const UNITS = ['kg', 'g', 'L', 'mL', 'pcs', 'boxes', 'bags', 'bottles', 'cans', 'dozen'];
const CATEGORIES = ['Produce', 'Meat', 'Seafood', 'Dairy', 'Beverages', 'Dry Goods', 'Spices', 'Oils', 'Cleaning', 'Packaging', 'General'];
const TRANSACTION_TYPES = [
  { value: 'purchase', label: 'Purchase', icon: ShoppingCart, color: 'text-green-500' },
  { value: 'usage', label: 'Usage', icon: Minus, color: 'text-blue-500' },
  { value: 'waste', label: 'Waste', icon: Trash2, color: 'text-destructive' },
  { value: 'adjustment', label: 'Adjustment', icon: RotateCcw, color: 'text-orange-500' },
];

const PIE_COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(210, 60%, 50%)',
  'hsl(30, 60%, 50%)', 'hsl(150, 60%, 40%)', 'hsl(0, 60%, 50%)', 'hsl(270, 50%, 55%)',
];

export default function InventoryManagementPage() {
  const { user } = useAuth();
  const { format: fc } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState('stock');
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState<string>('all');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [txDialogOpen, setTxDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);

  // Form state for new item
  const [itemForm, setItemForm] = useState({
    name: '', category: 'General', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0, is_active: true,
  });

  // Form state for transaction
  const [txForm, setTxForm] = useState({
    item_id: '', type: 'purchase', quantity: 0, unit_cost: 0, notes: '', transaction_date: format(new Date(), 'yyyy-MM-dd'),
  });

  // Queries
  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ['inventory-items', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ['inventory-transactions', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_transactions')
        .select('*, inventory_items(name, unit)')
        .eq('restaurant_id', restaurantId!)
        .order('transaction_date', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });

  // Mutations
  const upsertItem = useMutation({
    mutationFn: async (values: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      if (editItem) {
        const { error } = await supabase
          .from('inventory_items')
          .update(values)
          .eq('id', editItem.id)
          .eq('restaurant_id', restaurantId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('inventory_items')
          .insert({ ...values, restaurant_id: restaurantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      toast.success(editItem ? 'Item updated' : 'Item added');
      setItemDialogOpen(false);
      setEditItem(null);
      resetItemForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addTransaction = useMutation({
    mutationFn: async (values: any) => {
      if (!restaurantId) throw new Error('No active restaurant');
      const total_cost = values.quantity * values.unit_cost;
      const { error } = await supabase
        .from('inventory_transactions')
        .insert({ ...values, total_cost, recorded_by: user?.id, restaurant_id: restaurantId });
      if (error) throw error;

      // Update stock level
      const item = items.find(i => i.id === values.item_id);
      if (item) {
        let newStock = item.current_stock;
        if (values.type === 'purchase') newStock += values.quantity;
        else if (values.type === 'usage' || values.type === 'waste') newStock -= values.quantity;
        else newStock = values.quantity; // adjustment sets absolute
        await supabase
          .from('inventory_items')
          .update({
            current_stock: Math.max(0, newStock),
            cost_per_unit: values.type === 'purchase' && values.unit_cost > 0 ? values.unit_cost : item.cost_per_unit,
          })
          .eq('id', values.item_id)
          .eq('restaurant_id', restaurantId);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success('Transaction recorded');
      setTxDialogOpen(false);
      resetTxForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  function resetItemForm() {
    setItemForm({ name: '', category: 'General', unit: 'kg', current_stock: 0, min_stock: 0, cost_per_unit: 0, is_active: true });
  }
  function resetTxForm() {
    setTxForm({ item_id: '', type: 'purchase', quantity: 0, unit_cost: 0, notes: '', transaction_date: format(new Date(), 'yyyy-MM-dd') });
  }

  function openEditItem(item: any) {
    setEditItem(item);
    setItemForm({ name: item.name, category: item.category, unit: item.unit, current_stock: item.current_stock, min_stock: item.min_stock, cost_per_unit: item.cost_per_unit, is_active: item.is_active });
    setItemDialogOpen(true);
  }

  // Filtered items
  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (catFilter !== 'all' && i.category !== catFilter) return false;
      if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, search, catFilter]);

  const itemsPager = usePagination(filteredItems, 25);
  const txPager = usePagination(transactions, 25);



  // Stats
  const lowStockItems = items.filter(i => i.is_active && i.current_stock <= i.min_stock);
  const totalStockValue = items.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0);

  const thisMonth = startOfMonth(new Date());
  const monthTx = transactions.filter(t => new Date(t.transaction_date) >= thisMonth);
  const cogsSold = monthTx.filter(t => t.type === 'usage').reduce((s, t) => s + Number(t.total_cost), 0);
  const wasteTotal = monthTx.filter(t => t.type === 'waste').reduce((s, t) => s + Number(t.total_cost), 0);
  const purchaseTotal = monthTx.filter(t => t.type === 'purchase').reduce((s, t) => s + Number(t.total_cost), 0);

  // Category breakdown for chart
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    items.forEach(i => { map[i.category] = (map[i.category] || 0) + (i.current_stock * i.cost_per_unit); });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [items]);

  // Waste by category
  const wasteByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    const wasteTx = transactions.filter(t => t.type === 'waste' && new Date(t.transaction_date) >= subDays(new Date(), 30));
    wasteTx.forEach(t => {
      const item = items.find(i => i.id === t.item_id);
      const cat = item?.category || 'Other';
      map[cat] = (map[cat] || 0) + Number(t.total_cost);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 })).sort((a, b) => b.value - a.value);
  }, [transactions, items]);

  // Daily waste trend (last 14 days)
  const wasteTrend = useMemo(() => {
    const days: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      days[format(subDays(new Date(), i), 'yyyy-MM-dd')] = 0;
    }
    transactions.filter(t => t.type === 'waste').forEach(t => {
      if (days[t.transaction_date] !== undefined) days[t.transaction_date] += Number(t.total_cost);
    });
    return Object.entries(days).map(([date, value]) => ({ date: format(new Date(date), 'MMM dd'), value: Math.round(value * 100) / 100 }));
  }, [transactions]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Inventory Management</h1>
            <p className="text-sm text-muted-foreground">Track stock levels, COGS, and waste</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={txDialogOpen} onOpenChange={setTxDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" onClick={() => resetTxForm()}>
                  <BarChart3 className="h-4 w-4 mr-2" /> Record Transaction
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record Transaction</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addTransaction.mutate(txForm); }} className="space-y-4">
                  <div>
                    <Label>Item</Label>
                    <Select value={txForm.item_id} onValueChange={v => setTxForm(f => ({ ...f, item_id: v }))}>
                      <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        {items.filter(i => i.is_active).map(i => (
                          <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Type</Label>
                      <Select value={txForm.type} onValueChange={v => setTxForm(f => ({ ...f, type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {TRANSACTION_TYPES.map(t => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Date</Label>
                      <Input type="date" value={txForm.transaction_date} onChange={e => setTxForm(f => ({ ...f, transaction_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Quantity</Label>
                      <Input type="number" step="0.01" min="0" value={txForm.quantity || ''} onChange={e => setTxForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Unit Cost</Label>
                      <Input type="number" step="0.01" min="0" value={txForm.unit_cost || ''} onChange={e => setTxForm(f => ({ ...f, unit_cost: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Textarea value={txForm.notes} onChange={e => setTxForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." />
                  </div>
                  <Button type="submit" className="w-full" disabled={!txForm.item_id || txForm.quantity <= 0 || addTransaction.isPending}>
                    {addTransaction.isPending ? 'Recording...' : 'Record Transaction'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            <Dialog open={itemDialogOpen} onOpenChange={(o) => { setItemDialogOpen(o); if (!o) { setEditItem(null); resetItemForm(); } }}>
              <DialogTrigger asChild>
                <Button onClick={() => { setEditItem(null); resetItemForm(); }}>
                  <Plus className="h-4 w-4 mr-2" /> Add Item
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editItem ? 'Edit Item' : 'Add Inventory Item'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); upsertItem.mutate(itemForm); }} className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input value={itemForm.name} onChange={e => setItemForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Chicken Breast" required />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <Label>Category</Label>
                      <Select value={itemForm.category} onValueChange={v => setItemForm(f => ({ ...f, category: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Unit</Label>
                      <Select value={itemForm.unit} onValueChange={v => setItemForm(f => ({ ...f, unit: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <Label>Current Stock</Label>
                      <Input type="number" step="0.01" min="0" value={itemForm.current_stock || ''} onChange={e => setItemForm(f => ({ ...f, current_stock: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Min Stock</Label>
                      <Input type="number" step="0.01" min="0" value={itemForm.min_stock || ''} onChange={e => setItemForm(f => ({ ...f, min_stock: Number(e.target.value) }))} />
                    </div>
                    <div>
                      <Label>Cost/Unit</Label>
                      <Input type="number" step="0.01" min="0" value={itemForm.cost_per_unit || ''} onChange={e => setItemForm(f => ({ ...f, cost_per_unit: Number(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={itemForm.is_active} onCheckedChange={v => setItemForm(f => ({ ...f, is_active: v }))} />
                    <Label>Active</Label>
                  </div>
                  <Button type="submit" className="w-full" disabled={!itemForm.name || upsertItem.isPending}>
                    {upsertItem.isPending ? 'Saving...' : editItem ? 'Update Item' : 'Add Item'}
                  </Button>
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
                  <p className="text-sm text-muted-foreground">Total Stock Value</p>
                  <p className="text-2xl font-bold text-foreground">{fc(totalStockValue)}</p>
                  <p className="text-xs text-muted-foreground">{items.filter(i => i.is_active).length} active items</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">COGS (This Month)</p>
                  <p className="text-2xl font-bold text-foreground">{fc(cogsSold)}</p>
                  <p className="text-xs text-muted-foreground">From usage transactions</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <ArrowUpRight className="h-5 w-5 text-blue-500" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Waste (This Month)</p>
                  <p className="text-2xl font-bold text-destructive">{fc(wasteTotal)}</p>
                  <p className="text-xs text-muted-foreground">{purchaseTotal > 0 ? `${((wasteTotal / purchaseTotal) * 100).toFixed(1)}% of purchases` : 'No purchases'}</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Trash2 className="h-5 w-5 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Low Stock Alerts</p>
                  <p className="text-2xl font-bold text-foreground">{lowStockItems.length}</p>
                  <p className="text-xs text-muted-foreground">Items below minimum</p>
                </div>
                <div className="h-10 w-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Card className="border-orange-500/30 bg-orange-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-orange-500" />
                <span className="font-semibold text-sm text-foreground">Low Stock Alert</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {lowStockItems.slice(0, 8).map(item => (
                  <Badge key={item.id} variant="outline" className="text-orange-600 border-orange-500/40 bg-orange-500/10">
                    {item.name}: {item.current_stock} {item.unit} (min: {item.min_stock})
                  </Badge>
                ))}
                {lowStockItems.length > 8 && <Badge variant="secondary">+{lowStockItems.length - 8} more</Badge>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="stock">Stock Levels</TabsTrigger>
            <TabsTrigger value="recipes">Menu Recipes</TabsTrigger>
            <TabsTrigger value="restock">Restock</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="cogs">COGS Analysis</TabsTrigger>
            <TabsTrigger value="waste">Waste Report</TabsTrigger>
          </TabsList>

          <TabsContent value="recipes">
            <MenuRecipesTab restaurantId={restaurantId} items={items} />
          </TabsContent>

          <TabsContent value="restock">
            <RestockTab restaurantId={restaurantId} items={items} />
          </TabsContent>

          <TabsContent value="analytics">
            <InventoryAnalyticsTab restaurantId={restaurantId} items={items} />
          </TabsContent>




          {/* Stock Levels Tab */}
          <TabsContent value="stock">
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <CardTitle className="text-lg">Inventory Items</CardTitle>
                  <FilterBar className="w-full sm:w-auto">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 w-full sm:w-48" />
                    </div>
                    <Select value={catFilter} onValueChange={setCatFilter}>
                      <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </FilterBar>
                </div>
              </CardHeader>
              <CardContent>
                <Table stickyHeader>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Stock</TableHead>
                      <TableHead className="text-right">Min Stock</TableHead>
                      <TableHead className="text-right">Cost/Unit</TableHead>
                      <TableHead className="text-right">Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingItems ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : filteredItems.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No items found</TableCell></TableRow>
                    ) : itemsPager.pageItems.map(item => {

                      const stockPct = item.min_stock > 0 ? (item.current_stock / item.min_stock) * 100 : 100;
                      const isLow = item.current_stock <= item.min_stock;
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell><Badge variant="secondary" className="text-xs">{item.category}</Badge></TableCell>
                          <TableCell className="text-right">{item.current_stock} {item.unit}</TableCell>
                          <TableCell className="text-right">{item.min_stock} {item.unit}</TableCell>
                          <TableCell className="text-right">{fc(item.cost_per_unit)}</TableCell>
                          <TableCell className="text-right font-medium">{fc(item.current_stock * item.cost_per_unit)}</TableCell>
                          <TableCell>
                            {!item.is_active ? (
                              <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                            ) : isLow ? (
                              <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-500/40 bg-green-500/10 text-xs">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => openEditItem(item)}>Edit</Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <DataPagination
                  page={itemsPager.page}
                  pageCount={itemsPager.pageCount}
                  pageSize={itemsPager.pageSize}
                  total={itemsPager.total}
                  from={itemsPager.from}
                  to={itemsPager.to}
                  onPageChange={itemsPager.setPage}
                  onPageSizeChange={itemsPager.setPageSize}
                />

              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Transactions</CardTitle>
                <CardDescription>Last 500 inventory movements</CardDescription>
              </CardHeader>
              <CardContent>
                <Table stickyHeader>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Unit Cost</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingTx ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                    ) : transactions.length === 0 ? (
                      <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No transactions yet</TableCell></TableRow>
                    ) : txPager.pageItems.map(tx => {
                      const txType = TRANSACTION_TYPES.find(t => t.value === tx.type);
                      const itemData = tx.inventory_items as any;
                      return (
                        <TableRow key={tx.id}>
                          <TableCell>{format(new Date(tx.transaction_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell className="font-medium">{itemData?.name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-xs ${txType?.color || ''}`}>{txType?.label || tx.type}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{tx.quantity} {itemData?.unit || ''}</TableCell>
                          <TableCell className="text-right">{fc(tx.unit_cost)}</TableCell>
                          <TableCell className="text-right font-medium">{fc(tx.total_cost)}</TableCell>
                          <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">{tx.notes || '—'}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                <DataPagination
                  page={txPager.page}
                  pageCount={txPager.pageCount}
                  pageSize={txPager.pageSize}
                  total={txPager.total}
                  from={txPager.from}
                  to={txPager.to}
                  onPageChange={txPager.setPage}
                  onPageSizeChange={txPager.setPageSize}
                />

              </CardContent>
            </Card>
          </TabsContent>

          {/* COGS Tab */}
          <TabsContent value="cogs">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Stock Value by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">Add inventory items to see breakdown</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`} labelLine={false}>
                          {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip formatter={(v: number) => fc(v)} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">COGS Summary</CardTitle>
                  <CardDescription>Cost of Goods Sold this month</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Total Purchases</span>
                      <span className="font-semibold text-foreground">{fc(purchaseTotal)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Usage (COGS)</span>
                      <span className="font-semibold text-foreground">{fc(cogsSold)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">Waste Loss</span>
                      <span className="font-semibold text-destructive">{fc(wasteTotal)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-foreground">Total COGS</span>
                      <span className="font-bold text-lg text-foreground">{fc(cogsSold + wasteTotal)}</span>
                    </div>
                  </div>
                  {purchaseTotal > 0 && (
                    <div className="mt-4 p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">COGS as % of Purchases</p>
                      <Progress value={Math.min(((cogsSold + wasteTotal) / purchaseTotal) * 100, 100)} className="h-2" />
                      <p className="text-xs text-muted-foreground mt-1">{(((cogsSold + wasteTotal) / purchaseTotal) * 100).toFixed(1)}%</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Waste Tab */}
          <TabsContent value="waste">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Waste Trend (14 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={wasteTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="date" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                      <Tooltip formatter={(v: number) => fc(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8 }} />
                      <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name="Waste Cost" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Waste by Category (30 Days)</CardTitle>
                </CardHeader>
                <CardContent>
                  {wasteByCategory.length === 0 ? (
                    <p className="text-center text-muted-foreground py-12">No waste recorded in last 30 days</p>
                  ) : (
                    <div className="space-y-3">
                      {wasteByCategory.map((cat, i) => {
                        const maxVal = wasteByCategory[0]?.value || 1;
                        return (
                          <div key={cat.name} className="space-y-1">
                            <div className="flex justify-between text-sm">
                              <span className="text-foreground">{cat.name}</span>
                              <span className="font-medium text-destructive">{fc(cat.value)}</span>
                            </div>
                            <Progress value={(cat.value / maxVal) * 100} className="h-2" />
                          </div>
                        );
                      })}
                      <Separator className="my-2" />
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-foreground">Total Waste</span>
                        <span className="text-destructive">{fc(wasteByCategory.reduce((s, c) => s + c.value, 0))}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
