import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Globe, Search, Plus, Trash2, Pencil, Link2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type PoolStatus = 'available' | 'assigned' | 'reserved' | 'retired';

type PoolRow = {
  id: string;
  subdomain: string;
  status: PoolStatus;
  assigned_restaurant_id: string | null;
  assigned_at: string | null;
  notes: string | null;
  created_at: string;
};

type RestaurantLookup = Record<string, { name: string; slug: string }>;

const SUB_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

const STATUS_META: Record<PoolStatus, { label: string; cls: string }> = {
  available: { label: 'Available', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  assigned:  { label: 'Assigned',  cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' },
  reserved:  { label: 'Reserved',  cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' },
  retired:   { label: 'Retired',   cls: 'bg-muted text-muted-foreground' },
};

export default function PlatformSubdomains() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PoolStatus>('all');

  const [newSubdomain, setNewSubdomain] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [adding, setAdding] = useState(false);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PoolRow | null>(null);
  const [editing, setEditing] = useState<PoolRow | null>(null);
  const [editSub, setEditSub] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [assigning, setAssigning] = useState<PoolRow | null>(null);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignTarget, setAssignTarget] = useState<string>('');
  const [savingAssign, setSavingAssign] = useState(false);

  const { data: rows, isLoading } = useQuery<PoolRow[]>({
    queryKey: ['platform-subdomain-pool'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subdomain_pool')
        .select('id, subdomain, status, assigned_restaurant_id, assigned_at, notes, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PoolRow[];
    },
  });

  const { data: restaurants } = useQuery<RestaurantLookup>({
    queryKey: ['platform-subdomain-pool-restaurants', rows?.length ?? 0],
    enabled: !!rows && rows.some((r) => r.assigned_restaurant_id),
    queryFn: async () => {
      const ids = Array.from(new Set((rows ?? []).map((r) => r.assigned_restaurant_id).filter(Boolean) as string[]));
      if (!ids.length) return {};
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .in('id', ids);
      if (error) throw error;
      const out: RestaurantLookup = {};
      for (const r of data ?? []) out[r.id] = { name: r.name, slug: r.slug };
      return out;
    },
  });

  const { data: allRestaurants, isLoading: loadingRestaurants } = useQuery<{ id: string; name: string; slug: string }[]>({
    queryKey: ['platform-all-restaurants'],
    enabled: !!assigning,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const assignCandidates = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    const list = allRestaurants ?? [];
    if (!q) return list.slice(0, 50);
    return list
      .filter((r) => r.name.toLowerCase().includes(q) || r.slug.toLowerCase().includes(q))
      .slice(0, 50);
  }, [allRestaurants, assignSearch]);



  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        r.subdomain.toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<PoolStatus | 'all', number> = {
      all: 0, available: 0, assigned: 0, reserved: 0, retired: 0,
    };
    for (const r of rows ?? []) {
      c.all += 1;
      c[r.status] += 1;
    }
    return c;
  }, [rows]);

  async function addEntry() {
    const sub = newSubdomain.trim().toLowerCase();
    if (!SUB_RE.test(sub)) {
      toast.error('Invalid subdomain — use lowercase letters, numbers, and hyphens only.');
      return;
    }
    setAdding(true);
    const { error } = await supabase.from('subdomain_pool').insert({
      subdomain: sub,
      status: 'available',
      notes: newNotes.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message.includes('duplicate') ? 'That subdomain is already in the pool.' : error.message);
      return;
    }
    toast.success(`Added "${sub}" to the pool`);
    setNewSubdomain('');
    setNewNotes('');
    qc.invalidateQueries({ queryKey: ['platform-subdomain-pool'] });
  }

  async function updateStatus(row: PoolRow, status: PoolStatus) {
    if (row.status === status) return;
    const wasAssigned = row.status === 'assigned';
    if (wasAssigned && status !== 'assigned') {
      const ok = window.confirm(
        `"${row.subdomain}" is currently assigned to a restaurant.\n\nChanging the status will UNLINK this pool entry from that restaurant (the restaurant keeps using the subdomain, but the pool will no longer track it).\n\nContinue?`,
      );
      if (!ok) return;
    }
    setBusyId(row.id);
    const patch: Partial<PoolRow> = { status } as Partial<PoolRow>;
    if (wasAssigned && status !== 'assigned') {
      (patch as Record<string, unknown>).assigned_restaurant_id = null;
      (patch as Record<string, unknown>).assigned_at = null;
    }
    const { error } = await supabase
      .from('subdomain_pool')
      .update(patch)
      .eq('id', row.id);
    setBusyId(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Marked "${row.subdomain}" as ${STATUS_META[status].label.toLowerCase()}`);
    qc.invalidateQueries({ queryKey: ['platform-subdomain-pool'] });
  }

  function openEdit(row: PoolRow) {
    setEditing(row);
    setEditSub(row.subdomain);
    setEditNotes(row.notes ?? '');
  }

  async function saveEdit() {
    if (!editing) return;
    const newSub = editSub.trim().toLowerCase();
    const newNotesVal = editNotes.trim() || null;
    if (!SUB_RE.test(newSub)) {
      toast.error('Invalid subdomain — use lowercase letters, numbers, and hyphens only.');
      return;
    }
    setSavingEdit(true);
    try {
      const subChanged = newSub !== editing.subdomain;

      // If renaming AND assigned to a restaurant, rename the restaurant slug
      // through the edge function (handles uniqueness + customer email rewrites).
      if (subChanged && editing.status === 'assigned' && editing.assigned_restaurant_id) {
        const { data, error } = await supabase.functions.invoke('restaurant-rename-slug', {
          body: { restaurantId: editing.assigned_restaurant_id, newSlug: newSub },
        });
        if (error || (data && (data as { error?: string }).error)) {
          throw new Error((data as { error?: string })?.error || error?.message || 'Rename failed');
        }
      }

      // Update the pool row itself
      const { error: poolErr } = await supabase
        .from('subdomain_pool')
        .update({ subdomain: newSub, notes: newNotesVal })
        .eq('id', editing.id);
      if (poolErr) {
        throw new Error(
          poolErr.message.includes('duplicate')
            ? 'That subdomain is already in the pool.'
            : poolErr.message,
        );
      }

      toast.success(`Updated "${newSub}"`);
      setEditing(null);
      qc.invalidateQueries({ queryKey: ['platform-subdomain-pool'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSavingEdit(false);
    }
  }

  function openAssign(row: PoolRow) {
    setAssigning(row);
    setAssignSearch('');
    setAssignTarget(row.assigned_restaurant_id ?? '');
  }

  async function saveAssign() {
    if (!assigning || !assignTarget) return;
    const row = assigning;
    const target = (allRestaurants ?? []).find((r) => r.id === assignTarget);
    if (!target) {
      toast.error('Pick a restaurant first.');
      return;
    }
    setSavingAssign(true);
    try {
      // Rename the restaurant slug to this subdomain (unless it already matches)
      if (target.slug !== row.subdomain) {
        const { data, error } = await supabase.functions.invoke('restaurant-rename-slug', {
          body: { restaurantId: target.id, newSlug: row.subdomain },
        });
        if (error || (data && (data as { error?: string }).error)) {
          throw new Error((data as { error?: string })?.error || error?.message || 'Rename failed');
        }
      }

      // Release any other pool entry previously assigned to this restaurant
      const stale = (rows ?? []).filter((r) => r.id !== row.id && r.assigned_restaurant_id === target.id);
      for (const s of stale) {
        await supabase
          .from('subdomain_pool')
          .update({ status: 'available', assigned_restaurant_id: null, assigned_at: null })
          .eq('id', s.id);
      }

      const { error: poolErr } = await supabase
        .from('subdomain_pool')
        .update({
          status: 'assigned',
          assigned_restaurant_id: target.id,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      if (poolErr) throw new Error(poolErr.message);

      toast.success(`Assigned "${row.subdomain}" to ${target.name}`);
      setAssigning(null);

      qc.invalidateQueries({ queryKey: ['platform-subdomain-pool'] });
      qc.invalidateQueries({ queryKey: ['platform-all-restaurants'] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign');
    } finally {
      setSavingAssign(false);
    }
  }



  async function deleteEntry(row: PoolRow) {
    setBusyId(row.id);
    const { error } = await supabase.from('subdomain_pool').delete().eq('id', row.id);
    setBusyId(null);
    setPendingDelete(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Removed "${row.subdomain}" from pool`);
    qc.invalidateQueries({ queryKey: ['platform-subdomain-pool'] });
  }

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 space-y-6 max-w-6xl">
        <div className="flex items-center gap-3">
          <Globe className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Subdomain Pool</h1>
            <p className="text-sm text-muted-foreground">
              Pre-provisioned subdomains auto-assigned to new restaurants at signup.
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {(['all', 'available', 'assigned', 'reserved', 'retired'] as const).map((k) => (
            <button
              key={k}
              onClick={() => setStatusFilter(k as 'all' | PoolStatus)}
              className={`text-left rounded-lg border p-3 transition-colors ${
                statusFilter === k ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
              }`}
            >
              <div className="text-xs uppercase text-muted-foreground tracking-wide">
                {k === 'all' ? 'Total' : STATUS_META[k as PoolStatus].label}
              </div>
              <div className="text-2xl font-semibold mt-1">{counts[k]}</div>
            </button>
          ))}
        </div>

        {/* Add new */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Add subdomain to pool</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-[1fr_2fr_auto] md:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="sub">Subdomain</Label>
              <Input
                id="sub"
                placeholder="e.g. swift-otter"
                value={newSubdomain}
                onChange={(e) => setNewSubdomain(e.target.value)}
                disabled={adding}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                placeholder="Internal note"
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                disabled={adding}
              />
            </div>
            <Button onClick={addEntry} disabled={adding || !newSubdomain.trim()}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search subdomain or notes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | PoolStatus)}>
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="available">Available</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="retired">Retired</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subdomain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="w-[200px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No subdomains match.</TableCell></TableRow>
                ) : filtered.map((row) => {
                  const meta = STATUS_META[row.status];
                  const restaurant = row.assigned_restaurant_id ? restaurants?.[row.assigned_restaurant_id] : null;
                  return (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-sm">{row.subdomain}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={meta.cls}>{meta.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {restaurant ? (
                          <span>{restaurant.name} <span className="text-muted-foreground">/{restaurant.slug}</span></span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">{row.notes ?? '—'}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(row.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Select
                            value={row.status}
                            onValueChange={(v) => updateStatus(row, v as PoolStatus)}
                            disabled={busyId === row.id}
                          >
                            <SelectTrigger className="h-8 w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="available">Available</SelectItem>
                              <SelectItem value="reserved">Reserved</SelectItem>
                              <SelectItem value="retired">Retired</SelectItem>
                              {row.status === 'assigned' && <SelectItem value="assigned">Assigned</SelectItem>}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={busyId === row.id}
                            onClick={() => openAssign(row)}
                            title={row.status === 'assigned' ? 'Reassign to another restaurant' : 'Assign to a restaurant'}
                          >
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button

                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={busyId === row.id}
                            onClick={() => openEdit(row)}
                            title={row.status === 'assigned' ? 'Edit subdomain (also renames the restaurant)' : 'Edit subdomain'}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            disabled={busyId === row.id}
                            onClick={() => setPendingDelete(row)}
                            title={row.status === 'assigned' ? 'Remove from pool (restaurant keeps the subdomain)' : 'Remove from pool'}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove subdomain?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-mono">{pendingDelete?.subdomain}</span> from the pool.
              {pendingDelete?.status === 'assigned' && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Warning: this entry is currently assigned to a restaurant. The restaurant will keep using the subdomain, but the pool will no longer track it.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingDelete && deleteEntry(pendingDelete)}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && !savingEdit && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit subdomain</DialogTitle>
            <DialogDescription>
              {editing?.status === 'assigned'
                ? 'This subdomain is assigned to a restaurant. Renaming it will also rename the restaurant slug and update any customer login emails.'
                : 'Update the subdomain text or notes.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-sub">Subdomain</Label>
              <Input
                id="edit-sub"
                value={editSub}
                onChange={(e) => setEditSub(e.target.value)}
                disabled={savingEdit}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                disabled={savingEdit}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={savingEdit}>
              Cancel
            </Button>
            <Button onClick={saveEdit} disabled={savingEdit || !editSub.trim()}>
              {savingEdit ? 'Saving…' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigning} onOpenChange={(o) => !o && !savingAssign && setAssigning(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign subdomain</DialogTitle>
            <DialogDescription>
              Assign <span className="font-mono">{assigning?.subdomain}</span> to a restaurant. This renames the
              restaurant's slug to match, so its storefront becomes{' '}
              <span className="font-mono">{assigning?.subdomain}.serveos.net</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="assign-search">Search restaurants</Label>
              <Input
                id="assign-search"
                placeholder="Name or current slug…"
                value={assignSearch}
                onChange={(e) => setAssignSearch(e.target.value)}
                disabled={savingAssign}
              />
            </div>
            <div className="max-h-64 overflow-y-auto rounded-md border divide-y">
              {loadingRestaurants ? (
                <div className="p-4 text-sm text-muted-foreground">Loading restaurants…</div>
              ) : assignCandidates.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No restaurants match.</div>
              ) : assignCandidates.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  disabled={savingAssign}
                  onClick={() => setAssignTarget(r.id)}
                  className={`w-full text-left px-3 py-2.5 transition-colors ${
                    assignTarget === r.id ? 'bg-primary/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-muted-foreground font-mono">/{r.slug}</div>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssigning(null)} disabled={savingAssign}>
              Cancel
            </Button>
            <Button onClick={saveAssign} disabled={savingAssign || !assignTarget}>
              {savingAssign ? 'Assigning…' : 'Assign subdomain'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformLayout>

  );
}
