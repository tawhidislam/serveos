import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import {
  Tag, Plus, Pencil, Trash2, Copy, Power, Percent, DollarSign,
  Calendar, Users as UsersIcon, Loader2, Check, Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface Coupon {
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
  applies_to_plans: string[] | null;
  applies_to_cycles: string[] | null;
  min_amount: number;
  created_at: string;
}

interface CouponForm {
  code: string;
  description: string;
  discount_type: 'percent' | 'fixed';
  discount_value: string;
  currency: string;
  is_active: boolean;
  max_redemptions: string;
  valid_from: string;
  valid_until: string;
  applies_to_plans: string[];
  applies_to_cycles: string[];
  min_amount: string;
}

const EMPTY_FORM: CouponForm = {
  code: '',
  description: '',
  discount_type: 'percent',
  discount_value: '10',
  currency: 'BDT',
  is_active: true,
  max_redemptions: '',
  valid_from: '',
  valid_until: '',
  applies_to_plans: [],
  applies_to_cycles: [],
  min_amount: '0',
};

const PLAN_OPTIONS = ['monthly', 'quarterly', 'biannual', 'yearly', 'pro', 'enterprise'];
const CYCLE_OPTIONS = ['monthly', 'yearly'];

/** SaaS admin UI for creating, editing, toggling, and deleting subscription coupons. */
export default function SubscriptionCouponsManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ['subscription-coupons'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_coupons')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Coupon[];
    },
  });

  const upsert = useMutation({
    mutationFn: async ({ id, form }: { id?: string; form: CouponForm }) => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        description: form.description.trim() || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value) || 0,
        currency: form.currency.trim().toUpperCase() || 'BDT',
        is_active: form.is_active,
        max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
        valid_from: form.valid_from ? new Date(form.valid_from).toISOString() : null,
        valid_until: form.valid_until ? new Date(form.valid_until).toISOString() : null,
        applies_to_plans: form.applies_to_plans.length > 0 ? form.applies_to_plans : null,
        applies_to_cycles: form.applies_to_cycles.length > 0 ? form.applies_to_cycles : null,
        min_amount: Number(form.min_amount) || 0,
      };
      if (id) {
        const { error } = await (supabase as any)
          .from('subscription_coupons')
          .update(payload)
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('subscription_coupons')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Coupon saved');
      setEditing(null);
      setCreating(false);
      qc.invalidateQueries({ queryKey: ['subscription-coupons'] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('A coupon with this code already exists');
      } else {
        toast.error(msg || 'Failed to save coupon');
      }
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (c: Coupon) => {
      const { error } = await (supabase as any)
        .from('subscription_coupons')
        .update({ is_active: !c.is_active })
        .eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-coupons'] }),
    onError: (e: any) => toast.error(e?.message || 'Failed to update coupon'),
  });

  const remove = useMutation({
    mutationFn: async (c: Coupon) => {
      const { error } = await (supabase as any)
        .from('subscription_coupons')
        .delete()
        .eq('id', c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coupon deleted');
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ['subscription-coupons'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Failed to delete coupon'),
  });

  const filtered = coupons.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
  });

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <Input
              placeholder="Search coupons…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          New coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading coupons…
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-border rounded-lg">
          <Tag className="h-10 w-10 opacity-30 mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground">
            {coupons.length === 0 ? 'No coupons yet' : 'No coupons match your search'}
          </p>
          {coupons.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Create your first coupon to offer discounts on subscription purchases.
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((c) => (
            <CouponCard
              key={c.id}
              coupon={c}
              onEdit={() => setEditing(c)}
              onToggle={() => toggleActive.mutate(c)}
              onDelete={() => setDeleting(c)}
            />
          ))}
        </div>
      )}

      <CouponDialog
        open={creating || !!editing}
        onOpenChange={(o) => { if (!o) { setCreating(false); setEditing(null); } }}
        coupon={editing}
        onSubmit={(form) => upsert.mutate({ id: editing?.id, form })}
        isPending={upsert.isPending}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong className="font-mono">{deleting?.code}</strong> will be removed.
              Existing payments that already used it stay intact, but no new
              redemptions will be possible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleting && remove.mutate(deleting)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CouponCard({
  coupon, onEdit, onToggle, onDelete,
}: {
  coupon: Coupon;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isPercent = coupon.discount_type === 'percent';
  const now = new Date();
  const expired = coupon.valid_until ? new Date(coupon.valid_until) < now : false;
  const notYet = coupon.valid_from ? new Date(coupon.valid_from) > now : false;
  const exhausted = coupon.max_redemptions != null && coupon.redemption_count >= coupon.max_redemptions;
  const usableNow = coupon.is_active && !expired && !notYet && !exhausted;

  return (
    <div className={`rounded-lg border p-4 space-y-3 transition ${
      usableNow ? 'bg-card border-border' : 'bg-muted/30 border-border/60 opacity-90'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <code className="text-sm font-bold font-mono tracking-wider text-foreground">
              {coupon.code}
            </code>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => {
                navigator.clipboard.writeText(coupon.code);
                toast.success('Code copied');
              }}
            >
              <Copy className="h-3 w-3" />
            </Button>
            {usableNow ? (
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                Active
              </Badge>
            ) : !coupon.is_active ? (
              <Badge variant="outline" className="bg-muted text-muted-foreground text-[10px]">Disabled</Badge>
            ) : expired ? (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Expired</Badge>
            ) : notYet ? (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px]">Not yet</Badge>
            ) : exhausted ? (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px]">Exhausted</Badge>
            ) : null}
          </div>
          {coupon.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{coupon.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onToggle}
            title={coupon.is_active ? 'Disable' : 'Enable'}>
            <Power className={`h-3.5 w-3.5 ${coupon.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`} />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm">
        <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary font-semibold">
          {isPercent ? (
            <><Percent className="h-3 w-3" /> {coupon.discount_value}% off</>
          ) : (
            <><DollarSign className="h-3 w-3" /> {coupon.currency} {coupon.discount_value} off</>
          )}
        </div>
        {coupon.min_amount > 0 && (
          <span className="text-[11px] text-muted-foreground">
            min {coupon.currency} {coupon.min_amount}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <UsersIcon className="h-3 w-3" />
          <span>
            {coupon.redemption_count} used
            {coupon.max_redemptions != null && ` / ${coupon.max_redemptions}`}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Calendar className="h-3 w-3" />
          <span>
            {coupon.valid_until
              ? `until ${format(new Date(coupon.valid_until), 'MMM d, yyyy')}`
              : 'no expiry'}
          </span>
        </div>
      </div>

      {((coupon.applies_to_plans && coupon.applies_to_plans.length > 0) ||
        (coupon.applies_to_cycles && coupon.applies_to_cycles.length > 0)) && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border/50">
          {coupon.applies_to_plans?.map((p) => (
            <Badge key={`p-${p}`} variant="outline" className="text-[10px] capitalize">
              {p}
            </Badge>
          ))}
          {coupon.applies_to_cycles?.map((c) => (
            <Badge key={`c-${c}`} variant="outline" className="text-[10px]">
              {c}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function CouponDialog({
  open, onOpenChange, coupon, onSubmit, isPending,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  coupon: Coupon | null;
  onSubmit: (form: CouponForm) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);

  // Hydrate the form whenever the dialog opens or the target coupon changes.
  useEffect(() => {
    if (!open) return;
    if (coupon) {
      setForm({
        code: coupon.code,
        description: coupon.description ?? '',
        discount_type: coupon.discount_type,
        discount_value: String(coupon.discount_value),
        currency: coupon.currency,
        is_active: coupon.is_active,
        max_redemptions: coupon.max_redemptions != null ? String(coupon.max_redemptions) : '',
        valid_from: coupon.valid_from ? format(new Date(coupon.valid_from), "yyyy-MM-dd'T'HH:mm") : '',
        valid_until: coupon.valid_until ? format(new Date(coupon.valid_until), "yyyy-MM-dd'T'HH:mm") : '',
        applies_to_plans: coupon.applies_to_plans ?? [],
        applies_to_cycles: coupon.applies_to_cycles ?? [],
        min_amount: String(coupon.min_amount),
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, coupon]);

  const handleClose = (o: boolean) => {
    if (!o) setForm(EMPTY_FORM);
    onOpenChange(o);
  };

  const togglePlan = (p: string) => {
    setForm((f) => ({
      ...f,
      applies_to_plans: f.applies_to_plans.includes(p)
        ? f.applies_to_plans.filter((x) => x !== p)
        : [...f.applies_to_plans, p],
    }));
  };
  const toggleCycle = (c: string) => {
    setForm((f) => ({
      ...f,
      applies_to_cycles: f.applies_to_cycles.includes(c)
        ? f.applies_to_cycles.filter((x) => x !== c)
        : [...f.applies_to_cycles, c],
    }));
  };

  const submitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim()) {
      toast.error('Coupon code is required');
      return;
    }
    if (!form.discount_value || Number(form.discount_value) <= 0) {
      toast.error('Discount value must be greater than zero');
      return;
    }
    if (form.discount_type === 'percent' && Number(form.discount_value) > 100) {
      toast.error('Percent discount cannot exceed 100');
      return;
    }
    if (form.valid_from && form.valid_until &&
        new Date(form.valid_from) >= new Date(form.valid_until)) {
      toast.error('"Valid until" must be after "valid from"');
      return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            {coupon ? 'Edit coupon' : 'New coupon'}
          </DialogTitle>
          <DialogDescription>
            Coupons can be applied at subscription checkout to grant a percent or fixed discount.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submitForm} className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label className="text-xs">Code <span className="text-destructive">*</span></Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder="WELCOME20"
                className="h-9 font-mono uppercase"
                maxLength={40}
                disabled={!!coupon}
              />
              {coupon && (
                <p className="text-[10px] text-muted-foreground">
                  Code cannot be changed after creation.
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Active</Label>
              <div className="h-9 flex items-center">
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Description (visible to tenants)</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="e.g. 20% off your first quarterly plan"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Discount type</Label>
              <Select
                value={form.discount_type}
                onValueChange={(v) => setForm({ ...form, discount_type: v as 'percent' | 'fixed' })}
              >
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent" className="text-xs">Percent (%)</SelectItem>
                  <SelectItem value="fixed" className="text-xs">Fixed amount</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                Value {form.discount_type === 'percent' ? '(%)' : `(${form.currency})`}
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={form.discount_type === 'percent' ? '100' : undefined}
                value={form.discount_value}
                onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                maxLength={6}
                className="h-9 text-xs uppercase"
                disabled={form.discount_type === 'percent'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Min order amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.min_amount}
                onChange={(e) => setForm({ ...form, min_amount: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Max total redemptions</Label>
              <Input
                type="number"
                min="1"
                value={form.max_redemptions}
                onChange={(e) => setForm({ ...form, max_redemptions: e.target.value })}
                placeholder="Unlimited"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Valid from</Label>
              <Input
                type="datetime-local"
                value={form.valid_from}
                onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valid until</Label>
              <Input
                type="datetime-local"
                value={form.valid_until}
                onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Restrict to specific plans (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {PLAN_OPTIONS.map((p) => {
                const on = form.applies_to_plans.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePlan(p)}
                    className={`px-2.5 py-1 rounded text-[11px] capitalize border transition ${
                      on ? 'bg-primary/15 text-primary border-primary/40 font-medium' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {on && <Check className="h-2.5 w-2.5 inline mr-1" />}
                    {p}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {form.applies_to_plans.length === 0 ? 'Applies to all plans' : `Only: ${form.applies_to_plans.join(', ')}`}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Restrict to billing cycles (optional)</Label>
            <div className="flex flex-wrap gap-1.5">
              {CYCLE_OPTIONS.map((c) => {
                const on = form.applies_to_cycles.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => toggleCycle(c)}
                    className={`px-2.5 py-1 rounded text-[11px] capitalize border transition ${
                      on ? 'bg-primary/15 text-primary border-primary/40 font-medium' : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {on && <Check className="h-2.5 w-2.5 inline mr-1" />}
                    {c}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground">
              {form.applies_to_cycles.length === 0 ? 'Applies to all cycles' : `Only: ${form.applies_to_cycles.join(', ')}`}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <><Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />Saving…</> : 'Save coupon'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}