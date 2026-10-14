import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, ChefHat, Search } from 'lucide-react';

interface Props {
  restaurantId?: string;
  items: any[]; // inventory items
}

export default function MenuRecipesTab({ restaurantId, items }: Props) {
  const qc = useQueryClient();
  const { format: fc } = useCurrency();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMenuItem, setActiveMenuItem] = useState<any>(null);
  const [form, setForm] = useState({ inventory_item_id: '', quantity_per_unit: 0 });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['recipe-menu-items', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('id, name, price, is_available')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: recipes = [] } = useQuery({
    queryKey: ['menu-item-ingredients', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_ingredients')
        .select('*')
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      return data;
    },
  });

  const invById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);
  const byMenuItem = useMemo(() => {
    const map: Record<string, any[]> = {};
    recipes.forEach((r: any) => {
      (map[r.menu_item_id] ||= []).push(r);
    });
    return map;
  }, [recipes]);

  const filtered = useMemo(
    () => menuItems.filter((m: any) => m.name.toLowerCase().includes(search.toLowerCase())),
    [menuItems, search],
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!activeMenuItem || !form.inventory_item_id || form.quantity_per_unit <= 0) {
        throw new Error('Select an ingredient and a quantity greater than zero');
      }
      const { error } = await supabase.from('menu_item_ingredients').upsert(
        {
          restaurant_id: restaurantId!,
          menu_item_id: activeMenuItem.id,
          inventory_item_id: form.inventory_item_id,
          quantity_per_unit: form.quantity_per_unit,
        },
        { onConflict: 'menu_item_id,inventory_item_id' },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-item-ingredients'] });
      setForm({ inventory_item_id: '', quantity_per_unit: 0 });
      toast.success('Ingredient saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_ingredients').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-item-ingredients'] });
      toast.success('Ingredient removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const recipeCost = (menuItemId: string) =>
    (byMenuItem[menuItemId] || []).reduce(
      (s, r) => s + Number(r.quantity_per_unit) * Number(invById[r.inventory_item_id]?.cost_per_unit ?? 0),
      0,
    );

  const openDialog = (mi: any) => {
    setActiveMenuItem(mi);
    setForm({ inventory_item_id: '', quantity_per_unit: 0 });
    setDialogOpen(true);
  };

  const activeRecipe = activeMenuItem ? byMenuItem[activeMenuItem.id] || [] : [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ChefHat className="h-5 w-5" /> Menu Recipes
            </CardTitle>
            <CardDescription>
              Link ingredients to menu items — stock is deducted automatically when orders are placed.
            </CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search menu items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Menu Item</TableHead>
                <TableHead>Ingredients</TableHead>
                <TableHead className="text-right">Ingredient Cost</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((mi: any) => {
                const list = byMenuItem[mi.id] || [];
                return (
                  <TableRow key={mi.id}>
                    <TableCell className="font-medium">{mi.name}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {list.length === 0 && <span className="text-xs text-muted-foreground">No ingredients linked</span>}
                        {list.map((r: any) => (
                          <Badge key={r.id} variant="secondary" className="text-xs">
                            {invById[r.inventory_item_id]?.name ?? 'Item'} · {r.quantity_per_unit}{' '}
                            {invById[r.inventory_item_id]?.unit ?? ''}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fc(recipeCost(mi.id))}</TableCell>
                    <TableCell className="text-right">{fc(Number(mi.price))}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => openDialog(mi)}>
                        <Plus className="h-4 w-4 mr-1" /> Manage
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No menu items found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recipe · {activeMenuItem?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {activeRecipe.length === 0 && (
                <p className="text-sm text-muted-foreground">No ingredients linked yet.</p>
              )}
              {activeRecipe.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">
                    {invById[r.inventory_item_id]?.name ?? 'Item'} — {r.quantity_per_unit}{' '}
                    {invById[r.inventory_item_id]?.unit ?? ''} per serving
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Remove ingredient"
                    onClick={() => removeMutation.mutate(r.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Ingredient</Label>
                <Select
                  value={form.inventory_item_id}
                  onValueChange={v => setForm(f => ({ ...f, inventory_item_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ingredient" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map(i => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} ({i.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Quantity per serving</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.quantity_per_unit}
                  onChange={e => setForm(f => ({ ...f, quantity_per_unit: Number(e.target.value) }))}
                />
              </div>
            </div>
            <Button className="w-full" onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? 'Saving...' : 'Add / Update Ingredient'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
