import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useLoyaltySettings, type LoyaltySettings } from '@/hooks/useLoyalty';
import { toast } from 'sonner';
import { Save, Plus, Trash2, Star, Gift, Clock } from 'lucide-react';
import { useSettings } from '@/hooks/useSettings';
import { formatPrice } from '@/lib/currency';

export default function LoyaltyManagement() {
  const { data: settings, isLoading } = useLoyaltySettings();
  const { data: restaurantSettings } = useSettings();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    is_enabled: false,
    earn_type: 'per_currency' as 'per_order' | 'per_currency',
    points_per_order: 10,
    points_per_currency: 1,
    redemption_type: 'flexible' as 'flexible' | 'tiers',
    point_value: 0.05,
    min_redeem_points: 100,
    redemption_tiers: [] as { points: number; discount: number }[],
    expiry_enabled: false,
    expiry_days: 180,
  });

  const fmt = (n: number) => formatPrice(n, restaurantSettings?.currency || 'USD');

  useEffect(() => {
    if (settings) {
      setForm({
        is_enabled: settings.is_enabled,
        earn_type: settings.earn_type,
        points_per_order: settings.points_per_order,
        points_per_currency: settings.points_per_currency,
        redemption_type: settings.redemption_type,
        point_value: settings.point_value,
        min_redeem_points: settings.min_redeem_points,
        redemption_tiers: settings.redemption_tiers || [],
        expiry_enabled: settings.expiry_enabled,
        expiry_days: settings.expiry_days,
      });
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('loyalty_settings' as any)
        .update({
          is_enabled: form.is_enabled,
          earn_type: form.earn_type,
          points_per_order: form.points_per_order,
          points_per_currency: form.points_per_currency,
          redemption_type: form.redemption_type,
          point_value: form.point_value,
          min_redeem_points: form.min_redeem_points,
          redemption_tiers: form.redemption_tiers,
          expiry_enabled: form.expiry_enabled,
          expiry_days: form.expiry_days,
          updated_at: new Date().toISOString(),
        } as any)
        .eq('id', settings!.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['loyalty_settings'] });
      toast.success('Loyalty settings saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const addTier = () => {
    setForm(f => ({
      ...f,
      redemption_tiers: [...f.redemption_tiers, { points: 100, discount: 5 }],
    }));
  };

  const removeTier = (idx: number) => {
    setForm(f => ({
      ...f,
      redemption_tiers: f.redemption_tiers.filter((_, i) => i !== idx),
    }));
  };

  const updateTier = (idx: number, field: 'points' | 'discount', value: number) => {
    setForm(f => ({
      ...f,
      redemption_tiers: f.redemption_tiers.map((t, i) => i === idx ? { ...t, [field]: value } : t),
    }));
  };

  if (isLoading) {
    return (
      <AdminLayout title="Loyalty Program">
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Loyalty Program">
      <div className="max-w-2xl space-y-6">
        {/* Enable/Disable */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-card-foreground">Enable Loyalty Program</h3>
                <p className="text-sm text-muted-foreground">Customers earn points on orders and redeem for discounts</p>
              </div>
              <Switch checked={form.is_enabled} onCheckedChange={(v) => setForm(f => ({ ...f, is_enabled: v }))} />
            </div>
          </CardContent>
        </Card>

        {/* Earning Rules */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-primary" /> Earning Rules
            </CardTitle>
            <CardDescription>How customers earn loyalty points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Earning Method</Label>
              <Select value={form.earn_type} onValueChange={(v) => setForm(f => ({ ...f, earn_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="per_order">Fixed points per order</SelectItem>
                  <SelectItem value="per_currency">Points per currency spent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.earn_type === 'per_order' ? (
              <div>
                <Label>Points per order</Label>
                <Input type="number" min={1} value={form.points_per_order} onChange={e => setForm(f => ({ ...f, points_per_order: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">Customers earn this many points each order</p>
              </div>
            ) : (
              <div>
                <Label>Points per {restaurantSettings?.currency || '$'}1 spent</Label>
                <Input type="number" min={0.1} step={0.1} value={form.points_per_currency} onChange={e => setForm(f => ({ ...f, points_per_currency: Number(e.target.value) }))} />
                <p className="text-xs text-muted-foreground mt-1">e.g. 1 = earn 1 point per {restaurantSettings?.currency || '$'}1</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Redemption */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Gift className="h-4 w-4 text-primary" /> Redemption
            </CardTitle>
            <CardDescription>How customers can redeem points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Redemption Method</Label>
              <Select value={form.redemption_type} onValueChange={(v) => setForm(f => ({ ...f, redemption_type: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flexible">Flexible conversion rate</SelectItem>
                  <SelectItem value="tiers">Fixed discount tiers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.redemption_type === 'flexible' ? (
              <>
                <div>
                  <Label>Value per point</Label>
                  <Input type="number" min={0.01} step={0.01} value={form.point_value} onChange={e => setForm(f => ({ ...f, point_value: Number(e.target.value) }))} />
                  <p className="text-xs text-muted-foreground mt-1">e.g. 0.05 = each point is worth {fmt(0.05)}</p>
                </div>
                <div>
                  <Label>Minimum points to redeem</Label>
                  <Input type="number" min={1} value={form.min_redeem_points} onChange={e => setForm(f => ({ ...f, min_redeem_points: Number(e.target.value) }))} />
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Discount Tiers</Label>
                  <Button variant="outline" size="sm" onClick={addTier} className="gap-1">
                    <Plus className="h-3 w-3" /> Add Tier
                  </Button>
                </div>
                {form.redemption_tiers.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No tiers yet. Add a tier to get started.</p>
                )}
                {form.redemption_tiers.map((tier, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-secondary/50 rounded-lg p-3">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Input type="number" min={1} value={tier.points} onChange={e => updateTier(idx, 'points', Number(e.target.value))} className="h-8" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">pts =</span>
                        <Input type="number" min={0.01} step={0.01} value={tier.discount} onChange={e => updateTier(idx, 'discount', Number(e.target.value))} className="h-8" />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">off</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeTier(idx)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expiry */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4 text-primary" /> Point Expiry
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-card-foreground">Enable point expiry</p>
                <p className="text-xs text-muted-foreground">Points expire after a set period</p>
              </div>
              <Switch checked={form.expiry_enabled} onCheckedChange={(v) => setForm(f => ({ ...f, expiry_enabled: v }))} />
            </div>
            {form.expiry_enabled && (
              <div>
                <Label>Expiry period (days)</Label>
                <Input type="number" min={30} value={form.expiry_days} onChange={e => setForm(f => ({ ...f, expiry_days: Number(e.target.value) }))} />
              </div>
            )}
          </CardContent>
        </Card>

        <Button onClick={handleSave} disabled={saving} className="gap-2 w-full" size="lg">
          <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Loyalty Settings'}
        </Button>
      </div>
    </AdminLayout>
  );
}
