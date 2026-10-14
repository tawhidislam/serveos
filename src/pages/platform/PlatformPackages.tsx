import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, Check, CheckCircle2, Eye, Loader2, Package, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { getPlanCycle, getPlanPrice, type BillingCycle } from '@/lib/plan-pricing';
import { planDurationMonths, isTrialPlan, planTermLabel, planTermSuffix } from '@/lib/plan-duration';
import { getCurrencySymbol, SUPPORTED_CURRENCIES } from '@/lib/currency';
import { updatePackagePrice } from '@/lib/package-editor';
import { slugify } from '@/lib/slug';
import { toast } from 'sonner';

const FEATURES = [
  ['feature_pos', 'POS & billing'], ['feature_kds', 'Kitchen display'],
  ['feature_accounting', 'Accounting suite'], ['feature_loyalty', 'Customer loyalty'],
  ['feature_floor_plans', 'Floor plans'], ['feature_custom_domain', 'Custom domain'],
  ['feature_promotions', 'Promotions'], ['feature_multi_branch', 'Multiple branches'],
  ['feature_ai_images', 'AI images'],
] as const;
const LIMITS = [
  ['max_menu_items', 'Menu items'], ['max_branches', 'Branches'],
  ['max_staff', 'Staff accounts'], ['max_monthly_orders', 'Orders per month'],
] as const;

function packageMoney(currency: string, amount: number) {
  return `${getCurrencySymbol(currency)}${(Number.isFinite(amount) ? amount : 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function blankPackage(currency: string, position: number): SubscriptionPlan {
  return {
    id: '', tier: '', name: '', description: '', badge: null, sort_order: position,
    is_public: false, is_active: true, currency, price_monthly: 0, price_yearly: 0,
    original_price_monthly: null, original_price_yearly: null, prices: {},
    max_menu_items: null, max_branches: null, max_staff: null, max_monthly_orders: null,
    feature_pos: true, feature_kds: true, feature_accounting: false, feature_loyalty: false,
    feature_floor_plans: false, feature_custom_domain: false, feature_promotions: false,
    feature_multi_branch: false, feature_ai_images: false,
    features: [], features_heading: "What's included", features_visible: true,
  };
}

export default function PlatformPackages() {
  const { data: plans = [], isLoading, isError, refetch } = useSubscriptionPlans();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<SubscriptionPlan | null>(null);
  const [initial, setInitial] = useState<SubscriptionPlan | null>(null);
  const [cycle, setCycle] = useState<BillingCycle>('monthly');
  const [saving, setSaving] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const dirty = draft !== null && JSON.stringify(draft) !== JSON.stringify(initial);
  const isNew = !!draft && !draft.id;
  const patch = (changes: Partial<SubscriptionPlan>) => { setDraft(previous => previous ? { ...previous, ...changes } : previous); setError(''); };
  const openEditor = (plan: SubscriptionPlan) => {
    setDraft(structuredClone(plan)); setInitial(structuredClone(plan));
    setCycle(getPlanCycle(plan, plan.currency)); setError('');
  };
  const closeEditor = () => {
    if (saving) return;
    if (dirty) setConfirmDiscard(true); else setDraft(null);
  };
  const changePrice = (current: number, original: number | null) => {
    if (draft) setDraft(updatePackagePrice(draft, cycle, current, original));
    setError('');
  };
  const invalidate = async () => {
    await qc.invalidateQueries({ queryKey: ['subscription-plans'] });
    await qc.invalidateQueries({ queryKey: ['plan'] });
  };
  const save = async () => {
    if (!draft) return;
    if (isTrialPlan(draft.tier) && getPlanPrice(draft, draft.currency, cycle).current !== 0) { setError('The 7-day trial must remain free. Change a paid package to set pricing.'); return; }
    if (!draft.name.trim()) { setError('Enter a package name.'); return; }
    if (isNew && (!draft.tier || plans.some(p => p.tier === draft.tier))) { setError('Choose a unique package identifier.'); return; }
    const resolved = getPlanPrice(draft, draft.currency, cycle);
    if (![resolved.current, resolved.original ?? 0].every(v => Number.isFinite(v) && v >= 0)) { setError('Prices must be zero or greater.'); return; }
    if (resolved.original != null && resolved.original < resolved.current) { setError('The original price must be at least the package price.'); return; }
    if (!Number.isInteger(draft.sort_order) || LIMITS.some(([key]) => draft[key] != null && (!Number.isInteger(draft[key]) || draft[key]! < 0))) { setError('Display position and limits must be whole numbers, zero or greater.'); return; }
    setSaving(true); setError('');
    try {
      const normalized = updatePackagePrice(draft, cycle, resolved.current, resolved.original);
      const { id, created_at: createdAt, updated_at: updatedAt, ...fields } = normalized;
      void createdAt; void updatedAt;
      const prices: Record<string, Json> = {};
      for (const [currency, entry] of Object.entries(fields.prices ?? {})) prices[currency] = { ...entry };
      const payload = { ...fields, prices, name: fields.name.trim(), features: fields.features.map(f => f.trim()).filter(Boolean), features_heading: fields.features_heading?.trim() || null };
      const request = id
        ? supabase.from('subscription_plans').update(payload).eq('id', id).select().single()
        : supabase.from('subscription_plans').insert(payload).select().single();
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      await invalidate();
      setDraft(null); setInitial(null);
      toast.success(`${payload.name} ${id ? 'saved' : 'created'}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : typeof cause === 'object' && cause && 'message' in cause ? String(cause.message) : 'Could not save this package.');
    } finally { setSaving(false); }
  };
  const deletePackage = async () => {
    if (!draft?.id) return;
    setSaving(true);
    try {
      const { error: deleteError } = await supabase.from('subscription_plans').delete().eq('id', draft.id).select('id').single();
      if (deleteError) throw deleteError;
      await invalidate(); setDraft(null); setConfirmDelete(false); toast.success('Package deleted');
    } catch { setError('Could not delete this package. Please try again.'); setConfirmDelete(false); }
    finally { setSaving(false); }
  };
  const price = draft ? getPlanPrice(draft, draft.currency, cycle) : null;
  const term = draft ? planDurationMonths(draft.tier, cycle) : 1;
  const visible = plans.filter(p => p.is_active && p.is_public).length;

  return (
    <PlatformLayout>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Subscriptions</p>
            <h1 className="text-3xl font-semibold tracking-tight">Packages</h1>
            <p className="mt-2 text-sm text-muted-foreground">Your plans, prices and what each restaurant gets.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild><Link to="/pricing" target="_blank" rel="noopener noreferrer"><ArrowUpRight className="mr-2 h-4 w-4" /> View pricing page</Link></Button>
            <Button onClick={() => openEditor(blankPackage(plans[0]?.currency ?? 'BDT', Math.max(0, ...plans.map(p => p.sort_order)) + 10))}><Plus className="mr-2 h-4 w-4" /> New package</Button>
          </div>
        </header>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2"><Package className="h-4 w-4" /> {plans.length} packages</span>
          <span className="text-border">/</span>
          <span className="inline-flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {visible} on your pricing page</span>
        </div>
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Package overview">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-6 border-b bg-muted/40 px-6 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground md:grid">
            <span>Package</span><span>Total price</span><span>Visibility</span><span className="w-20">Manage</span>
          </div>
          {isLoading ? <div className="flex items-center gap-2 p-8 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading packages…</div>
            : isError ? <div className="space-y-3 p-8"><p>Could not load packages.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
            : plans.length === 0 ? <div className="space-y-3 p-10 text-center"><Package className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">Create your first package</h2><p className="text-sm text-muted-foreground">Start with a name and price, then choose what’s included.</p><Button onClick={() => openEditor(blankPackage('BDT', 10))}>New package</Button></div>
            : plans.map((plan, index) => {
              const planCycle = getPlanCycle(plan, plan.currency);
              const pricing = getPlanPrice(plan, plan.currency, planCycle);
              const months = planDurationMonths(plan.tier, planCycle);
              const published = plan.is_active && plan.is_public;
              return <article key={plan.id} aria-label={plan.name} className="grid items-center gap-4 border-b p-5 last:border-b-0 sm:p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:gap-6">
                <div className="flex min-w-0 items-center gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-medium text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{plan.name}</h2>{plan.badge && <Badge variant="secondary" className="text-[10px]">{plan.badge}</Badge>}</div><p className="mt-1 text-xs text-muted-foreground">{planTermLabel(plan.tier, planCycle)} · {FEATURES.filter(([key]) => plan[key]).length} tools enabled</p></div>
                </div>
                <div><p className="text-xl font-semibold tabular-nums">{packageMoney(plan.currency, pricing.current)}</p><p className="mt-1 text-xs text-muted-foreground">{pricing.savingsPct != null ? `Save ${pricing.savingsPct}% · ` : ''}for {planTermLabel(plan.tier, planCycle)}</p></div>
                <div><Badge variant="outline" className={published ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}>{published ? 'Published' : plan.is_active ? 'Private' : 'Inactive'}</Badge></div>
                <Button variant="outline" size="sm" className="w-fit md:w-20" onClick={() => openEditor(plan)} aria-label={`Edit ${plan.name}`}><Pencil className="mr-2 h-3.5 w-3.5" /> Edit</Button>
              </article>;
            })}
        </section>
        <p className="flex items-start gap-2 text-xs text-muted-foreground"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Prices shown are the total for the package duration. Changes go live when you save.</p>
      </div>

      <Dialog open={draft !== null} onOpenChange={open => { if (!open) closeEditor(); }}>
        <DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:p-0" onEscapeKeyDown={event => { if (saving) event.preventDefault(); }}>
          <DialogHeader className="border-b px-5 py-5 text-left sm:px-7">
            <DialogTitle>{isNew ? 'New package' : `Edit ${initial?.name}`}</DialogTitle>
            <DialogDescription>{isNew ? 'Create privately first, then publish when you’re ready.' : 'Update one package. Preview what customers will see before saving.'}</DialogDescription>
          </DialogHeader>
          {draft && price && <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_300px]">
            <Tabs defaultValue="details" className="min-w-0 p-5 sm:p-7">
              <TabsList className="mb-5 grid h-auto w-full grid-cols-3 p-1"><TabsTrigger value="details" className="px-2 py-2 text-xs sm:text-sm">Details & price</TabsTrigger><TabsTrigger value="access" className="px-2 py-2 text-xs sm:text-sm">Feature access</TabsTrigger><TabsTrigger value="website" className="px-2 py-2 text-xs sm:text-sm">Pricing card</TabsTrigger></TabsList>
              <TabsContent value="details" className="space-y-5">
                <Field label="Package name" value={draft.name} onChange={name => patch({ name, ...(isNew ? { tier: slugify(name) } : {}) })} placeholder="e.g. Monthly Plan" />
                <Field label="Description" value={draft.description ?? ''} onChange={description => patch({ description })} multiline />
                <div className="rounded-xl border bg-muted/30 p-4"><p className="text-sm font-medium">{planTermLabel(draft.tier, cycle)} of access</p><p className="mt-1 text-xs text-muted-foreground">Enter the total package price below, including any discount.</p></div>
                {isNew && <Field label="Package identifier" value={draft.tier} onChange={tier => patch({ tier: slugify(tier) })} hint="Use monthly, quarterly, biannual or yearly for a fixed-duration package, or a unique name for a monthly package." />}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Package price" value={String(price.current)} type="number" onChange={v => changePrice(Number(v), price.original)} />
                  <Field label="Original price (optional)" value={price.original == null ? '' : String(price.original)} type="number" placeholder="Without discount" onChange={v => changePrice(price.current, v === '' ? null : Number(v))} />
                  <label className="space-y-1.5"><span className="text-sm font-medium">Currency</span><select aria-label="Currency" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={draft.currency} onChange={event => {
                    const currency = event.target.value;
                    const next = { ...draft, currency };
                    const entry = draft.prices?.[currency];
                    setDraft(updatePackagePrice(next, cycle, entry ? Number(cycle === 'monthly' ? entry.monthly : entry.yearly) : price.current, entry ? (cycle === 'monthly' ? entry.original_monthly : entry.original_yearly) : price.original));
                  }}>{SUPPORTED_CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} — {c.name}</option>)}</select></label>
                  <Field label="Display position" type="number" value={String(draft.sort_order)} onChange={v => patch({ sort_order: Number(v) })} hint="Lower numbers appear first." />
                </div>
                {isNew && <label className="block space-y-1.5"><span className="text-sm font-medium">Billing period</span><select aria-label="Billing period" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={cycle} onChange={event => {
                  const nextCycle = event.target.value as BillingCycle;
                  setCycle(nextCycle);
                  const next = { ...draft, price_monthly: 0, price_yearly: 0, original_price_monthly: null, original_price_yearly: null, prices: {} };
                  setDraft(updatePackagePrice(next, nextCycle, price.current, price.original));
                }}><option value="monthly">Monthly / multi-month package</option><option value="yearly">Yearly package</option></select></label>}
                <Toggle label="Most popular badge" hint="Highlight this package on the pricing page." checked={!!draft.badge?.toLowerCase().includes('popular')} onChange={v => patch({ badge: v ? 'Most popular' : null })} />
                <div className="space-y-3 border-t pt-5"><Toggle label="Show on pricing page" hint="Make this package visible to customers." checked={draft.is_public} onChange={is_public => patch({ is_public })} /><Toggle label="Accept new subscriptions" hint="Inactive packages are hidden and cannot be purchased." checked={draft.is_active} onChange={is_active => patch({ is_active })} /></div>
              </TabsContent>
              <TabsContent value="access" className="space-y-6">
                <div><h3 className="font-semibold">Included tools</h3><p className="mt-1 text-xs text-muted-foreground">These switches control what restaurants can use.</p></div>
                <div className="grid gap-3 sm:grid-cols-2">{FEATURES.map(([key, label]) => <Toggle key={key} label={label} checked={draft[key]} onChange={value => patch({ [key]: value })} />)}</div>
                <div className="border-t pt-5"><h3 className="font-semibold">Usage limits</h3><p className="mt-1 text-xs text-muted-foreground">Leave a field empty for unlimited access.</p></div>
                <div className="grid gap-4 sm:grid-cols-2">{LIMITS.map(([key, label]) => <Field key={key} label={label} type="number" value={draft[key] == null ? '' : String(draft[key])} placeholder="Unlimited" onChange={v => patch({ [key]: v === '' ? null : Number(v) })} />)}</div>
              </TabsContent>
              <TabsContent value="website" className="space-y-5">
                <div><h3 className="font-semibold">What customers see</h3><p className="mt-1 text-xs text-muted-foreground">Edit the text displayed on the pricing card. Tool access is controlled in the Feature access tab.</p></div>
                <Toggle label="Show included features" checked={draft.features_visible} onChange={features_visible => patch({ features_visible })} />
                <Field label="Feature list heading" value={draft.features_heading ?? ''} placeholder="What's included" onChange={features_heading => patch({ features_heading })} />
                <Field label="Displayed features" value={draft.features.join('\n')} onChange={v => patch({ features: v.split('\n') })} multiline rows={12} hint="One feature per line. Leave empty to use the website’s default list." />
                {draft.id && draft.tier !== 'free' && !isTrialPlan(draft.tier) && <div className="border-t pt-5"><Button variant="ghost" className="text-destructive hover:text-destructive" disabled={saving} onClick={() => setConfirmDelete(true)}><Trash2 className="mr-2 h-4 w-4" /> Delete package</Button></div>}
              </TabsContent>
            </Tabs>
            <aside className="border-t bg-muted/30 p-5 sm:p-7 lg:border-l lg:border-t-0">
              <p className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Eye className="h-4 w-4" /> Customer preview</p>
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                {draft.badge && <Badge className="mb-3">{draft.badge}</Badge>}
                {price.savingsPct != null && <p className="mb-2 text-xs font-medium text-emerald-700">Save {price.savingsPct}%</p>}
                <h3 className="text-lg font-semibold">{draft.name || 'Package name'}</h3><p className="mt-2 text-xs text-muted-foreground">{draft.description || 'Your package description'}</p>
                {price.original != null && price.original > price.current && <p className="mt-5 text-sm text-muted-foreground line-through">{packageMoney(draft.currency, price.original)}</p>}
                <p className="mt-3 text-3xl font-bold tabular-nums">{isTrialPlan(draft.tier) ? 'Free' : packageMoney(draft.currency, price.current)} <span className="text-xs font-normal text-muted-foreground">{planTermSuffix(draft.tier, cycle)}</span></p>
                {price.savings != null && <p className="mt-2 text-xs text-emerald-700">You save {packageMoney(draft.currency, price.savings)}</p>}
                <div className="my-5 rounded-full bg-primary py-2.5 text-center text-sm font-medium text-primary-foreground">{isTrialPlan(draft.tier) ? 'Start free trial' : 'Get this plan'}</div>
                {draft.features_visible && <div className="border-t pt-4"><h4 className="mb-3 text-xs font-semibold">{draft.features_heading || "What's included"}</h4><ul className="space-y-2 text-xs">{(draft.features.some(f => f.trim()) ? draft.features.filter(f => f.trim()) : ['Website default feature list']).map((feature, i) => <li key={i} className="flex items-start gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />{feature}</li>)}</ul></div>}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">{draft.is_public && draft.is_active ? 'Visible on the pricing page after saving.' : 'Private — customers will not see this package.'}</p>
            </aside>
          </div>}
          <DialogFooter className="flex-col items-stretch justify-between gap-3 border-t bg-background px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7">
            <p className="text-xs text-muted-foreground">{error ? <span role="alert" className="text-destructive">{error}</span> : isNew ? 'Not created yet' : dirty ? 'Unsaved changes' : 'All changes saved'}</p>
            <div className="flex shrink-0 items-center justify-end gap-2"><Button variant="outline" onClick={closeEditor} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || (!isNew && !dirty)}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{isNew ? 'Create package' : 'Save changes'}</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your saved package will stay as it is.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={() => { setConfirmDiscard(false); setDraft(null); }}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {draft?.name}?</AlertDialogTitle><AlertDialogDescription>This removes the package from sale. Restaurants using it may lose their feature configuration. Consider making it inactive instead.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep package</AlertDialogCancel><AlertDialogAction disabled={saving} className="bg-destructive hover:bg-destructive/90" onClick={event => { event.preventDefault(); void deletePackage(); }}>Delete package</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </PlatformLayout>
  );
}

function Field({ label, value, onChange, type = 'text', placeholder, hint, multiline, rows = 3 }: { label: string; value: string; onChange: (value: string) => void; type?: string; placeholder?: string; hint?: string; multiline?: boolean; rows?: number }) {
  const id = useId();
  return <div className="space-y-1.5"><Label htmlFor={id}>{label}</Label>{multiline ? <Textarea id={id} value={value} onChange={event => onChange(event.target.value)} rows={rows} /> : <Input id={id} type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return <div className="flex items-center justify-between gap-3 rounded-xl border p-3"><div><Label htmlFor={id} className="cursor-pointer text-sm">{label}</Label>{hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}</div><Switch id={id} checked={checked} onCheckedChange={onChange} /></div>;
}
