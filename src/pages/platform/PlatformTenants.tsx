import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Building2, ChevronLeft, ChevronRight, ExternalLink, Eye, Loader2, MoreHorizontal, Pause, Play, Plus, Search, Settings2, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';
import { edgeFunctionError } from '@/lib/edge-function-error';
import CreateTenantDialog from '@/components/platform/CreateTenantDialog';
import ManageTenantDialog from '@/components/platform/ManageTenantDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

const statusLabels: Record<string, string> = { active: 'Active', trialing: 'Trial', past_due: 'Payment overdue', canceled: 'Canceled', expired: 'Expired' };
const dateLabel = (date: string) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Shanghai' });
const planLabel = (tier: string, names: Map<string, string>) => names.get(tier) ?? (tier === 'free' ? 'Free / legacy' : tier.replace(/[_-]/g, ' '));

type ManagedTenant = { id: string; name: string; slug: string; owner_id: string | null; currentPlan: string; currentStatus: string; customDomain: string | null; customDomainVerified: boolean };
type PendingAction = { id: string; name: string; kind: 'suspend' | 'reactivate' | 'delete' };

export default function PlatformTenants() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { startImpersonation, isSwitching } = useImpersonation();
  const { data: packages = [] } = useSubscriptionPlans();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [packageFilter, setPackageFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const [page, setPage] = useState(1);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [deleteName, setDeleteName] = useState('');
  const [manageTenant, setManageTenant] = useState<ManagedTenant | null>(null);

  const { data: tenants = [], isLoading, isError, refetch } = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants')
        .select('id, name, slug, owner_id, is_active, created_at, custom_domain, custom_domain_verified, subscriptions(plan, status, current_period_end)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  type Restaurant = typeof tenants[number];
  const subscription = (restaurant: Restaurant) => Array.isArray(restaurant.subscriptions) ? restaurant.subscriptions[0] : restaurant.subscriptions;
  const names = new Map(packages.map(plan => [plan.tier, plan.name]));
  const packageOptions = [...new Set(tenants.map(tenant => subscription(tenant)?.plan).filter((plan): plan is string => !!plan))];
  const query = search.trim().toLowerCase();
  const filtered = tenants.filter(tenant => {
    const sub = subscription(tenant);
    return [tenant.name, tenant.slug, tenant.custom_domain ?? ''].some(value => value.toLowerCase().includes(query))
      && (statusFilter === 'all' || (statusFilter === 'active' ? tenant.is_active : !tenant.is_active))
      && (packageFilter === 'all' || (packageFilter === 'none' ? !sub : sub?.plan === packageFilter));
  }).sort((a, b) => sort === 'name' ? a.name.localeCompare(b.name) : sort === 'oldest' ? Date.parse(a.created_at) - Date.parse(b.created_at) : Date.parse(b.created_at) - Date.parse(a.created_at));
  const pageCount = Math.max(1, Math.ceil(filtered.length / 10));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * 10, currentPage * 10);
  const activeCount = tenants.filter(tenant => tenant.is_active).length;
  const hasFilters = !!search || statusFilter !== 'all' || packageFilter !== 'all';
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); setPackageFilter('all'); setPage(1); };
  const requestAction = (action: PendingAction) => { setPending(action); setDeleteName(''); setActionError(''); };
  const runAction = async () => {
    if (!pending) return;
    if (pending.kind === 'delete' && deleteName !== pending.name) return;
    setBusy(true); setActionError('');
    try {
      const { data, error } = await supabase.functions.invoke('platform-manage-tenant', {
        body: pending.kind === 'delete' ? { action: 'delete_tenant', tenantId: pending.id }
          : { action: 'set_active', tenantId: pending.id, isActive: pending.kind === 'reactivate' },
      });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);
      await qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      await qc.invalidateQueries({ queryKey: ['platform-overview'] });
      toast.success(pending.kind === 'delete' ? 'Restaurant deleted' : pending.kind === 'suspend' ? 'Restaurant suspended' : 'Restaurant reactivated');
      setPending(null);
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not update the restaurant.'); }
    finally { setBusy(false); }
  };
  const viewAsOwner = async (tenant: { id: string; name: string }) => {
    if (isSwitching) return;
    try { await startImpersonation(tenant.id, tenant.name); navigate('/owner'); }
    catch { toast.error('Could not open the owner dashboard. Please try again.'); }
  };
  const manage = (tenant: Restaurant) => {
    const sub = subscription(tenant);
    setManageTenant({ id: tenant.id, name: tenant.name, slug: tenant.slug, owner_id: tenant.owner_id,
      currentPlan: sub?.plan ?? 'free', currentStatus: sub?.status ?? 'active',
      customDomain: tenant.custom_domain, customDomainVerified: !!tenant.custom_domain_verified });
  };

  return <PlatformLayout>
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Tenant management</p><h1 className="text-3xl font-semibold tracking-tight">Restaurants</h1><p className="mt-2 text-sm text-muted-foreground">Manage restaurant access, subscriptions and owner accounts.</p></div>
        <CreateTenantDialog trigger={<Button><Plus className="mr-2 h-4 w-4" /> Add restaurant</Button>} />
      </header>
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        {[{ label: 'Total restaurants', count: tenants.length }, { label: 'Active', count: activeCount }, { label: 'Suspended', count: tenants.length - activeCount }].map(stat => <div key={stat.label} className="rounded-xl border bg-card p-4 sm:p-5"><p className="text-xs text-muted-foreground">{stat.label}</p><p className="mt-2 text-2xl font-semibold tabular-nums">{isLoading ? '—' : stat.count}</p></div>)}
      </div>
      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm" aria-label="Restaurant directory">
        <div className="space-y-4 border-b p-4 sm:p-5">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-0 flex-1 basis-full lg:basis-64"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search restaurants" placeholder="Search restaurant name, URL or domain" className="pl-9" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} /></div>
            <select aria-label="Restaurant status" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm lg:flex-none" value={statusFilter} onChange={event => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">All statuses</option><option value="active">Active restaurants</option><option value="suspended">Suspended restaurants</option></select>
            <select aria-label="Package filter" className="h-10 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm lg:flex-none" value={packageFilter} onChange={event => { setPackageFilter(event.target.value); setPage(1); }}><option value="all">All packages</option><option value="none">No subscription</option>{packageOptions.map(tier => <option key={tier} value={tier}>{planLabel(tier, names)}</option>)}</select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground"><span>{filtered.length} of {tenants.length} restaurants{hasFilters && <button className="ml-3 inline-flex items-center gap-1 font-medium text-primary hover:underline" onClick={clearFilters}><X className="h-3 w-3" /> Clear filters</button>}</span><label className="flex items-center gap-2">Sort by<select aria-label="Sort restaurants" className="bg-transparent text-xs font-medium text-foreground" value={sort} onChange={event => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name">Name A–Z</option></select></label></div>
        </div>
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-5 border-b bg-muted/30 px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid"><span>Restaurant</span><span>Restaurant status</span><span>Subscription</span><span className="w-36">Actions</span></div>
        {isLoading ? <div className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading restaurants…</div>
          : isError ? <div className="space-y-3 p-10 text-center"><p>Could not load your restaurants.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
          : visible.length === 0 ? <div className="space-y-3 p-10 text-center"><Building2 className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">{hasFilters ? 'No matching restaurants' : 'Add your first restaurant'}</h2><p className="text-sm text-muted-foreground">{hasFilters ? 'Try a different name or adjust the filters.' : 'Create a restaurant and its owner account to get started.'}</p>{hasFilters && <Button variant="outline" onClick={clearFilters}>Clear filters</Button>}</div>
          : visible.map(tenant => {
            const sub = subscription(tenant);
            const expired = sub?.current_period_end && Date.parse(sub.current_period_end) < Date.now();
            const subStatus = expired && ['active', 'trialing'].includes(sub?.status ?? '') ? 'expired' : sub?.status;
            return <article key={tenant.id} aria-label={tenant.name} className="grid items-center gap-4 border-b p-5 last:border-b-0 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.5fr)_auto] lg:gap-5">
              <div className="flex min-w-0 items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-sm font-semibold text-primary">{tenant.name.slice(0, 2).toUpperCase()}</span><div className="min-w-0"><h2 className="break-words font-semibold">{tenant.name}</h2><a href={`/r/${tenant.slug}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-primary"><span className="truncate">/r/{tenant.slug}</span><ExternalLink className="h-3 w-3 shrink-0" /></a>{tenant.custom_domain && <p className="mt-1 break-all text-xs text-muted-foreground">{tenant.custom_domain} · {tenant.custom_domain_verified ? 'Verified' : 'Verification pending'}</p>}<p className="mt-1 text-[11px] text-muted-foreground">Joined {dateLabel(tenant.created_at)}</p></div></div>
              <div><Badge variant="outline" className={tenant.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${tenant.is_active ? 'bg-emerald-500' : 'bg-amber-500'}`} />{tenant.is_active ? 'Active' : 'Suspended'}</Badge></div>
              <div className="min-w-0"><p className="text-sm font-medium">{sub ? planLabel(sub.plan, names) : 'No subscription'}</p><p className={`mt-1 text-xs ${subStatus === 'expired' || subStatus === 'past_due' ? 'text-amber-700' : 'text-muted-foreground'}`}>{subStatus ? statusLabels[subStatus] ?? subStatus : 'No package assigned'}{sub?.current_period_end ? ` · ${expired ? 'Expired' : 'Until'} ${dateLabel(sub.current_period_end)}` : ''}</p></div>
              <div className="flex w-36 items-center justify-between gap-2"><Button variant="outline" size="sm" onClick={() => manage(tenant)} aria-label={`Manage ${tenant.name}`}><Settings2 className="mr-2 h-3.5 w-3.5" /> Manage</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`More actions for ${tenant.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuItem disabled={isSwitching} onSelect={() => viewAsOwner(tenant)}><Eye className="mr-2 h-4 w-4" /> View as owner</DropdownMenuItem><DropdownMenuItem asChild><a href={`/r/${tenant.slug}/menu`} target="_blank" rel="noopener noreferrer"><ExternalLink className="mr-2 h-4 w-4" /> Open public menu</a></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => requestAction({ id: tenant.id, name: tenant.name, kind: tenant.is_active ? 'suspend' : 'reactivate' })}>{tenant.is_active ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}{tenant.is_active ? 'Suspend restaurant' : 'Reactivate restaurant'}</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => requestAction({ id: tenant.id, name: tenant.name, kind: 'delete' })}><Trash2 className="mr-2 h-4 w-4" /> Delete restaurant</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div>
            </article>;
          })}
        {filtered.length > 10 && <div className="flex items-center justify-between border-t px-5 py-4 text-xs text-muted-foreground"><span>Page {currentPage} of {pageCount}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft className="mr-1 h-4 w-4" /> Previous</Button><Button variant="outline" size="sm" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next <ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>}
      </section>
      <p className="text-xs text-muted-foreground">Restaurant status controls availability. Subscription status shows its billing access.</p>
    </div>
    <AlertDialog open={pending !== null} onOpenChange={open => { if (!open && !busy) setPending(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.kind === 'delete' ? 'Delete' : pending?.kind === 'suspend' ? 'Suspend' : 'Reactivate'} {pending?.name}?</AlertDialogTitle><AlertDialogDescription>{pending?.kind === 'delete' ? 'This permanently removes the restaurant, menu, orders and related restaurant data. The owner login account is kept.' : pending?.kind === 'suspend' ? 'The restaurant will become unavailable to customers. You can reactivate it later.' : 'The restaurant will become available to customers again. Its subscription will stay as it is.'}</AlertDialogDescription></AlertDialogHeader>{pending?.kind === 'delete' && <label className="space-y-2 text-sm">Type <strong>{pending.name}</strong> to confirm<Input aria-label="Restaurant name to confirm deletion" value={deleteName} onChange={event => setDeleteName(event.target.value)} /></label>}{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy || (pending?.kind === 'delete' && deleteName !== pending.name)} className={pending?.kind === 'delete' ? 'bg-destructive hover:bg-destructive/90' : ''} onClick={event => { event.preventDefault(); void runAction(); }}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{pending?.kind === 'delete' ? 'Delete restaurant' : pending?.kind === 'suspend' ? 'Suspend restaurant' : 'Reactivate restaurant'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <ManageTenantDialog key={manageTenant?.id ?? 'none'} tenant={manageTenant} onClose={() => setManageTenant(null)} />
  </PlatformLayout>;
}
