import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, Puzzle, Plus, Trash2, Eye, EyeOff, Check, X,
  Inbox, Building2, Calendar, Tag, Receipt, CreditCard, Hash, Phone,
  FileText, Percent, AlertCircle,
} from 'lucide-react';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import { usePlatformAddons, useAllAddonRequests, type PlatformAddon } from '@/hooks/useAddons';
import AddonCouponsTab from '@/components/platform/AddonCouponsTab';
import { formatMoney as fmtMoney } from '@/lib/currency';

// Plan-feature keys that an addon can unlock (matches PlanLimits in src/lib/plans.ts).
const FEATURE_KEY_OPTIONS = [
  { value: '__none__', label: 'None (informational only)' },
  { value: 'accounting', label: 'Accounting suite' },
  { value: 'loyalty', label: 'Loyalty program' },
  { value: 'promotions', label: 'Promotions & marketing' },
  { value: 'floorPlans', label: 'Floor plans' },
  { value: 'customDomain', label: 'Custom domain' },
];

export default function PlatformAddons() {
  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
        <header className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Puzzle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Add-on services</h1>
            <p className="text-sm text-muted-foreground">
              Sell optional features à la carte. Restaurants can purchase add-ons individually
              regardless of their subscription plan.
            </p>
          </div>
        </header>

        <Tabs defaultValue="catalog" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="catalog" className="gap-2">
              <Puzzle className="h-3.5 w-3.5" /> Catalog
            </TabsTrigger>
            <TabsTrigger value="requests" className="gap-2">
              <Inbox className="h-3.5 w-3.5" /> Purchase requests
            </TabsTrigger>
            <TabsTrigger value="grants" className="gap-2">
              <Building2 className="h-3.5 w-3.5" /> Active grants
            </TabsTrigger>
            <TabsTrigger value="coupons" className="gap-2">
              <Tag className="h-3.5 w-3.5" /> Coupons
            </TabsTrigger>
          </TabsList>

          <TabsContent value="catalog" className="mt-6">
            <CatalogTab />
          </TabsContent>
          <TabsContent value="requests" className="mt-6">
            <RequestsTab />
          </TabsContent>
          <TabsContent value="grants" className="mt-6">
            <GrantsTab />
          </TabsContent>
          <TabsContent value="coupons" className="mt-6">
            <AddonCouponsTab />
          </TabsContent>
        </Tabs>
      </div>
    </PlatformLayout>
  );
}

// ============================ CATALOG ============================
function CatalogTab() {
  const { data: addons, isLoading } = usePlatformAddons();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, PlatformAddon>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    key: '', name: '', description: '', price_amount: '0',
    billing_type: 'monthly' as 'monthly' | 'one_time', feature_key: '__none__',
  });

  useEffect(() => {
    if (!addons) return;
    setDrafts((prev) => {
      const next = { ...prev };
      for (const a of addons) if (!next[a.id]) next[a.id] = a;
      return next;
    });
  }, [addons]);

  const update = (id: string, patch: Partial<PlatformAddon>) =>
    setDrafts((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  const save = async (id: string) => {
    const a = drafts[id];
    if (!a) return;
    setSavingId(id);
    try {
      const { error: upErr } = await supabase
        .from('platform_addons')
        .update({
          name: a.name,
          description: a.description,
          badge: a.badge,
          billing_type: a.billing_type,
          price_amount: Number(a.price_amount) || 0,
          currency: a.currency,
          feature_key: a.feature_key === '__none__' ? null : a.feature_key,
          icon: a.icon,
          sort_order: a.sort_order,
          is_public: a.is_public,
          is_active: a.is_active,
          extra_menu_items: Number(a.extra_menu_items) || 0,
          extra_branches: Number(a.extra_branches) || 0,
          extra_staff: Number(a.extra_staff) || 0,
          unlimited_menu_items: !!a.unlimited_menu_items,
          unlimited_branches: !!a.unlimited_branches,
          unlimited_staff: !!a.unlimited_staff,
          allow_multiple: !!a.allow_multiple,
          max_quantity: a.allow_multiple
            ? (a.max_quantity != null && Number(a.max_quantity) > 0
              ? Math.floor(Number(a.max_quantity))
              : null)
            : null,
        })
        .eq('id', id);
      if (upErr) throw upErr;
      toast.success(`${a.name} saved`);
      qc.invalidateQueries({ queryKey: ['platform-addons'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSavingId(null);
    }
  };

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      const { error } = await supabase.from('platform_addons').delete().eq('id', id);
      if (error) throw error;
      toast.success('Add-on deleted');
      qc.invalidateQueries({ queryKey: ['platform-addons'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to delete');
    } finally {
      setDeletingId(null);
    }
  };

  const create = async () => {
    const name = draft.name.trim();
    const key = (draft.key.trim() || slugify(name)).toLowerCase();
    if (!name) return toast.error('Name required');
    if (!key) return toast.error('Key required');
    setCreating(true);
    try {
      const nextSort = (addons?.reduce((m, a) => Math.max(m, a.sort_order), 0) ?? 0) + 1;
      const { error } = await supabase.from('platform_addons').insert({
        key,
        name,
        description: draft.description.trim() || null,
        billing_type: draft.billing_type,
        price_amount: Number(draft.price_amount) || 0,
        feature_key: draft.feature_key === '__none__' ? null : draft.feature_key,
        sort_order: nextSort,
      });
      if (error) throw error;
      toast.success(`${name} created`);
      setCreateOpen(false);
      setDraft({ key: '', name: '', description: '', price_amount: '0', billing_type: 'monthly', feature_key: '__none__' });
      qc.invalidateQueries({ queryKey: ['platform-addons'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to create');
    } finally {
      setCreating(false);
    }
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {addons?.length ?? 0} add-on{addons?.length === 1 ? '' : 's'} in the catalog.
        </p>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New add-on</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create add-on</DialogTitle>
              <DialogDescription>
                Add a new optional service. Restaurants will see it on their /admin/addons page and on the public pricing page.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Field label="Display name" value={draft.name} onChange={(v) => setDraft((s) => ({ ...s, name: v, key: s.key || slugify(v) }))} placeholder="e.g. Priority Support" />
              <Field label="Key (immutable)" value={draft.key} onChange={(v) => setDraft((s) => ({ ...s, key: slugify(v) }))} placeholder="priority_support" />
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Description</Label>
                <Textarea rows={2} value={draft.description} onChange={(e) => setDraft((s) => ({ ...s, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Price" type="number" value={draft.price_amount} onChange={(v) => setDraft((s) => ({ ...s, price_amount: v }))} />
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Billing</Label>
                  <Select value={draft.billing_type} onValueChange={(v) => setDraft((s) => ({ ...s, billing_type: v as any }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly recurring</SelectItem>
                      <SelectItem value="one_time">One-time purchase</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unlocks feature</Label>
                <Select value={draft.feature_key} onValueChange={(v) => setDraft((s) => ({ ...s, feature_key: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEATURE_KEY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Pick the in-app feature this add-on unlocks for customers who purchase it.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
              <Button onClick={create} disabled={creating} className="gap-2">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!addons?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Puzzle className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>No add-ons yet — create your first to start selling optional features.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {addons.map((a) => {
            const d = drafts[a.id] ?? a;
            const dirty = JSON.stringify(d) !== JSON.stringify(a);
            return (
              <Card key={a.id}>
                <CardHeader className="flex flex-row items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0 flex-1">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {d.name}
                      {!d.is_active && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Inactive</Badge>}
                      {!d.is_public && <Badge variant="outline" className="text-[10px] h-4 px-1.5">Hidden</Badge>}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground font-mono">{d.key}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" disabled={deletingId === a.id}>
                          {deletingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete "{d.name}"?</AlertDialogTitle>
                          <AlertDialogDescription>
                            All active grants and purchase requests for this add-on will also be removed. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(a.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button onClick={() => save(a.id)} disabled={!dirty || savingId === a.id} size="sm" className="gap-1.5 h-8">
                      {savingId === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                      Save
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Field label="Display name" value={d.name} onChange={(v) => update(a.id, { name: v })} />
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <Textarea rows={2} value={d.description ?? ''} onChange={(e) => update(a.id, { description: e.target.value || null })} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Price" type="number" value={String(d.price_amount)} onChange={(v) => update(a.id, { price_amount: Number(v) || 0 })} />
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Billing</Label>
                      <Select value={d.billing_type} onValueChange={(v) => update(a.id, { billing_type: v as any })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="one_time">One-time</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Currency" value={d.currency} onChange={(v) => update(a.id, { currency: v.toUpperCase().slice(0, 3) })} />
                    <Field label="Badge (optional)" value={d.badge ?? ''} onChange={(v) => update(a.id, { badge: v || null })} placeholder="e.g. Popular" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Unlocks feature</Label>
                    <Select value={d.feature_key ?? '__none__'} onValueChange={(v) => update(a.id, { feature_key: v === '__none__' ? null : v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {FEATURE_KEY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Quantity limit boosts
                    </p>
                    <p className="text-[11px] text-muted-foreground -mt-1">
                      Each active grant of this add-on adds these to the tenant's plan limits.
                      Toggle "Unlimited" to override the plan cap entirely.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Extra menu items</Label>
                        <Input
                          type="number"
                          min={0}
                          value={d.unlimited_menu_items ? '' : String(d.extra_menu_items ?? 0)}
                          disabled={d.unlimited_menu_items}
                          onChange={(e) => update(a.id, { extra_menu_items: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 text-xs"
                        />
                        <ToggleField label="Unlimited" checked={d.unlimited_menu_items} onChange={(v) => update(a.id, { unlimited_menu_items: v })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Extra branches</Label>
                        <Input
                          type="number"
                          min={0}
                          value={d.unlimited_branches ? '' : String(d.extra_branches ?? 0)}
                          disabled={d.unlimited_branches}
                          onChange={(e) => update(a.id, { extra_branches: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 text-xs"
                        />
                        <ToggleField label="Unlimited" checked={d.unlimited_branches} onChange={(v) => update(a.id, { unlimited_branches: v })} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Extra staff</Label>
                        <Input
                          type="number"
                          min={0}
                          value={d.unlimited_staff ? '' : String(d.extra_staff ?? 0)}
                          disabled={d.unlimited_staff}
                          onChange={(e) => update(a.id, { extra_staff: Math.max(0, Number(e.target.value) || 0) })}
                          className="h-8 text-xs"
                        />
                        <ToggleField label="Unlimited" checked={d.unlimited_staff} onChange={(v) => update(a.id, { unlimited_staff: v })} />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-0.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          Multiple-quantity purchases
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Allow restaurants to buy more than one unit of this add-on in a single
                          checkout. The total price scales with quantity.
                        </p>
                      </div>
                      <ToggleField
                        label="Allow multiple"
                        checked={!!d.allow_multiple}
                        onChange={(v) => update(a.id, { allow_multiple: v })}
                      />
                    </div>
                    {d.allow_multiple && (
                      <div className="space-y-1 max-w-[180px]">
                        <Label className="text-[10px] text-muted-foreground">
                          Max units per purchase (blank = no cap)
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          value={d.max_quantity == null ? '' : String(d.max_quantity)}
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (!raw) {
                              update(a.id, { max_quantity: null });
                              return;
                            }
                            const n = Math.max(1, Math.floor(Number(raw) || 1));
                            update(a.id, { max_quantity: n });
                          }}
                          className="h-8 text-xs"
                          placeholder="No cap"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 pt-1">
                    <ToggleField icon={d.is_public ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />} label="Visible on /pricing" checked={d.is_public} onChange={(v) => update(a.id, { is_public: v })} />
                    <ToggleField label="Available for purchase" checked={d.is_active} onChange={(v) => update(a.id, { is_active: v })} />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================ REQUESTS ============================
function RequestsTab() {
  const { data: requests, isLoading, refetch } = useAllAddonRequests();
  const { data: addons } = usePlatformAddons();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const qc = useQueryClient();

  const restaurantIds = Array.from(new Set((requests ?? []).map((r) => r.restaurant_id)));
  const { data: tenants = [] } = useQuery({
    queryKey: ['restaurants-by-ids', restaurantIds.join(',')],
    queryFn: async () => {
      if (!restaurantIds.length) return [];
      const { data } = await supabase.from('restaurants').select('id,name,slug').in('id', restaurantIds);
      return data ?? [];
    },
    enabled: restaurantIds.length > 0,
  });
  const tenantById = new Map(tenants.map((t: any) => [t.id, t]));
  const addonById = new Map((addons ?? []).map((a) => [a.id, a]));

  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [detail, setDetail] = useState<any | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [adminNotes, setAdminNotes] = useState('');

  const review = async (id: string, action: 'approve' | 'reject', notes?: string) => {
    setReviewing(id);
    try {
      const req = (requests ?? []).find((r) => r.id === id);
      if (!req) throw new Error('Request not found');

      if (action === 'approve') {
        const addon = addonById.get(req.addon_id);
        if (!addon) throw new Error('Addon missing');
        const expiresAt = req.billing_type === 'monthly'
          ? new Date(Date.now() + 30 * 86400_000).toISOString()
          : null;
        // The restaurant_addons table has UNIQUE(restaurant_id, addon_id), so
        // approving a multi-quantity purchase needs to ADD the requested
        // quantity to any quantity that's already active for the tenant.
        const requestedQty = Math.max(1, Number((req as any).quantity) || 1);
        const { data: existingGrant } = await supabase
          .from('restaurant_addons')
          .select('quantity')
          .eq('restaurant_id', req.restaurant_id)
          .eq('addon_id', req.addon_id)
          .maybeSingle();
        const existingQty = Math.max(0, Number((existingGrant as any)?.quantity) || 0);
        const nextQty = existingQty + requestedQty;
        const { error: grantErr } = await supabase
          .from('restaurant_addons')
          .upsert({
            addon_id: req.addon_id,
            restaurant_id: req.restaurant_id,
            source: 'purchase',
            status: 'active',
            starts_at: new Date().toISOString(),
            expires_at: expiresAt,
            granted_via_request_id: req.id,
            quantity: nextQty,
          }, { onConflict: 'restaurant_id,addon_id' });
        if (grantErr) throw grantErr;

        // Increment coupon redemption count if a coupon was applied
        if ((req as any).addon_coupon_id) {
          const { data: coupon } = await supabase
            .from('addon_coupons')
            .select('redemption_count')
            .eq('id', (req as any).addon_coupon_id)
            .maybeSingle();
          if (coupon) {
            await supabase
              .from('addon_coupons')
              .update({ redemption_count: (coupon.redemption_count ?? 0) + 1 })
              .eq('id', (req as any).addon_coupon_id);
          }
        }
      }

      const { error: upErr } = await supabase
        .from('addon_purchase_requests')
        .update({
          status: action === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
          admin_notes: notes ?? null,
        })
        .eq('id', id);
      if (upErr) throw upErr;

      toast.success(action === 'approve' ? 'Approved & activated' : 'Request rejected');
      qc.invalidateQueries({ queryKey: ['addon-requests'] });
      qc.invalidateQueries({ queryKey: ['restaurant-addons'] });
      qc.invalidateQueries({ queryKey: ['addon-coupons'] });
      refetch();
      setDetail(null);
      setAdminNotes('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    } finally {
      setReviewing(null);
    }
  };

  const openReview = (req: any, action: 'approve' | 'reject') => {
    setDetail(req);
    setReviewAction(action);
    setAdminNotes(req.admin_notes ?? '');
  };

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const counts = {
    all: requests?.length ?? 0,
    pending: requests?.filter((r) => r.status === 'pending').length ?? 0,
    approved: requests?.filter((r) => r.status === 'approved').length ?? 0,
    rejected: requests?.filter((r) => r.status === 'rejected').length ?? 0,
  };

  const filtered = (requests ?? []).filter((r) =>
    statusFilter === 'all' ? true : r.status === statusFilter
  );

  return (
    <div className="space-y-4">
      {/* Status filter pills */}
      <div className="flex flex-wrap items-center gap-1.5">
        {(['pending', 'approved', 'rejected', 'all'] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}
            className="h-7 gap-1.5 text-xs capitalize"
          >
            {s}
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{counts[s]}</Badge>
          </Button>
        ))}
      </div>

      {!filtered.length ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground space-y-2">
            <Inbox className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p>No {statusFilter === 'all' ? '' : statusFilter} requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
        const addon = addonById.get(r.addon_id);
        const tenant = tenantById.get(r.restaurant_id);
        const original = Number((r as any).original_amount ?? r.amount);
        const discount = Number((r as any).discount_amount ?? 0);
        return (
          <Card key={r.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Header strip */}
              <div className="px-4 py-3 border-b border-border/60 flex flex-wrap items-center gap-2 bg-muted/20">
                <span className="font-semibold text-sm">{addon?.name ?? 'Unknown add-on'}</span>
                <Badge variant={
                  r.status === 'pending' ? 'secondary'
                  : r.status === 'approved' ? 'default'
                  : 'outline'
                } className="text-[10px] h-4 px-1.5 capitalize">{r.status}</Badge>
                <Badge variant="outline" className="text-[10px] h-4 px-1.5 capitalize">{r.billing_type.replace('_', ' ')}</Badge>
                <span className="ml-auto text-[11px] text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {new Date(r.created_at).toLocaleString()}
                </span>
              </div>

              {/* Body grid: tenant • amount • payment • coupon */}
              <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Tenant */}
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Tenant</div>
                  <div className="text-sm font-medium truncate flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    {tenant?.name ?? r.restaurant_id.slice(0, 8)}
                  </div>
                  {tenant?.slug && (
                    <div className="text-[11px] text-muted-foreground font-mono truncate">/r/{tenant.slug}</div>
                  )}
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Amount</div>
                  <div className="text-sm font-mono font-semibold flex items-center gap-1.5">
                    <span>{fmtMoney(r.currency, r.amount)}</span>
                    {Number((r as any).quantity ?? 1) > 1 && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-mono">
                        × {(r as any).quantity}
                      </Badge>
                    )}
                  </div>
                  {discount > 0 && (
                    <div className="text-[11px] text-muted-foreground line-through font-mono">
                      {fmtMoney(r.currency, original)}
                    </div>
                  )}
                </div>

                {/* Payment */}
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Payment</div>
                  {r.payment_method ? (
                    <>
                      <div className="text-sm font-medium capitalize flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                        {r.payment_method}
                      </div>
                      {(r as any).sender_number && (
                        <div className="text-[11px] text-muted-foreground font-mono truncate flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {(r as any).sender_number}
                        </div>
                      )}
                      {(r as any).transaction_id && (
                        <div className="text-[11px] text-muted-foreground font-mono truncate flex items-center gap-1">
                          <Hash className="h-3 w-3" /> {(r as any).transaction_id}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">Not specified</div>
                  )}
                </div>

                {/* Coupon */}
                <div className="space-y-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Coupon</div>
                  {(r as any).coupon_code ? (
                    <>
                      <div className="text-sm font-mono font-medium text-emerald-600 flex items-center gap-1.5">
                        <Tag className="h-3.5 w-3.5" />
                        {(r as any).coupon_code}
                      </div>
                      {discount > 0 && (
                        <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                          <Percent className="h-3 w-3" />
                          −{fmtMoney(r.currency, discount)}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-[11px] text-muted-foreground italic">No coupon</div>
                  )}
                </div>
              </div>

              {(r.notes || (r as any).admin_notes || r.status !== 'pending') && (
                <div className="px-4 pb-3 space-y-1.5">
                  {r.notes && (
                    <div className="text-[11px] text-muted-foreground italic flex items-start gap-1.5">
                      <FileText className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>Tenant note: "{r.notes}"</span>
                    </div>
                  )}
                  {(r as any).admin_notes && (
                    <div className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>Admin note: {(r as any).admin_notes}</span>
                    </div>
                  )}
                  {r.status !== 'pending' && (r as any).reviewed_at && (
                    <div className="text-[10px] text-muted-foreground">
                      Reviewed {new Date((r as any).reviewed_at).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="px-4 py-3 border-t border-border/60 bg-muted/10 flex flex-wrap gap-2 justify-end">
                <Button size="sm" variant="ghost" className="gap-1.5 h-8" onClick={() => { setDetail(r); setAdminNotes(r.admin_notes ?? ''); setReviewAction('approve'); }}>
                  <Receipt className="h-3.5 w-3.5" /> View details
                </Button>
                {r.status === 'pending' && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8 text-destructive hover:text-destructive" onClick={() => openReview(r, 'reject')} disabled={reviewing === r.id}>
                      <X className="h-3.5 w-3.5" /> Reject
                    </Button>
                    <Button size="sm" className="gap-1.5 h-8" onClick={() => openReview(r, 'approve')} disabled={reviewing === r.id}>
                      {reviewing === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                      Approve
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        );
          })}
        </div>
      )}

      {/* Review dialog with full detail + notes */}
      <Dialog open={!!detail} onOpenChange={(o) => { if (!o) { setDetail(null); setAdminNotes(''); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              {detail?.status === 'pending'
                ? (reviewAction === 'approve' ? 'Approve add-on purchase' : 'Reject add-on purchase')
                : 'Add-on request details'}
            </DialogTitle>
            <DialogDescription>
              {detail && (
                <>
                  {tenantById.get(detail.restaurant_id)?.name ?? detail.restaurant_id.slice(0, 8)}
                  {' · '}
                  {addonById.get(detail.addon_id)?.name ?? 'Unknown add-on'}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {detail && (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2 text-xs">
                <DetailRow label="Billing" value={<span className="capitalize">{detail.billing_type.replace('_', ' ')}</span>} />
                <DetailRow
                  label="Original amount"
                  value={<span className="font-mono">{fmtMoney(detail.currency, detail.original_amount ?? detail.amount)}</span>}
                />
                {Number(detail.discount_amount ?? 0) > 0 && (
                  <DetailRow
                    label="Discount"
                    value={<span className="font-mono text-emerald-600">−{fmtMoney(detail.currency, detail.discount_amount)}</span>}
                  />
                )}
                <DetailRow
                  label="Total to pay"
                  value={<span className="font-mono font-semibold">{fmtMoney(detail.currency, detail.amount)}</span>}
                />
                {detail.coupon_code && (
                  <DetailRow
                    label="Coupon"
                    value={<span className="font-mono text-emerald-600">{detail.coupon_code}</span>}
                  />
                )}
                {detail.payment_method && (
                  <DetailRow label="Provider" value={<span className="capitalize">{detail.payment_method}</span>} />
                )}
                {detail.sender_number && (
                  <DetailRow label="Sender number" value={<span className="font-mono">{detail.sender_number}</span>} />
                )}
                {detail.transaction_id && (
                  <DetailRow label="Transaction ID" value={<span className="font-mono">{detail.transaction_id}</span>} />
                )}
                {detail.reference_code && (
                  <DetailRow label="Reference" value={<span className="font-mono">{detail.reference_code}</span>} />
                )}
                <DetailRow label="Submitted" value={new Date(detail.created_at).toLocaleString()} />
              </div>

              {detail.notes && (
                <div className="text-xs space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Tenant note</Label>
                  <p className="rounded-md border border-border/60 bg-muted/20 p-2 italic">"{detail.notes}"</p>
                </div>
              )}

              {detail.status === 'pending' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Admin notes (visible to tenant)</Label>
                  <Textarea
                    rows={3}
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder={reviewAction === 'reject' ? 'Reason for rejection…' : 'Optional note'}
                  />
                  {reviewAction === 'approve' && (
                    <p className="text-[11px] text-emerald-600">
                      ✓ Add-on will be activated{detail.billing_type === 'monthly' ? ' for 30 days' : ' permanently'}
                    </p>
                  )}
                </div>
              ) : detail.admin_notes ? (
                <div className="text-xs space-y-1">
                  <Label className="text-[11px] text-muted-foreground">Admin note</Label>
                  <p className="rounded-md border border-border/60 bg-muted/20 p-2">{detail.admin_notes}</p>
                </div>
              ) : null}
            </div>
          )}

          <DialogFooter>
            {detail?.status === 'pending' ? (
              <>
                <Button variant="outline" onClick={() => { setDetail(null); setAdminNotes(''); }}>Cancel</Button>
                <Button
                  variant={reviewAction === 'reject' ? 'destructive' : 'default'}
                  onClick={() => review(detail.id, reviewAction, adminNotes.trim() || undefined)}
                  disabled={reviewing === detail.id}
                  className="gap-1.5"
                >
                  {reviewing === detail.id
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : reviewAction === 'approve' ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                  {reviewAction === 'approve' ? 'Approve & Activate' : 'Reject'}
                </Button>
              </>
            ) : (
              <Button variant="outline" onClick={() => setDetail(null)}>Close</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

// ============================ GRANTS ============================
function GrantsTab() {
  const qc = useQueryClient();
  const { data: addons } = usePlatformAddons();
  const { data: tenants = [] } = useQuery({
    queryKey: ['all-restaurants-min'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurants').select('id,name,slug').order('name');
      return data ?? [];
    },
  });
  const { data: grants = [], isLoading, refetch } = useQuery({
    queryKey: ['restaurant-addons-all'],
    queryFn: async () => {
      const { data } = await supabase.from('restaurant_addons').select('*').order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const [grantOpen, setGrantOpen] = useState(false);
  const [granting, setGranting] = useState(false);
  const [grant, setGrant] = useState({ addon_id: '', restaurant_id: '', expires_at: '' });

  const tenantById = new Map(tenants.map((t: any) => [t.id, t]));
  const addonById = new Map((addons ?? []).map((a) => [a.id, a]));

  const doGrant = async () => {
    if (!grant.addon_id || !grant.restaurant_id) return toast.error('Pick add-on and restaurant');
    setGranting(true);
    try {
      const { error } = await supabase.from('restaurant_addons').upsert({
        addon_id: grant.addon_id,
        restaurant_id: grant.restaurant_id,
        source: 'grant',
        status: 'active',
        starts_at: new Date().toISOString(),
        expires_at: grant.expires_at ? new Date(grant.expires_at).toISOString() : null,
      }, { onConflict: 'restaurant_id,addon_id' });
      if (error) throw error;
      toast.success('Add-on granted');
      setGrantOpen(false);
      setGrant({ addon_id: '', restaurant_id: '', expires_at: '' });
      qc.invalidateQueries({ queryKey: ['restaurant-addons-all'] });
      qc.invalidateQueries({ queryKey: ['restaurant-addons'] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    } finally {
      setGranting(false);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('Revoke this add-on grant?')) return;
    try {
      const { error } = await supabase.from('restaurant_addons').update({ status: 'revoked' }).eq('id', id);
      if (error) throw error;
      toast.success('Revoked');
      qc.invalidateQueries({ queryKey: ['restaurant-addons-all'] });
      qc.invalidateQueries({ queryKey: ['restaurant-addons'] });
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed');
    }
  };

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground p-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{grants.length} active grant{grants.length === 1 ? '' : 's'}.</p>
        <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Grant add-on</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Grant add-on directly</DialogTitle>
              <DialogDescription>Give a restaurant free access to an add-on without payment.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Add-on</Label>
                <Select value={grant.addon_id} onValueChange={(v) => setGrant((s) => ({ ...s, addon_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select add-on" /></SelectTrigger>
                  <SelectContent>
                    {(addons ?? []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Restaurant</Label>
                <Select value={grant.restaurant_id} onValueChange={(v) => setGrant((s) => ({ ...s, restaurant_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select restaurant" /></SelectTrigger>
                  <SelectContent>
                    {tenants.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Field label="Expires at (optional, YYYY-MM-DD)" value={grant.expires_at} onChange={(v) => setGrant((s) => ({ ...s, expires_at: v }))} placeholder="leave blank for perpetual" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGrantOpen(false)} disabled={granting}>Cancel</Button>
              <Button onClick={doGrant} disabled={granting} className="gap-2">
                {granting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Grant
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {!grants.length ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No add-on grants yet.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {grants.map((g: any) => {
            const a = addonById.get(g.addon_id);
            const t = tenantById.get(g.restaurant_id);
            return (
              <Card key={g.id}>
                <CardContent className="p-3 flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <div className="font-medium text-sm">{a?.name ?? 'Unknown'}</div>
                    <div className="text-xs text-muted-foreground">{(t as any)?.name ?? g.restaurant_id.slice(0, 8)}</div>
                  </div>
                  <Badge variant={g.status === 'active' ? 'default' : 'outline'} className="text-[10px]">{g.status}</Badge>
                  <Badge variant="outline" className="text-[10px]">{g.source}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {g.expires_at ? `Until ${new Date(g.expires_at).toLocaleDateString()}` : 'Perpetual'}
                  </span>
                  {g.status === 'active' && (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => revoke(g.id)}>
                      <X className="h-3.5 w-3.5" /> Revoke
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================ SHARED ============================
function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function ToggleField({ label, hint, icon, checked, onChange }: {
  label: string; hint?: string; icon?: React.ReactNode; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <Switch checked={checked} onCheckedChange={onChange} />
      <span className="text-sm flex items-center gap-1.5">{icon}{label}</span>
      {hint && <span className="text-[11px] text-muted-foreground">({hint})</span>}
    </label>
  );
}
