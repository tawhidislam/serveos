import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  Loader2, Plus, Tag, Trash2, Edit3, Check, X, Calendar, Percent, DollarSign, Users, BarChart3, Infinity as InfinityIcon,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { usePlatformAddons } from '@/hooks/useAddons';
import { formatMoney as fmtMoney } from '@/lib/currency';

// Coupon row mirrors the addon_coupons table.
interface AddonCoupon {
  id: string;
  code: string;
  description: string | null;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  currency: string;
  is_active: boolean;
  max_redemptions: number | null;
  redemption_count: number;
  valid_from: string | null;
  valid_until: string | null;
  applies_to_addons: string[] | null;
  applies_to_billing_types: string[] | null;
  min_amount: number;
  created_at: string;
}

type DraftCoupon = {
  id?: string;
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  currency: string;
  is_active: boolean;
  max_redemptions: string;
  valid_from: string;
  valid_until: string;
  min_amount: string;
  applies_to_addons: string[];     // empty = all
  applies_to_billing_types: string[]; // empty = all
};

const EMPTY_DRAFT: DraftCoupon = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '10',
  currency: 'BDT',
  is_active: true,
  max_redemptions: '',
  valid_from: '',
  valid_until: '',
  min_amount: '0',
  applies_to_addons: [],
  applies_to_billing_types: [],
};

export default function AddonCouponsTab() {
  const qc = useQueryClient();
  const { data: addons = [] } = usePlatformAddons();

  const { data: coupons = [], isLoading } = useQuery<AddonCoupon[]>({
    queryKey: ['addon-coupons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('addon_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AddonCoupon[];
    },
  });

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DraftCoupon>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);

  // Usage breakdown dialog state.
  const [usageCoupon, setUsageCoupon] = useState<AddonCoupon | null>(null);

  const { data: usageData, isLoading: usageLoading } = useQuery({
    queryKey: ['addon-coupon-usage', usageCoupon?.id],
    enabled: !!usageCoupon,
    queryFn: async () => {
      const couponId = usageCoupon!.id;
      const code = usageCoupon!.code;
      // Pull all requests linked by id OR by stored coupon_code (covers historical rows).
      const { data, error } = await (supabase as any)
        .from('addon_purchase_requests')
        .select('id, restaurant_id, status, amount, original_amount, discount_amount, currency, billing_type, addon_id, created_at, reviewed_at, coupon_code, addon_coupon_id')
        .or(`addon_coupon_id.eq.${couponId},coupon_code.eq.${code}`)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      const rows = (data ?? []) as Array<{
        id: string; restaurant_id: string; status: string;
        amount: number; original_amount: number | null; discount_amount: number;
        currency: string; billing_type: string; addon_id: string;
        created_at: string; reviewed_at: string | null;
        coupon_code: string | null; addon_coupon_id: string | null;
      }>;

      // Look up restaurant names for the involved tenants.
      const restaurantIds = Array.from(new Set(rows.map((r) => r.restaurant_id)));
      let restaurants: Record<string, string> = {};
      if (restaurantIds.length > 0) {
        const { data: rdata } = await (supabase as any)
          .from('restaurants')
          .select('id, name')
          .in('id', restaurantIds);
        for (const r of (rdata ?? []) as Array<{ id: string; name: string }>) {
          restaurants[r.id] = r.name;
        }
      }
      return { rows, restaurants };
    },
  });

  const openCreate = () => { setDraft(EMPTY_DRAFT); setOpen(true); };
  const openEdit = (c: AddonCoupon) => {
    setDraft({
      id: c.id,
      code: c.code,
      description: c.description ?? '',
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      currency: c.currency,
      is_active: c.is_active,
      max_redemptions: c.max_redemptions != null ? String(c.max_redemptions) : '',
      valid_from: c.valid_from ? c.valid_from.slice(0, 16) : '',
      valid_until: c.valid_until ? c.valid_until.slice(0, 16) : '',
      min_amount: String(c.min_amount),
      applies_to_addons: c.applies_to_addons ?? [],
      applies_to_billing_types: c.applies_to_billing_types ?? [],
    });
    setOpen(true);
  };

  const save = async () => {
    if (!draft.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        code: draft.code.trim().toUpperCase(),
        description: draft.description.trim() || null,
        discount_type: draft.discount_type,
        discount_value: Number(draft.discount_value) || 0,
        currency: draft.currency.trim().toUpperCase() || 'BDT',
        is_active: draft.is_active,
        max_redemptions: draft.max_redemptions.trim() ? Number(draft.max_redemptions) : null,
        valid_from: draft.valid_from ? new Date(draft.valid_from).toISOString() : null,
        valid_until: draft.valid_until ? new Date(draft.valid_until).toISOString() : null,
        min_amount: Number(draft.min_amount) || 0,
        applies_to_addons: draft.applies_to_addons.length > 0 ? draft.applies_to_addons : null,
        applies_to_billing_types: draft.applies_to_billing_types.length > 0 ? draft.applies_to_billing_types : null,
      };
      const { error } = draft.id
        ? await (supabase as any).from('addon_coupons').update(payload).eq('id', draft.id)
        : await (supabase as any).from('addon_coupons').insert(payload);
      if (error) throw error;
      toast.success(draft.id ? 'Coupon updated' : 'Coupon created');
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['addon-coupons'] });
    } catch (err: any) {
      toast.error(err?.message || 'Failed to save coupon');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this coupon? Existing redemptions on past requests stay intact.')) return;
    const { error } = await (supabase as any).from('addon_coupons').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Coupon deleted');
    qc.invalidateQueries({ queryKey: ['addon-coupons'] });
  };

  const toggleActive = async (c: AddonCoupon) => {
    const { error } = await (supabase as any)
      .from('addon_coupons')
      .update({ is_active: !c.is_active })
      .eq('id', c.id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ['addon-coupons'] });
  };

  // Helpers for the multi-select checkboxes.
  const toggleAddon = (id: string) => {
    setDraft((d) => ({
      ...d,
      applies_to_addons: d.applies_to_addons.includes(id)
        ? d.applies_to_addons.filter((x) => x !== id)
        : [...d.applies_to_addons, id],
    }));
  };
  const toggleCycle = (cycle: string) => {
    setDraft((d) => ({
      ...d,
      applies_to_billing_types: d.applies_to_billing_types.includes(cycle)
        ? d.applies_to_billing_types.filter((x) => x !== cycle)
        : [...d.applies_to_billing_types, cycle],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Add-on coupons</h2>
          <p className="text-xs text-muted-foreground">
            Discount codes tenants can apply at add-on checkout. Independent from plan coupons.
          </p>
        </div>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : coupons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Tag className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>No add-on coupons yet.</p>
            <p className="text-xs">Create one to offer discounts at add-on checkout.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => {
            const expired = c.valid_until && new Date(c.valid_until) < new Date();
            const exhausted = c.max_redemptions != null && c.redemption_count >= c.max_redemptions;
            return (
              <Card key={c.id}>
                <CardContent className="p-4 flex flex-wrap items-center gap-4">
                  <div className="flex-1 min-w-[220px] space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{c.code}</span>
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {c.discount_type === 'percent' ? `${c.discount_value}%` : fmtMoney(c.currency, c.discount_value)}
                      </Badge>
                      {!c.is_active && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-muted-foreground">Disabled</Badge>}
                      {expired && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/40">Expired</Badge>}
                      {exhausted && <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-amber-600 border-amber-500/40">Used up</Badge>}
                    </div>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                    <div className="text-[11px] text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {c.redemption_count}{c.max_redemptions != null ? `/${c.max_redemptions}` : ''} used
                      </span>
                      {c.valid_until && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> until {format(new Date(c.valid_until), 'MMM d, yyyy')}
                        </span>
                      )}
                      {c.min_amount > 0 && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" /> min {fmtMoney(c.currency, c.min_amount)}
                        </span>
                      )}
                      <span>
                        {c.applies_to_addons?.length
                          ? `${c.applies_to_addons.length} add-on${c.applies_to_addons.length === 1 ? '' : 's'}`
                          : 'All add-ons'}
                      </span>
                      <span>
                        {c.applies_to_billing_types?.length
                          ? c.applies_to_billing_types.join(', ')
                          : 'All cycles'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c)} />
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => setUsageCoupon(c)}>
                      <BarChart3 className="h-3.5 w-3.5" /> Usage
                    </Button>
                    <Button size="sm" variant="ghost" className="gap-1.5" onClick={() => openEdit(c)}>
                      <Edit3 className="h-3.5 w-3.5" /> Edit
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive gap-1.5" onClick={() => remove(c.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft.id ? 'Edit coupon' : 'New add-on coupon'}</DialogTitle>
            <DialogDescription>
              Codes are stored uppercase. Leave restrictions empty to apply broadly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Code *</Label>
                <Input
                  value={draft.code}
                  onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value.toUpperCase() }))}
                  placeholder="ADDON20"
                  className="font-mono uppercase"
                  maxLength={40}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label className="text-xs">Description (optional)</Label>
                <Textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  rows={2}
                  placeholder="Internal note shown to admins only"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Discount type</Label>
                <Select
                  value={draft.discount_type}
                  onValueChange={(v) => setDraft((d) => ({ ...d, discount_type: v as 'percent' | 'fixed' }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent (%)</SelectItem>
                    <SelectItem value="fixed">Fixed amount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {draft.discount_type === 'percent' ? 'Percent off' : 'Amount off'}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft.discount_value}
                    onChange={(e) => setDraft((d) => ({ ...d, discount_value: e.target.value }))}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                    {draft.discount_type === 'percent' ? <Percent className="h-3.5 w-3.5" /> : draft.currency}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Currency</Label>
                <Input
                  value={draft.currency}
                  onChange={(e) => setDraft((d) => ({ ...d, currency: e.target.value.toUpperCase() }))}
                  maxLength={6}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Min order amount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.min_amount}
                  onChange={(e) => setDraft((d) => ({ ...d, min_amount: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Max redemptions (blank = unlimited)</Label>
                <Input
                  type="number"
                  min="1"
                  value={draft.max_redemptions}
                  onChange={(e) => setDraft((d) => ({ ...d, max_redemptions: e.target.value }))}
                  placeholder="∞"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valid from</Label>
                <Input
                  type="datetime-local"
                  value={draft.valid_from}
                  onChange={(e) => setDraft((d) => ({ ...d, valid_from: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Valid until</Label>
                <Input
                  type="datetime-local"
                  value={draft.valid_until}
                  onChange={(e) => setDraft((d) => ({ ...d, valid_until: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Applies to add-ons (none selected = all)</Label>
              <div className="rounded-md border border-border p-2 max-h-40 overflow-y-auto space-y-1">
                {addons.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-2">No add-ons in catalog.</p>
                ) : addons.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-xs cursor-pointer p-1 rounded hover:bg-muted/50">
                    <input
                      type="checkbox"
                      checked={draft.applies_to_addons.includes(a.id)}
                      onChange={() => toggleAddon(a.id)}
                      className="rounded"
                    />
                    <span className="flex-1">{a.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{a.billing_type}</Badge>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Applies to billing types (none selected = all)</Label>
              <div className="flex gap-3">
                {(['monthly', 'one_time'] as const).map((cycle) => (
                  <label key={cycle} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.applies_to_billing_types.includes(cycle)}
                      onChange={() => toggleCycle(cycle)}
                      className="rounded"
                    />
                    <span className="capitalize">{cycle.replace('_', ' ')}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t">
              <Switch
                checked={draft.is_active}
                onCheckedChange={(v) => setDraft((d) => ({ ...d, is_active: v }))}
              />
              <Label className="text-xs">Active (tenants can use this code)</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {draft.id ? 'Save changes' : 'Create coupon'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Usage breakdown */}
      <Dialog open={!!usageCoupon} onOpenChange={(o) => !o && setUsageCoupon(null)}>
        <DialogContent className="max-w-2xl max-h-[85dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              <span className="font-mono">{usageCoupon?.code}</span>
              <span className="text-sm font-normal text-muted-foreground">usage</span>
            </DialogTitle>
            <DialogDescription>
              Redemption stats and recent purchase requests that applied this code.
            </DialogDescription>
          </DialogHeader>

          {usageCoupon && (() => {
            const total = usageCoupon.redemption_count;
            const cap = usageCoupon.max_redemptions;
            const remaining = cap != null ? Math.max(cap - total, 0) : null;
            const pct = cap && cap > 0 ? Math.min(100, Math.round((total / cap) * 100)) : null;
            const rows = usageData?.rows ?? [];
            const approved = rows.filter((r) => r.status === 'approved');
            const pending = rows.filter((r) => r.status === 'pending');
            const rejected = rows.filter((r) => r.status === 'rejected');
            const totalDiscount = approved.reduce((sum, r) => sum + Number(r.discount_amount || 0), 0);
            const addonNameById = new Map(addons.map((a) => [a.id, a.name]));

            return (
              <div className="space-y-4 py-2">
                {/* Stat tiles */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Redemptions</p>
                      <p className="text-xl font-semibold">{total}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                      <p className="text-xl font-semibold flex items-center gap-1">
                        {remaining == null ? <InfinityIcon className="h-5 w-5" /> : remaining}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap</p>
                      <p className="text-xl font-semibold flex items-center gap-1">
                        {cap == null ? <InfinityIcon className="h-5 w-5" /> : cap}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Discount given</p>
                      <p className="text-xl font-semibold">
                        {fmtMoney(usageCoupon.currency, totalDiscount)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Progress bar */}
                {pct != null && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{total} of {cap} used</span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Status breakdown */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline" className="gap-1.5">
                    <Check className="h-3 w-3 text-emerald-600" /> {approved.length} approved
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <Loader2 className="h-3 w-3 text-amber-600" /> {pending.length} pending
                  </Badge>
                  <Badge variant="outline" className="gap-1.5">
                    <X className="h-3 w-3 text-destructive" /> {rejected.length} rejected
                  </Badge>
                </div>

                {/* Recent requests */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Recent requests</h3>
                    <span className="text-[11px] text-muted-foreground">
                      Showing up to 50 most recent
                    </span>
                  </div>

                  {usageLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : rows.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-xs text-muted-foreground">
                        This coupon hasn't been used yet.
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-1.5">
                      {rows.map((r) => {
                        const tenant = usageData?.restaurants?.[r.restaurant_id] ?? '—';
                        const addonName = addonNameById.get(r.addon_id) ?? 'Add-on';
                        const statusColor =
                          r.status === 'approved' ? 'text-emerald-600 border-emerald-500/40' :
                          r.status === 'rejected' ? 'text-destructive border-destructive/40' :
                          'text-amber-600 border-amber-500/40';
                        return (
                          <div
                            key={r.id}
                            className="rounded-md border border-border p-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs"
                          >
                            <Badge variant="outline" className={`text-[10px] h-4 px-1.5 capitalize ${statusColor}`}>
                              {r.status}
                            </Badge>
                            <span className="font-medium truncate max-w-[180px]">{tenant}</span>
                            <span className="text-muted-foreground">·</span>
                            <span className="text-muted-foreground truncate max-w-[180px]">{addonName}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                              {r.billing_type}
                            </Badge>
                            <span className="ml-auto flex items-center gap-2">
                              {r.original_amount != null && Number(r.discount_amount) > 0 && (
                                <span className="text-muted-foreground line-through">
                                  {fmtMoney(r.currency, r.original_amount)}
                                </span>
                              )}
                              <span className="font-semibold">
                                {fmtMoney(r.currency, r.amount)}
                              </span>
                              {Number(r.discount_amount) > 0 && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 text-emerald-600 border-emerald-500/40">
                                  −{fmtMoney(r.currency, r.discount_amount)}
                                </Badge>
                              )}
                            </span>
                            <span className="basis-full text-[10px] text-muted-foreground">
                              {format(new Date(r.created_at), 'MMM d, yyyy · h:mm a')}
                              {r.reviewed_at && ` · reviewed ${format(new Date(r.reviewed_at), 'MMM d, h:mm a')}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setUsageCoupon(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}