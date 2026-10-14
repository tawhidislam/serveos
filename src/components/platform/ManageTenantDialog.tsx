import { edgeFunctionError } from '@/lib/edge-function-error';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Trash2, Crown, CalendarClock } from 'lucide-react';
import { format, formatDistanceToNowStrict, isBefore } from 'date-fns';
import CustomDomainCard from './CustomDomainCard';
import DomainRequestsTab from './DomainRequestsTab';
import { usePlatformThemes } from '@/hooks/usePlatformThemes';
import { useSubscriptionPlans } from '@/hooks/useSubscriptionPlans';

interface Tenant {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  currentPlan: string;
  currentStatus: string;
  customDomain: string | null;
  customDomainVerified: boolean;
}

interface Props {
  tenant: Tenant | null;
  onClose: () => void;
}

// Plan options are loaded dynamically from `subscription_plans` so platform
// admins always see the live list (including newly added or inactive tiers).
const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'trialing', label: 'Trialing' },
  { value: 'past_due', label: 'Past due' },
  { value: 'canceled', label: 'Canceled' },
  { value: 'expired', label: 'Expired' },
];

/** ISO timestamp -> "YYYY-MM-DDTHH:mm" for <input type="datetime-local">. */
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function addDaysISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function callManage(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('platform-manage-tenant', {
    body: payload,
  });
  if (error) throw await edgeFunctionError(error);
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as any;
}

export default function ManageTenantDialog({ tenant, onClose }: Props) {
  const qc = useQueryClient();
  const open = !!tenant;
  const [section, setSection] = useState('plan');

  // Plan tab state
  const [plan, setPlan] = useState(tenant?.currentPlan ?? 'free');
  const [status, setStatus] = useState(tenant?.currentStatus ?? 'active');
  const [periodEnd, setPeriodEnd] = useState<string>(''); // datetime-local string
  const [planSaving, setPlanSaving] = useState(false);

  // Dynamic plan options pulled from the platform's subscription_plans table.
  const { data: allPlans = [], isLoading: plansLoading } = useSubscriptionPlans();
  const planOptions = [
    // Always show the current tenant tier even if it's now inactive/missing.
    ...(tenant?.currentPlan && !allPlans.some((p) => p.tier === tenant.currentPlan)
      ? [{ value: tenant.currentPlan, label: `${tenant.currentPlan} (legacy)`, isActive: false, isPublic: false }]
      : []),
    ...allPlans
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((p) => ({
        value: p.tier,
        label: `${p.name}${!p.is_active ? ' (inactive)' : !p.is_public ? ' (hidden)' : ''}`,
        isActive: p.is_active,
        isPublic: p.is_public,
      })),
  ];

  // Password tab state
  const [newPwd, setNewPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);

  // Transfer tab state
  const [transferEmail, setTransferEmail] = useState('');
  const [transferSaving, setTransferSaving] = useState(false);

  const { data: members, isLoading: loadingMembers, refetch: refetchMembers } = useQuery({
    queryKey: ['platform-tenant-members', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const res = await callManage({ action: 'list_members', tenantId: tenant!.id });
      return (res?.members ?? []) as Array<{
        userId: string; email: string | null; displayName: string | null;
        roles: string[]; isOwner: boolean; joinedAt: string;
      }>;
    },
  });

  // Load current subscription details (incl. expiry)
  const { data: sub } = useQuery({
    queryKey: ['platform-tenant-subscription', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('restaurant_id', tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { plan: string; status: string; current_period_end: string | null } | null;
    },
  });

  // Load assigned theme id directly from the restaurants row.
  const { data: tenantRow } = useQuery({
    queryKey: ['platform-tenant-row', tenant?.id],
    enabled: !!tenant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('theme_id')
        .eq('id', tenant!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { theme_id: string | null } | null;
    },
  });

  const { data: themes } = usePlatformThemes({ activeOnly: true });

  const [themeId, setThemeId] = useState<string>('none');
  const [themeSaving, setThemeSaving] = useState(false);

  useEffect(() => {
    setThemeId(tenantRow?.theme_id ?? 'none');
  }, [tenantRow?.theme_id, tenant?.id]);

  useEffect(() => {
    setPlan(sub?.plan ?? tenant?.currentPlan ?? 'free');
    setStatus(sub?.status ?? tenant?.currentStatus ?? 'active');
  }, [tenant?.id, tenant?.currentPlan, tenant?.currentStatus, sub?.plan, sub?.status]);

  // Hydrate the period-end input once the subscription loads
  useEffect(() => {
    setPeriodEnd(toLocalInput(sub?.current_period_end));
  }, [sub?.current_period_end, tenant?.id]);

  const handleThemeSave = async () => {
    if (!tenant) return;
    setThemeSaving(true);
    try {
      await callManage({ action: 'assign_theme', tenantId: tenant.id, themeId: themeId === 'none' ? null : themeId });
      toast.success('Theme assigned');
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-tenant-row', tenant.id] });
      qc.invalidateQueries({ queryKey: ['platform-theme'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to assign theme');
    } finally {
      setThemeSaving(false);
    }
  };

  const handlePlanSave = async () => {
    if (!tenant) return;
    setPlanSaving(true);
    try {
      const payload: Record<string, unknown> = {
        action: 'change_plan',
        tenantId: tenant.id,
        plan,
        status,
        // Send null to clear, ISO string to set, omit to leave unchanged.
        currentPeriodEnd: periodEnd ? new Date(periodEnd).toISOString() : null,
      };
      await callManage(payload);
      toast.success(`Plan updated to ${plan}`);
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      qc.invalidateQueries({ queryKey: ['platform-overview'] });
      qc.invalidateQueries({ queryKey: ['platform-tenant-subscription', tenant.id] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update plan');
    } finally {
      setPlanSaving(false);
    }
  };

  const handlePwdReset = async () => {
    if (!tenant) return;
    if (newPwd.length < 8) { toast.error('Password must be ≥ 8 chars'); return; }
    setPwdSaving(true);
    try {
      await callManage({
        action: 'reset_owner_password', tenantId: tenant.id, newPassword: newPwd,
      });
      toast.success('Owner password reset', { description: 'Share the new password securely.' });
      setNewPwd('');
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to reset password');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!tenant) return;
    try {
      await callManage({ action: 'remove_member', tenantId: tenant.id, userId });
      toast.success('Member removed');
      refetchMembers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove member');
    }
  };

  const handleTransfer = async () => {
    if (!tenant) return;
    if (!transferEmail.trim()) return;
    setTransferSaving(true);
    try {
      await callManage({
        action: 'transfer_ownership', tenantId: tenant.id, newOwnerEmail: transferEmail.trim(),
      });
      toast.success('Ownership transferred');
      setTransferEmail('');
      qc.invalidateQueries({ queryKey: ['platform-tenants'] });
      refetchMembers();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to transfer ownership');
    } finally {
      setTransferSaving(false);
    }
  };

  return (
    <Dialog
      key={tenant?.id ?? 'none'}
      open={open}
      onOpenChange={(o) => { if (!o) onClose(); }}
    >
      <DialogContent className="sm:max-w-2xl max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage {tenant?.name}</DialogTitle>
          <DialogDescription>
            Choose a section below to manage this restaurant.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={section} onValueChange={setSection} className="mt-2">
          <label className="block space-y-2 border-b pb-5">
            <span className="text-sm font-medium">What would you like to manage?</span>
            <select aria-label="Management section" value={section} onChange={event => setSection(event.target.value)} className="h-11 w-full rounded-md border bg-background px-3 text-sm">
              <optgroup label="Subscription"><option value="plan">Package, billing status & expiry</option></optgroup>
              <optgroup label="People"><option value="members">Staff accounts</option><option value="password">Owner password</option><option value="owner">Transfer ownership</option></optgroup>
              <optgroup label="Website"><option value="theme">Website theme</option><option value="domain">Custom domain</option><option value="requests">Domain requests</option></optgroup>
            </select>
          </label>

          {/* PLAN */}
          <TabsContent value="plan" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tenant-package">Package</Label>
                <Select value={plan} onValueChange={setPlan} disabled={plansLoading}>
                  <SelectTrigger id="tenant-package">
                    <SelectValue placeholder={plansLoading ? 'Loading plans…' : 'Select plan'} />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.length === 0 && !plansLoading && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        No plans configured
                      </div>
                    )}
                    {planOptions.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        <span className="flex items-center gap-2">
                          {p.label}
                          {p.value === tenant?.currentPlan && (
                            <Badge variant="secondary" className="h-4 text-[10px] px-1.5">current</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Plans are managed in <span className="font-medium">Platform → Packages</span>.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tenant-subscription-status">Subscription status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="tenant-subscription-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Expiry / period end */}
            <div className="space-y-1.5 rounded-md border border-border p-3">
              <Label htmlFor="period-end" className="flex items-center gap-1.5">
                <CalendarClock className="h-3.5 w-3.5" />
                Subscription expiry
              </Label>
              <Input
                id="period-end"
                type="datetime-local"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
              />
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-xs text-muted-foreground mr-1">Quick set:</span>
                {[
                  { label: '+7d', days: 7 },
                  { label: '+30d', days: 30 },
                  { label: '+90d', days: 90 },
                  { label: '+1y', days: 365 },
                ].map((p) => (
                  <Button
                    key={p.label}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-6 text-[11px] px-2"
                    onClick={() => setPeriodEnd(toLocalInput(addDaysISO(p.days)))}
                  >
                    {p.label}
                  </Button>
                ))}
                {periodEnd && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 text-muted-foreground"
                    onClick={() => setPeriodEnd('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
              {sub?.current_period_end ? (
                <p className="text-xs text-muted-foreground">
                  Currently expires {format(new Date(sub.current_period_end), 'MMM d, yyyy · HH:mm')}
                  {' · '}
                  {isBefore(new Date(sub.current_period_end), new Date())
                    ? <span className="text-destructive">expired {formatDistanceToNowStrict(new Date(sub.current_period_end))} ago</span>
                    : <span>in {formatDistanceToNowStrict(new Date(sub.current_period_end))}</span>}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No expiry set (subscription does not auto-downgrade).</p>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium">{allPlans.find(p => p.tier === (sub?.plan ?? tenant?.currentPlan))?.name ?? sub?.plan ?? tenant?.currentPlan}</span> · {sub?.status ?? tenant?.currentStatus}
            </p>
            <div className="flex justify-end">
              <Button onClick={handlePlanSave} disabled={planSaving}>
                {planSaving ? 'Saving…' : 'Save subscription'}
              </Button>
            </div>
          </TabsContent>

          {/* THEME */}
          <TabsContent value="theme" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>Custom theme</Label>
              <Select value={themeId} onValueChange={setThemeId}>
                <SelectTrigger><SelectValue placeholder="No theme (default branding)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No theme (default branding)</SelectItem>
                  {(themes ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Applied to this tenant's public website (colors, fonts, radius, button style, homepage template).
              </p>
            </div>

            {themeId !== 'none' && (() => {
              const t = themes?.find((x) => x.id === themeId);
              if (!t) return null;
              const c = t.tokens.colors ?? {};
              return (
                <div
                  className="rounded-md border p-4 space-y-2"
                  style={{ backgroundColor: c.bg_primary, color: c.text_primary }}
                >
                  <div className="text-xs uppercase tracking-widest opacity-70">{t.key}</div>
                  <div className="text-lg font-semibold" style={{ fontFamily: t.tokens.fonts?.heading_family }}>
                    {t.name}
                  </div>
                  <div className="flex gap-2 items-center">
                    <span
                      className="px-3 py-1 text-xs font-medium"
                      style={{ backgroundColor: c.accent, color: c.bg_primary, borderRadius: t.tokens.radius }}
                    >
                      Button preview
                    </span>
                    <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.accent_light }} />
                    <span className="h-5 w-5 rounded-full" style={{ backgroundColor: c.bg_secondary }} />
                  </div>
                </div>
              );
            })()}

            <div className="flex justify-end">
              <Button onClick={handleThemeSave} disabled={themeSaving}>
                {themeSaving ? 'Saving…' : 'Assign theme'}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="domain" className="space-y-4 pt-4">
            {tenant && (
              <CustomDomainCard
                restaurantId={tenant.id}
                unlocked
                canMarkVerified
                embedded
                onChanged={() => qc.invalidateQueries({ queryKey: ['platform-tenants'] })}
              />
            )}
          </TabsContent>

          {/* DOMAIN REQUESTS */}
          <TabsContent value="requests" className="space-y-4 pt-4">
            {tenant && <DomainRequestsTab restaurantId={tenant.id} />}
          </TabsContent>

          {/* PASSWORD */}
          <TabsContent value="password" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-pwd">New owner password</Label>
              <Input
                id="new-pwd"
                type="text"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="Min 8 characters"
                minLength={8}
              />
              <p className="text-xs text-muted-foreground">
                Resets the password for the restaurant owner. Share it securely.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handlePwdReset} disabled={pwdSaving || newPwd.length < 8}>
                {pwdSaving ? 'Resetting…' : 'Reset password'}
              </Button>
            </div>
          </TabsContent>

          {/* MEMBERS */}
          <TabsContent value="members" className="space-y-3 pt-4">
            {loadingMembers ? (
              <div className="py-8 flex justify-center">
                <div className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : (members?.length ?? 0) === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">No members</div>
            ) : (
              <div className="divide-y divide-border rounded-md border border-border">
                {members!.map((m) => (
                  <div key={m.userId} className="p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm truncate">
                          {m.displayName && m.displayName !== m.email ? m.displayName : m.isOwner ? 'Restaurant owner' : 'Staff account'}
                        </p>
                        {m.isOwner && (
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Crown className="h-3 w-3" /> Owner
                          </Badge>
                        )}
                        {m.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-[10px] uppercase">{r}</Badge>
                        ))}
                      </div>
                      {m.email && <p className="text-xs text-muted-foreground truncate">{m.email}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(m.userId)}
                      disabled={m.isOwner}
                      className="text-destructive hover:text-destructive"
                      title={m.isOwner ? 'Transfer ownership first' : 'Remove member'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* OWNER TRANSFER */}
          <TabsContent value="owner" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="transfer-email">New owner email</Label>
              <Input
                id="transfer-email"
                type="email"
                value={transferEmail}
                onChange={(e) => setTransferEmail(e.target.value)}
                placeholder="newowner@example.com"
              />
              <p className="text-xs text-muted-foreground">
                User must already exist. They'll be granted owner role and become the tenant's owner.
                The previous owner stays a member until removed.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleTransfer} disabled={transferSaving || !transferEmail.trim()}>
                {transferSaving ? 'Transferring…' : 'Transfer ownership'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
