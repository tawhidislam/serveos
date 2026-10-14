import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Plus, Minus, Trash2, Search, Loader2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderItem {
  id: string;
  menu_item_id: string;
  quantity: number;
  notes: string | null;
  status: string;
  menu_items: { name: string; price?: number } | null;
}

interface ModifyOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  order: {
    id: string;
    order_items: OrderItem[];
    restaurant_tables?: { label: string } | null;
    total_amount: number;
    tax_rate: number;
    discount_amount: number;
  } | null;
}

interface ModifiedItem {
  id?: string; // existing item id, undefined for new items
  menu_item_id: string;
  name: string;
  price: number;
  quantity: number;
  notes: string | null;
  isNew?: boolean;
  isRemoved?: boolean;
}

export default function ModifyOrderDialog({ open, onOpenChange, order }: ModifyOrderDialogProps) {
  const { format: fmt } = useCurrency();
  const queryClient = useQueryClient();
  const { data: currentRestaurant } = useCurrentRestaurant();
  const restaurantId = currentRestaurant?.id ?? null;
  const [items, setItems] = useState<ModifiedItem[]>([]);
  const [search, setSearch] = useState('');
  const [showMenu, setShowMenu] = useState(false);

  // Initialize items when dialog opens
  const initItems = () => {
    if (!order) return;
    setItems(
      order.order_items.map(oi => ({
        id: oi.id,
        menu_item_id: oi.menu_item_id,
        name: oi.menu_items?.name ?? 'Item',
        price: (oi.menu_items as any)?.price ?? 0,
        quantity: oi.quantity,
        notes: oi.notes,
        isNew: false,
        isRemoved: false,
      }))
    );
    setSearch('');
    setShowMenu(false);
  };

  // Fetch menu items for adding new items
  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu_items_for_modify', restaurantId],
    queryFn: async () => {
      let q = supabase
        .from('menu_items')
        .select('id, name, price, category_id, is_available, categories(name)')
        .eq('is_available', true)
        .order('name');
      if (restaurantId) q = q.eq('restaurant_id', restaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return data as any[];
    },
    enabled: open && !!restaurantId,
  });

  const filteredMenuItems = useMemo(() => {
    if (!search.trim()) return menuItems;
    const q = search.toLowerCase();
    return menuItems.filter((mi: any) =>
      mi.name.toLowerCase().includes(q) || mi.categories?.name?.toLowerCase().includes(q)
    );
  }, [menuItems, search]);

  const activeItems = items.filter(i => !i.isRemoved);
  const newSubtotal = activeItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const taxRate = order?.tax_rate ?? 0;
  const taxAmount = newSubtotal * (taxRate / 100);
  const discount = order?.discount_amount ?? 0;
  const newTotal = newSubtotal + taxAmount - discount;

  const hasChanges = useMemo(() => {
    if (!order) return false;
    const original = order.order_items;
    if (items.some(i => i.isNew && !i.isRemoved)) return true;
    if (items.some(i => i.isRemoved && !i.isNew)) return true;
    for (const item of items) {
      if (item.isNew || item.isRemoved) continue;
      const orig = original.find(o => o.id === item.id);
      if (orig && orig.quantity !== item.quantity) return true;
    }
    return false;
  }, [items, order]);

  const updateQty = (idx: number, delta: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      const newQty = Math.max(1, item.quantity + delta);
      return { ...item, quantity: newQty };
    }));
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.map((item, i) => {
      if (i !== idx) return item;
      if (item.isNew) return { ...item, isRemoved: true };
      return { ...item, isRemoved: true };
    }));
  };

  const restoreItem = (idx: number) => {
    setItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, isRemoved: false } : item
    ));
  };

  const addMenuItem = (mi: any) => {
    // Check if already in list (not removed)
    const existingIdx = items.findIndex(i => i.menu_item_id === mi.id && !i.isRemoved);
    if (existingIdx >= 0) {
      updateQty(existingIdx, 1);
    } else {
      setItems(prev => [...prev, {
        menu_item_id: mi.id,
        name: mi.name,
        price: mi.price,
        quantity: 1,
        notes: null,
        isNew: true,
        isRemoved: false,
      }]);
    }
    setShowMenu(false);
    setSearch('');
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!order) return;

      // 1. Delete removed existing items
      const removedIds = items.filter(i => i.isRemoved && !i.isNew && i.id).map(i => i.id!);
      if (removedIds.length > 0) {
        // We can't delete order_items per RLS, so set quantity to 0 and status to 'cancelled'
        for (const id of removedIds) {
          const { error } = await supabase.from('order_items').update({ quantity: 0, status: 'cancelled' }).eq('id', id);
          if (error) throw error;
        }
      }

      // 2. Update existing items with changed quantities
      for (const item of items) {
        if (item.isRemoved || item.isNew || !item.id) continue;
        const orig = order.order_items.find(o => o.id === item.id);
        if (orig && orig.quantity !== item.quantity) {
          const { error } = await supabase.from('order_items').update({ quantity: item.quantity }).eq('id', item.id);
          if (error) throw error;
        }
      }

      // 3. Insert new items
      const newItems = items.filter(i => i.isNew && !i.isRemoved);
      if (newItems.length > 0) {
        const { error } = await supabase.from('order_items').insert(
          newItems.map(i => ({
            order_id: order.id,
            menu_item_id: i.menu_item_id,
            quantity: i.quantity,
            notes: i.notes,
            status: 'pending',
          }))
        );
        if (error) throw error;
      }

      // 4. Update order total
      const { error } = await supabase.from('orders').update({ total_amount: newTotal }).eq('id', order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waiter_orders'] });
      queryClient.invalidateQueries({ queryKey: ['waiter_served_orders'] });
      toast.success('Order modified successfully');
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast.error('Failed to modify order: ' + err.message);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md max-h-[90dvh] flex flex-col p-0"
        onOpenAutoFocus={() => initItems()}
      >
        <DialogHeader className="px-5 pt-5 pb-2">
          <DialogTitle className="text-base">
            Modify Order — {order?.restaurant_tables?.label ?? 'Takeaway'}
          </DialogTitle>
          <DialogDescription className="text-xs">
            Adjust quantities, remove or add items
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-5">
          <div className="space-y-1.5 pb-2">
            <AnimatePresence>
              {items.map((item, idx) => (
                <motion.div
                  key={item.id ?? `new-${idx}`}
                  layout
                  initial={item.isNew ? { opacity: 0, y: -10 } : false}
                  animate={{ opacity: item.isRemoved ? 0.4 : 1, y: 0 }}
                  className={`flex items-center gap-2 py-2 px-2 rounded-lg ${
                    item.isRemoved ? 'bg-destructive/5 line-through' : item.isNew ? 'bg-success/5' : 'bg-secondary/40'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {item.name}
                      {item.isNew && <span className="text-[10px] ml-1.5 text-success font-bold uppercase">New</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{fmt(item.price)} each</p>
                  </div>

                  {!item.isRemoved ? (
                    <>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQty(idx, -1)}
                          disabled={item.quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-6 text-center text-sm font-bold tabular-nums">{item.quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => updateQty(idx, 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[11px] text-primary"
                      onClick={() => restoreItem(idx)}
                    >
                      Undo
                    </Button>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Add item section */}
          {!showMenu ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs mb-3"
              onClick={() => setShowMenu(true)}
            >
              <Plus className="h-3 w-3 mr-1" />
              Add Item
            </Button>
          ) : (
            <div className="mb-3 border rounded-lg overflow-hidden">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search menu..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="h-8 text-xs pl-8 rounded-none border-0 border-b focus-visible:ring-0"
                  autoFocus
                />
              </div>
              <div className="max-h-40 overflow-y-auto">
                {filteredMenuItems.length > 0 ? (
                  filteredMenuItems.map((mi: any) => (
                    <button
                      key={mi.id}
                      onClick={() => addMenuItem(mi)}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/60 transition-colors"
                    >
                      <div className="text-left">
                        <p className="font-medium text-card-foreground">{mi.name}</p>
                        <p className="text-[10px] text-muted-foreground">{mi.categories?.name}</p>
                      </div>
                      <span className="font-semibold text-card-foreground">{fmt(mi.price)}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-[11px] text-muted-foreground text-center py-4">No items found</p>
                )}
              </div>
              <button
                onClick={() => { setShowMenu(false); setSearch(''); }}
                className="w-full py-1.5 text-[11px] text-muted-foreground hover:text-foreground border-t transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </ScrollArea>

        {/* Totals */}
        <div className="px-5 py-3 border-t bg-secondary/30 space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal</span>
            <span>{fmt(newSubtotal)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Tax ({taxRate}%)</span>
              <span>{fmt(taxAmount)}</span>
            </div>
          )}
          {discount > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Discount</span>
              <span>-{fmt(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-card-foreground pt-1">
            <span>New Total</span>
            <span>{fmt(newTotal)}</span>
          </div>
        </div>

        <DialogFooter className="px-5 pb-5 pt-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={!hasChanges || saveMutation.isPending || activeItems.length === 0}
          >
            {saveMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
