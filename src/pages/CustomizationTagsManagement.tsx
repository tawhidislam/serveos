import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useCustomizationTags, groupTagsByCategory, type CustomizationTag } from '@/hooks/useCustomizationTags';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tags } from 'lucide-react';

const COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#a855f7', '#ec4899', '#16a34a'];
const EMOJIS = ['🌶️', '🫑', '❄️', '🌾', '🥛', '🌱', '🥬', '🥜', '🧀', '🔥', '🧅', '🧄', '🏷️', '⚡', '💧', '🍯'];

const defaultForm = { name: '', category: 'General', emoji: '🏷️', color: '#6366f1', sort_order: 0 };

export default function CustomizationTagsManagement() {
  const { data: tags = [], isLoading } = useCustomizationTags();
  const queryClient = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const grouped = groupTagsByCategory(tags);

  const openCreate = () => { setEditingId(null); setForm(defaultForm); setDialogOpen(true); };

  const openEdit = (t: CustomizationTag) => {
    setEditingId(t.id);
    setForm({ name: t.name, category: t.category, emoji: t.emoji || '🏷️', color: t.color || '#6366f1', sort_order: t.sort_order });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        category: form.category.trim() || 'General',
        emoji: form.emoji,
        color: form.color,
        sort_order: form.sort_order,
      };
      if (editingId) {
        const { error } = await supabase.from('customization_tags' as any).update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Tag updated');
      } else {
        if (!restaurantId) throw new Error('No restaurant context');
        const { error } = await supabase.from('customization_tags' as any).insert({ ...payload, restaurant_id: restaurantId });
        if (error) throw error;
        toast.success('Tag created');
      }
      queryClient.invalidateQueries({ queryKey: ['customization_tags'] });
      queryClient.invalidateQueries({ queryKey: ['customization_tags_active'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this tag?')) return;
    const { error } = await supabase.from('customization_tags' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else { toast.success('Deleted'); queryClient.invalidateQueries({ queryKey: ['customization_tags'] }); }
  };

  const toggleActive = async (t: CustomizationTag) => {
    await supabase.from('customization_tags' as any).update({ is_active: !t.is_active }).eq('id', t.id);
    queryClient.invalidateQueries({ queryKey: ['customization_tags'] });
  };

  return (
    <AdminLayout title="Customization Tags">
      <div className="flex items-center justify-between mb-6">
        <p className="text-muted-foreground text-sm">Manage dietary and preparation preferences customers can add to items</p>
        <Button onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Tag</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : tags.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Tags className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No tags yet. Create your first customization tag!</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, catTags]) => (
            <div key={category}>
              <h3 className="text-sm font-semibold text-card-foreground mb-3">{category}</h3>
              <div className="grid gap-2">
                {catTags.map(t => (
                  <Card key={t.id} className={`${!t.is_active ? 'opacity-50' : ''}`}>
                    <CardContent className="p-3 flex items-center gap-3">
                      <span className="text-lg">{t.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-card-foreground text-sm">{t.name}</span>
                          <div className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
                        </div>
                      </div>
                      <Switch checked={t.is_active} onCheckedChange={() => toggleActive(t)} />
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(t)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(t.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? 'Edit Tag' : 'New Tag'}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Extra Spicy" />
            </div>
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Dietary" />
            </div>
            <div>
              <Label className="mb-2 block">Emoji</Label>
              <div className="flex flex-wrap gap-1.5">
                {EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setForm(f => ({ ...f, emoji: e }))}
                    className={`h-9 w-9 rounded-lg text-lg flex items-center justify-center transition-all ${form.emoji === e ? 'bg-primary/10 ring-2 ring-primary' : 'bg-secondary hover:bg-secondary/80'}`}
                  >{e}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="mb-2 block">Color</Label>
              <div className="flex gap-2">
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={`h-8 w-8 rounded-full transition-all ${form.color === c ? 'ring-2 ring-offset-2 ring-foreground' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div>
              <Label>Sort Order</Label>
              <Input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editingId ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
