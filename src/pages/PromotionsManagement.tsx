import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { usePromotions, type Promotion } from '@/hooks/usePromotions';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Tag, Percent, DollarSign, Clock, UserPlus, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PromotionAnalytics from '@/components/promotions/PromotionAnalytics';

const typeConfig: Record<string, { label: string; icon: any; color: string }> = {
  percentage: { label: 'Percentage', icon: Percent, color: 'bg-primary/10 text-primary' },
  fixed: { label: 'Fixed Amount', icon: DollarSign, color: 'bg-success/10 text-success' },
  happy_hour: { label: 'Happy Hour', icon: Clock, color: 'bg-warning/10 text-warning' },
  first_order: { label: 'First Order', icon: UserPlus, color: 'bg-accent/10 text-accent-foreground' },
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const defaultForm = {
  name: '', description: '', type: 'percentage', discount_value: 10,
  promo_code: '', min_order_amount: 0, max_discount_amount: '',
  max_uses: '', max_uses_per_user: 1, is_first_order_only: false,
  is_active: true, starts_at: new Date().toISOString().slice(0, 16),
  ends_at: '', happy_hour_start: '16:00', happy_hour_end: '19:00',
  happy_hour_days: [1, 2, 3, 4, 5] as number[],
};

export default function PromotionsManagement() {
  const { data: promotions = [], isLoading } = usePromotions();
  const [activeTab, setActiveTab] = useState('manage');
  const queryClient = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (p: Promotion) => {
    setEditingId(p.id);
    setForm({
      name: p.name, description: p.description || '', type: p.type,
      discount_value: p.discount_value, promo_code: p.promo_code || '',
      min_order_amount: p.min_order_amount || 0,
      max_discount_amount: p.max_discount_amount?.toString() || '',
      max_uses: p.max_uses?.toString() || '',
      max_uses_per_user: p.max_uses_per_user || 1,
      is_first_order_only: p.is_first_order_only,
      is_active: p.is_active,
      starts_at: p.starts_at.slice(0, 16),
      ends_at: p.ends_at?.slice(0, 16) || '',
      happy_hour_start: p.happy_hour_start?.slice(0, 5) || '16:00',
      happy_hour_end: p.happy_hour_end?.slice(0, 5) || '19:00',
      happy_hour_days: p.happy_hour_days || [1, 2, 3, 4, 5],
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required');
    setSaving(true);
    try {
      const payload: any = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        type: form.type,
        discount_value: form.discount_value,
        promo_code: form.promo_code.trim() || null,
        min_order_amount: form.min_order_amount || 0,
        max_discount_amount: form.max_discount_amount ? Number(form.max_discount_amount) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        max_uses_per_user: form.max_uses_per_user || 1,
        is_first_order_only: form.type === 'first_order' ? true : form.is_first_order_only,
        is_active: form.is_active,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
        happy_hour_start: form.type === 'happy_hour' ? form.happy_hour_start : null,
        happy_hour_end: form.type === 'happy_hour' ? form.happy_hour_end : null,
        happy_hour_days: form.type === 'happy_hour' ? form.happy_hour_days : null,
      };

      if (editingId) {
        const { error } = await supabase.from('promotions' as any).update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Promotion updated');
      } else {
        if (!restaurantId) throw new Error('No restaurant context');
        const { error } = await supabase.from('promotions' as any).insert({ ...payload, restaurant_id: restaurantId });
        if (error) throw error;
        toast.success('Promotion created');
      }
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
      queryClient.invalidateQueries({ queryKey: ['promotions_active'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this promotion?')) return;
    const { error } = await supabase.from('promotions' as any).delete().eq('id', id);
    if (error) toast.error(error.message);
    else {
      toast.success('Deleted');
      queryClient.invalidateQueries({ queryKey: ['promotions'] });
    }
  };

  const toggleActive = async (p: Promotion) => {
    await supabase.from('promotions' as any).update({ is_active: !p.is_active }).eq('id', p.id);
    queryClient.invalidateQueries({ queryKey: ['promotions'] });
  };

  const toggleDay = (day: number) => {
    setForm(f => ({
      ...f,
      happy_hour_days: f.happy_hour_days.includes(day)
        ? f.happy_hour_days.filter(d => d !== day)
        : [...f.happy_hour_days, day].sort(),
    }));
  };

  return (
    <AdminLayout title="Promotions & Offers">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="manage" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> Manage</TabsTrigger>
            <TabsTrigger value="analytics" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Analytics</TabsTrigger>
          </TabsList>
          {activeTab === 'manage' && (
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> New Promotion
            </Button>
          )}
        </div>

        <TabsContent value="analytics">
          <PromotionAnalytics />
        </TabsContent>

        <TabsContent value="manage">

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Tag className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">No promotions yet. Create your first offer!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {promotions.map(p => {
            const cfg = typeConfig[p.type] || typeConfig.percentage;
            const Icon = cfg.icon;
            const isExpired = p.ends_at && new Date(p.ends_at) < new Date();
            return (
              <Card key={p.id} className={`${!p.is_active || isExpired ? 'opacity-60' : ''}`}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${cfg.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-card-foreground text-sm">{p.name}</h3>
                      <Badge variant="secondary" className="text-[10px]">{cfg.label}</Badge>
                      {p.promo_code && <Badge variant="outline" className="text-[10px] font-mono">{p.promo_code}</Badge>}
                      {!p.promo_code && <Badge variant="outline" className="text-[10px] text-success">Auto-apply</Badge>}
                      {isExpired && <Badge variant="destructive" className="text-[10px]">Expired</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.type === 'fixed' ? `$${p.discount_value} off` : `${p.discount_value}% off`}
                      {p.min_order_amount > 0 && ` · Min order $${p.min_order_amount}`}
                      {p.max_uses && ` · ${p.used_count}/${p.max_uses} used`}
                    </p>
                  </div>
                  <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p)} />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)} className="text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Promotion' : 'New Promotion'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Summer Sale" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Get 20% off all orders" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage Off</SelectItem>
                    <SelectItem value="fixed">Fixed Amount Off</SelectItem>
                    <SelectItem value="happy_hour">Happy Hour</SelectItem>
                    <SelectItem value="first_order">First Order</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Discount Value {form.type === 'fixed' ? '($)' : '(%)'}</Label>
                <Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: Number(e.target.value) }))} />
              </div>
            </div>
            <div>
              <Label>Promo Code (leave empty for auto-apply)</Label>
              <Input value={form.promo_code} onChange={e => setForm(f => ({ ...f, promo_code: e.target.value.toUpperCase() }))} placeholder="SUMMER20" className="font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Min Order Amount</Label>
                <Input type="number" value={form.min_order_amount} onChange={e => setForm(f => ({ ...f, min_order_amount: Number(e.target.value) }))} />
              </div>
              <div>
                <Label>Max Discount Cap</Label>
                <Input type="number" value={form.max_discount_amount} onChange={e => setForm(f => ({ ...f, max_discount_amount: e.target.value }))} placeholder="No limit" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Max Total Uses</Label>
                <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} placeholder="Unlimited" />
              </div>
              <div>
                <Label>Max Per User</Label>
                <Input type="number" value={form.max_uses_per_user} onChange={e => setForm(f => ({ ...f, max_uses_per_user: Number(e.target.value) }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div>
                <Label>Ends At (optional)</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>

            {form.type === 'happy_hour' && (
              <div className="space-y-3 bg-secondary/50 rounded-xl p-3">
                <p className="text-sm font-medium text-card-foreground">Happy Hour Schedule</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Start Time</Label>
                    <Input type="time" value={form.happy_hour_start} onChange={e => setForm(f => ({ ...f, happy_hour_start: e.target.value }))} />
                  </div>
                  <div>
                    <Label className="text-xs">End Time</Label>
                    <Input type="time" value={form.happy_hour_end} onChange={e => setForm(f => ({ ...f, happy_hour_end: e.target.value }))} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs mb-1 block">Active Days</Label>
                  <div className="flex gap-1.5">
                    {DAYS.map((d, i) => (
                      <button key={d} type="button" onClick={() => toggleDay(i)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                          form.happy_hour_days.includes(i)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                        }`}
                      >{d}</button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
