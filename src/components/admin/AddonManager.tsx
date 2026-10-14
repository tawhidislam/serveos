import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, GripVertical, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface AddonGroup {
  id: string;
  menu_item_id: string;
  name: string;
  type: 'single' | 'multi';
  required: boolean;
  sort_order: number;
  options?: AddonOption[];
}

interface AddonOption {
  id: string;
  addon_id: string;
  name: string;
  price_modifier: number;
  sort_order: number;
}

interface Props {
  menuItemId: string;
}

export default function AddonManager({ menuItemId }: Props) {
  const qc = useQueryClient();
  const { format: fmt } = useCurrency();
  const [newGroupName, setNewGroupName] = useState('');
  const [newOptionName, setNewOptionName] = useState<Record<string, string>>({});
  const [newOptionPrice, setNewOptionPrice] = useState<Record<string, string>>({});

  // The parent menu_item carries the tenant id. We must include it on every
  // child insert because the menu_item_addons / menu_item_addon_options RLS
  // policies require restaurant_id = current_restaurant_id().
  const { data: parentItem } = useQuery({
    queryKey: ['menu_item_restaurant', menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .eq('id', menuItemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const restaurantId = (parentItem as any)?.restaurant_id ?? null;

  const { data: addonGroups = [], isLoading } = useQuery({
    queryKey: ['item_addons', menuItemId],
    queryFn: async () => {
      const { data: groups, error: gErr } = await supabase
        .from('menu_item_addons')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .order('sort_order');
      if (gErr) throw gErr;

      const groupIds = (groups ?? []).map(g => g.id);
      let options: any[] = [];
      if (groupIds.length > 0) {
        const { data: opts, error: oErr } = await supabase
          .from('menu_item_addon_options')
          .select('*')
          .in('addon_id', groupIds)
          .order('sort_order');
        if (oErr) throw oErr;
        options = opts ?? [];
      }

      return (groups ?? []).map(g => ({
        ...g,
        type: g.type as 'single' | 'multi',
        options: options.filter(o => o.addon_id === g.id),
      })) as AddonGroup[];
    },
    enabled: !!menuItemId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['item_addons', menuItemId] });

  const addGroup = useMutation({
    mutationFn: async () => {
      if (!newGroupName.trim()) return;
      if (!restaurantId) throw new Error('Cannot resolve restaurant for this item');
      const { error } = await supabase.from('menu_item_addons').insert({
        menu_item_id: menuItemId,
        name: newGroupName.trim(),
        sort_order: addonGroups.length,
        restaurant_id: restaurantId,
      });
      if (error) throw error;
    },
    onSuccess: () => { setNewGroupName(''); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateGroup = useMutation({
    mutationFn: async (params: { id: string; updates: Partial<AddonGroup> }) => {
      const { options, ...dbUpdates } = params.updates as any;
      const { error } = await supabase.from('menu_item_addons')
        .update(dbUpdates)
        .eq('id', params.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const deleteGroup = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_addons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Group deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const addOption = useMutation({
    mutationFn: async (addonId: string) => {
      const name = newOptionName[addonId]?.trim();
      if (!name) return;
      if (!restaurantId) throw new Error('Cannot resolve restaurant for this item');
      const price = parseFloat(newOptionPrice[addonId] || '0') || 0;
      const group = addonGroups.find(g => g.id === addonId);
      const { error } = await supabase.from('menu_item_addon_options').insert({
        addon_id: addonId,
        name,
        price_modifier: price,
        sort_order: group?.options?.length ?? 0,
        restaurant_id: restaurantId,
      });
      if (error) throw error;
    },
    onSuccess: (_, addonId) => {
      setNewOptionName(p => ({ ...p, [addonId]: '' }));
      setNewOptionPrice(p => ({ ...p, [addonId]: '' }));
      invalidate();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteOption = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_addon_options').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-3 text-center">Loading addons…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Label className="label-ui">Variants & Addons</Label>
      </div>

      <AnimatePresence mode="popLayout">
        {addonGroups.map((group) => (
          <motion.div
            key={group.id}
            layout
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-border rounded-lg overflow-hidden"
          >
            {/* Group header */}
            <div className="bg-secondary/40 px-3 py-2.5 flex items-center gap-2">
              <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
              <Input
                value={group.name}
                onChange={(e) => updateGroup.mutate({ id: group.id, updates: { name: e.target.value } })}
                className="h-7 text-sm font-medium bg-transparent border-none shadow-none px-1 focus-visible:ring-1"
              />
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={group.type}
                  onChange={(e) => updateGroup.mutate({ id: group.id, updates: { type: e.target.value as 'single' | 'multi' } })}
                  className="text-[11px] bg-card border border-border rounded px-1.5 py-0.5 text-muted-foreground"
                >
                  <option value="single">Pick one</option>
                  <option value="multi">Pick many</option>
                </select>
                <div className="flex items-center gap-1">
                  <Switch
                    checked={group.required}
                    onCheckedChange={(checked) => updateGroup.mutate({ id: group.id, updates: { required: checked } })}
                    className="scale-75"
                  />
                  <span className="text-[10px] text-muted-foreground">Req</span>
                </div>
                <button
                  onClick={() => { if (confirm(`Delete "${group.name}" group?`)) deleteGroup.mutate(group.id); }}
                  className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Options list */}
            <div className="px-3 py-2 space-y-1.5">
              {group.options?.map((opt) => (
                <div key={opt.id} className="flex items-center gap-2 group/opt">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 shrink-0" />
                  <span className="text-sm text-card-foreground flex-1">{opt.name}</span>
                  {opt.price_modifier > 0 && (
                    <span className="text-xs text-primary font-medium tabular-nums">
                      +{fmt(opt.price_modifier)}
                    </span>
                  )}
                  <button
                    onClick={() => deleteOption.mutate(opt.id)}
                    className="p-0.5 text-muted-foreground/0 group-hover/opt:text-muted-foreground hover:!text-destructive transition-colors"
                  >
                    <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                </div>
              ))}

              {/* Add option inline */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  value={newOptionName[group.id] ?? ''}
                  onChange={(e) => setNewOptionName(p => ({ ...p, [group.id]: e.target.value }))}
                  placeholder="Option name"
                  className="h-7 text-sm flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addOption.mutate(group.id)}
                />
                <Input
                  value={newOptionPrice[group.id] ?? ''}
                  onChange={(e) => setNewOptionPrice(p => ({ ...p, [group.id]: e.target.value }))}
                  placeholder="+0.00"
                  type="number"
                  step="0.01"
                  min="0"
                  className="h-7 text-sm w-20"
                  onKeyDown={(e) => e.key === 'Enter' && addOption.mutate(group.id)}
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => addOption.mutate(group.id)}
                  disabled={!newOptionName[group.id]?.trim()}
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Add new group */}
      <div className="flex gap-2">
        <Input
          value={newGroupName}
          onChange={(e) => setNewGroupName(e.target.value)}
          placeholder="e.g. Size, Extras, Toppings"
          className="h-8 text-sm"
          onKeyDown={(e) => e.key === 'Enter' && addGroup.mutate()}
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1 shrink-0 text-xs"
          onClick={() => addGroup.mutate()}
          disabled={!newGroupName.trim()}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2} />
          Add Group
        </Button>
      </div>

      {addonGroups.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Add variant groups like Size, Extras, or Toppings
        </p>
      )}
    </div>
  );
}
