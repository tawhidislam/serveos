import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  Globe, Search, Plus, Trash2, CheckCircle2, AlertCircle, ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { customDomainAction } from '@/lib/custom-domains';

type DomainRow = {
  id: string;
  domain: string;
  verified: boolean;
  verified_at: string | null;
  created_at: string;
  restaurant_id: string;
};

type RestaurantOpt = {
  id: string;
  name: string;
  slug: string;
};

const DOMAIN_RE = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
}

export default function PlatformDomains() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'verified' | 'pending'>('all');
  const [newDomain, setNewDomain] = useState('');
  const [newRestaurantId, setNewRestaurantId] = useState<string>('');
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<DomainRow | null>(null);

  const { data: domains, isLoading } = useQuery<DomainRow[]>({
    queryKey: ['platform-custom-domains'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_custom_domains')
        .select('id, domain, verified, verified_at, created_at, restaurant_id')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as DomainRow[];
    },
  });

  const { data: restaurants } = useQuery<RestaurantOpt[]>({
    queryKey: ['platform-restaurants-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurants')
        .select('id, name, slug')
        .order('name', { ascending: true });
      if (error) throw error;
      return (data ?? []) as RestaurantOpt[];
    },
  });

  const restaurantById = useMemo(() => {
    const map = new Map<string, RestaurantOpt>();
    (restaurants ?? []).forEach((r) => map.set(r.id, r));
    return map;
  }, [restaurants]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (domains ?? []).filter((d) => {
      if (statusFilter === 'verified' && !d.verified) return false;
      if (statusFilter === 'pending' && d.verified) return false;
      if (!q) return true;
      const r = restaurantById.get(d.restaurant_id);
      return (
        d.domain.toLowerCase().includes(q) ||
        (r?.name?.toLowerCase().includes(q) ?? false) ||
        (r?.slug?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [domains, restaurantById, search, statusFilter]);

  const counts = useMemo(() => {
    const total = domains?.length ?? 0;
    const verified = (domains ?? []).filter((d) => d.verified).length;
    return { total, verified, pending: total - verified };
  }, [domains]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['platform-custom-domains'] });
    qc.invalidateQueries({ queryKey: ['restaurant-custom-domains'] });
    qc.invalidateQueries({ queryKey: ['platform-tenants'] });
    qc.invalidateQueries({ queryKey: ['custom-domain-restaurant'] });
  };

  const handleAdd = async () => {
    const next = normalize(newDomain);
    if (!next || !DOMAIN_RE.test(next)) {
      toast.error('Enter a valid domain like bellacucina.com');
      return;
    }
    if (!newRestaurantId) {
      toast.error('Pick a restaurant to assign this domain to');
      return;
    }
    setAdding(true);
    try {
      const { error } = await supabase.from('restaurant_custom_domains').insert({
        restaurant_id: newRestaurantId,
        domain: next,
      });
      if (error) throw error;
      toast.success('Domain added');
      setNewDomain('');
      setNewRestaurantId('');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to add domain');
    } finally {
      setAdding(false);
    }
  };

  const handleVerifyToggle = async (row: DomainRow) => {
    setBusyId(row.id);
    try {
      const next = !row.verified;
      await customDomainAction({ action: 'set_verified', domainId: row.id, verified: next });
      toast.success(next ? 'Marked as verified' : 'Verification cleared');
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to update');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setBusyId(pendingDelete.id);
    try {
      await customDomainAction({ action: 'remove', domainId: pendingDelete.id });
      toast.success('Domain removed');
      setPendingDelete(null);
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to remove domain');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <PlatformLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <Globe className="h-6 w-6" /> Custom domains
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Manage every tenant custom domain — verification status and restaurant assignment.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">Total: {counts.total}</Badge>
            <Badge className="bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
              Verified: {counts.verified}
            </Badge>
            <Badge variant="outline">Pending: {counts.pending}</Badge>
          </div>
        </div>

        {/* Add new */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" /> Assign a domain to a restaurant
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] items-end">
              <div className="space-y-1.5">
                <Label htmlFor="new-domain">Domain</Label>
                <Input
                  id="new-domain"
                  value={newDomain}
                  onChange={(e) => setNewDomain(e.target.value)}
                  placeholder="bellacucina.com"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Restaurant</Label>
                <Select value={newRestaurantId} onValueChange={setNewRestaurantId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pick a restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {(restaurants ?? []).map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name} <span className="text-muted-foreground">({r.slug})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} disabled={adding || !newDomain.trim() || !newRestaurantId}>
                <Plus className="h-4 w-4 mr-1" />
                {adding ? 'Adding…' : 'Add domain'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              No <code>https://</code>, no trailing slash. Apex or subdomain both work.
            </p>
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by domain, restaurant name or slug"
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="verified">Verified only</SelectItem>
              <SelectItem value="pending">Pending only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Restaurant</TableHead>
                  <TableHead>Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      No domains match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const r = restaurantById.get(row.restaurant_id);
                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <a
                            href={`https://${row.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono text-sm inline-flex items-center gap-1 hover:underline"
                          >
                            {row.domain}
                            <ExternalLink className="h-3 w-3 opacity-60" />
                          </a>
                        </TableCell>
                        <TableCell>
                          {row.verified ? (
                            <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/20">
                              <CheckCircle2 className="h-3 w-3" /> Verified
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <AlertCircle className="h-3 w-3" /> Pending DNS
                            </Badge>
                          )}
                          {row.verified && row.verified_at && (
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {new Date(row.verified_at).toLocaleDateString()}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {r ? (
                            <Link
                              to={`/platform/tenants?focus=${r.id}`}
                              className="hover:underline"
                            >
                              <div className="font-medium">{r.name}</div>
                              <div className="text-xs text-muted-foreground">/r/{r.slug}</div>
                            </Link>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Unknown ({row.restaurant_id.slice(0, 8)}…)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(row.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleVerifyToggle(row)}
                              disabled={busyId === row.id}
                            >
                              {row.verified ? 'Unverify' : 'Mark verified'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setPendingDelete(row)}
                              disabled={busyId === row.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this domain?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-mono">{pendingDelete?.domain}</span> will stop resolving to this
              restaurant. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PlatformLayout>
  );
}
