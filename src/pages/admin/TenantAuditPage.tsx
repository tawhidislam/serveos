import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, AlertTriangle, Info, RefreshCw, Search, FileCode2 } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import {
  AUDIT_ENTRIES, TENANT_SCOPED_TABLES,
  type AuditEntry, type AuditScope, type AuditStatus,
} from '@/lib/tenant-audit-data';
import { cn } from '@/lib/utils';

const SCOPE_LABEL: Record<AuditScope, string> = {
  restaurant_id_filter: 'restaurant_id filter',
  parent_scoped: 'parent-scoped',
  rls_only: 'RLS only',
  platform_global: 'platform-global',
  public_anon: 'public/anon',
};

const SCOPE_TONE: Record<AuditScope, string> = {
  restaurant_id_filter: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  parent_scoped: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rls_only: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  platform_global: 'bg-violet-500/10 text-violet-600 border-violet-500/20',
  public_anon: 'bg-muted text-muted-foreground border-border',
};

const STATUS_ICON: Record<AuditStatus, React.ReactNode> = {
  ok: <ShieldCheck className="h-4 w-4 text-emerald-500" strokeWidth={2} />,
  warn: <AlertTriangle className="h-4 w-4 text-amber-500" strokeWidth={2} />,
  info: <Info className="h-4 w-4 text-sky-500" strokeWidth={2} />,
};

/**
 * Live probe: for each tenant-scoped table, count rows in the active
 * restaurant. RLS guarantees we only see our own rows, so a non-zero
 * `null_count` (rows visible to us but with restaurant_id IS NULL)
 * indicates a bug at an insert site that should be flagged.
 */
interface ProbeResult {
  table: string;
  total: number | null;
  nullCount: number | null;
  error: string | null;
}

async function probeTable(table: string, restaurantId: string): Promise<ProbeResult> {
  // We use untyped `from(table as any)` because the audit list spans 20+
  // tables and TS would otherwise require a giant union type per call.
  const totalRes = await (supabase.from(table as any) as any)
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId);
  const nullRes = await (supabase.from(table as any) as any)
    .select('id', { count: 'exact', head: true })
    .is('restaurant_id', null);
  return {
    table,
    total: totalRes.error ? null : (totalRes.count ?? 0),
    nullCount: nullRes.error ? null : (nullRes.count ?? 0),
    error: totalRes.error?.message ?? null,
  };
}

export default function TenantAuditPage() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id ?? null;
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return AUDIT_ENTRIES.filter((e) => {
      if (areaFilter !== 'all' && e.area !== areaFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.file.toLowerCase().includes(q) ||
        e.route.toLowerCase().includes(q) ||
        e.tables.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [search, areaFilter, statusFilter]);

  const totals = useMemo(() => {
    const t = { ok: 0, warn: 0, info: 0 } as Record<AuditStatus, number>;
    AUDIT_ENTRIES.forEach((e) => { t[e.status] += 1; });
    return t;
  }, []);

  const liveProbe = useQuery({
    queryKey: ['tenant-audit-probe', restaurantId],
    queryFn: async (): Promise<ProbeResult[]> => {
      if (!restaurantId) return [];
      // Probe in parallel — each call is `head:true` so it's cheap.
      return Promise.all(
        TENANT_SCOPED_TABLES.map((t) => probeTable(t, restaurantId)),
      );
    },
    enabled: !!restaurantId,
    staleTime: 60_000,
  });

  const orphanRows = (liveProbe.data ?? []).filter((p) => (p.nullCount ?? 0) > 0);

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 max-w-7xl">
        {/* Header */}
        <header className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4" strokeWidth={1.5} />
            <span>Tenant Audit</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Multi-tenant scoping checklist
          </h1>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Every page or component that queries the database, with the rule that
            keeps it isolated to{' '}
            <span className="font-medium text-foreground">
              {restaurant?.name ?? 'this restaurant'}
            </span>
            . Use this view when reviewing changes to confirm new queries are
            tenant-scoped before shipping.
          </p>
        </header>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryTile label="Tracked surfaces" value={AUDIT_ENTRIES.length} />
          <SummaryTile label="Scoped" value={totals.ok} tone="emerald" />
          <SummaryTile label="Needs review" value={totals.warn} tone="amber" />
          <SummaryTile label="Informational" value={totals.info} tone="sky" />
        </div>

        {/* Live probe */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">Live data probe</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  For each tenant-scoped table, counts rows in this restaurant
                  and any rows with a NULL <code className="text-[11px]">restaurant_id</code>
                  {' '}visible under current RLS — a non-zero NULL count signals an
                  insert-site bug.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => liveProbe.refetch()}
                disabled={liveProbe.isFetching || !restaurantId}
              >
                <RefreshCw
                  className={cn(
                    'h-3.5 w-3.5 mr-1.5',
                    liveProbe.isFetching && 'animate-spin',
                  )}
                />
                Re-run
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!restaurantId ? (
              <p className="text-sm text-muted-foreground">
                No active restaurant — sign in or impersonate a tenant to run probes.
              </p>
            ) : liveProbe.isLoading ? (
              <p className="text-sm text-muted-foreground">Probing…</p>
            ) : orphanRows.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-emerald-600">
                <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                No orphan rows detected across {TENANT_SCOPED_TABLES.length} tables.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-amber-600">
                  <AlertTriangle className="h-4 w-4" strokeWidth={2} />
                  {orphanRows.length} table(s) contain rows with NULL{' '}
                  <code className="text-[11px]">restaurant_id</code>:
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {orphanRows.map((p) => (
                    <div
                      key={p.table}
                      className="flex items-center justify-between rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
                    >
                      <span className="font-mono text-xs">{p.table}</span>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">
                        {p.nullCount} orphan{p.nullCount === 1 ? '' : 's'}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-table counts */}
            {liveProbe.data && liveProbe.data.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Show all {liveProbe.data.length} table counts
                </summary>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-2">
                  {liveProbe.data.map((p) => (
                    <div
                      key={p.table}
                      className="flex items-center justify-between rounded border border-border/50 bg-muted/30 px-2 py-1 text-xs"
                    >
                      <span className="font-mono truncate">{p.table}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {p.error ? 'err' : p.total ?? 0}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search file, route, or table…"
              className="pl-9 h-9"
            />
          </div>
          <Select value={areaFilter} onValueChange={setAreaFilter}>
            <SelectTrigger className="w-[140px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All areas</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="staff">Staff</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="platform">Platform</SelectItem>
              <SelectItem value="shared">Shared</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px] h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ok">Scoped (OK)</SelectItem>
              <SelectItem value="warn">Needs review</SelectItem>
              <SelectItem value="info">Informational</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Checklist */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Surface</TableHead>
                  <TableHead className="hidden md:table-cell">Tables</TableHead>
                  <TableHead>Scope rule</TableHead>
                  <TableHead className="hidden lg:table-cell">Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.file}>
                    <TableCell className="align-top pt-3">
                      {STATUS_ICON[entry.status]}
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">
                          {entry.route !== '—' ? entry.route : entry.file.split('/').pop()}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono inline-flex items-center gap-1">
                          <FileCode2 className="h-3 w-3" />
                          {entry.file}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell align-top">
                      <div className="flex flex-wrap gap-1 max-w-[260px]">
                        {entry.tables.map((t) => (
                          <code
                            key={t}
                            className="text-[11px] bg-muted px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </code>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Badge
                        variant="outline"
                        className={cn('text-[11px] font-normal', SCOPE_TONE[entry.scope])}
                      >
                        {SCOPE_LABEL[entry.scope]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell align-top text-xs text-muted-foreground max-w-[360px]">
                      {entry.notes}
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-12">
                      No surfaces match the current filters.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Legend */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 grid sm:grid-cols-3 gap-3 text-xs">
            <LegendRow icon={<ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />} label="Scoped" desc="Queries explicitly include restaurant_id, or inherit it from a verified parent." />
            <LegendRow icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-500" />} label="Needs review" desc="No tenant filter detected — manually verify it's intentional." />
            <LegendRow icon={<Info className="h-3.5 w-3.5 text-sky-500" />} label="Informational" desc="Single-row by id, public read, or platform-level data." />
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

function SummaryTile({
  label, value, tone,
}: { label: string; value: number; tone?: 'emerald' | 'amber' | 'sky' }) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600' :
    tone === 'amber' ? 'text-amber-600' :
    tone === 'sky' ? 'text-sky-600' : 'text-foreground';
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn('text-2xl font-semibold tabular-nums mt-1', toneCls)}>{value}</div>
      </CardContent>
    </Card>
  );
}

function LegendRow({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex gap-2">
      <div className="mt-0.5">{icon}</div>
      <div>
        <div className="font-medium text-foreground">{label}</div>
        <div className="text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}