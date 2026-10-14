import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ShieldCheck, AlertTriangle, Info, AlertOctagon,
  RefreshCw, Search, FileCode2, Database,
} from 'lucide-react';
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
  ORDER_AUDIT_ENTRIES, summarizeOrderAudit,
  type OrderAuditEntry, type OrderOp, type OrderSeverity, type OrderTenantScope,
} from '@/lib/order-audit-data';
import { cn } from '@/lib/utils';

const SCOPE_LABEL: Record<OrderTenantScope, string> = {
  restaurant_id_filter: 'restaurant_id filter',
  order_id_scoped: 'order-scoped',
  parent_join_filter: 'parent join filter',
  rls_only: 'RLS only',
  platform_global: 'platform-global',
  public_lookup: 'public lookup',
};

const SCOPE_TONE: Record<OrderTenantScope, string> = {
  restaurant_id_filter: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  order_id_scoped:      'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  parent_join_filter:   'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  rls_only:             'bg-sky-500/10 text-sky-600 border-sky-500/20',
  platform_global:      'bg-violet-500/10 text-violet-600 border-violet-500/20',
  public_lookup:        'bg-muted text-muted-foreground border-border',
};

const OP_TONE: Record<OrderOp, string> = {
  select: 'bg-muted text-muted-foreground border-border',
  insert: 'bg-amber-500/10 text-amber-600 border-amber-500/20',
  update: 'bg-sky-500/10 text-sky-600 border-sky-500/20',
  delete: 'bg-rose-500/10 text-rose-600 border-rose-500/20',
};

const SEVERITY_ICON: Record<OrderSeverity, React.ReactNode> = {
  ok:    <ShieldCheck   className="h-4 w-4 text-emerald-500" strokeWidth={2} />,
  info:  <Info          className="h-4 w-4 text-sky-500"     strokeWidth={2} />,
  warn:  <AlertTriangle className="h-4 w-4 text-amber-500"   strokeWidth={2} />,
  error: <AlertOctagon  className="h-4 w-4 text-rose-500"    strokeWidth={2} />,
};

/**
 * Live probes against the active restaurant. RLS limits us to rows we
 * can already see, so:
 *   - `orphanOrders`  — orders visible to us with restaurant_id IS NULL
 *                       (would indicate an unsafe insert site).
 *   - `crossTenantItems` — order_items whose parent order belongs to a
 *                       different restaurant_id than the active one.
 *   - `nullParentItems` — order_items with NULL order_id (data integrity).
 */
async function runOrderProbe(restaurantId: string) {
  const [orphanRes, crossRes, nullParentRes, totalOrdersRes, totalItemsRes] = await Promise.all([
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .is('restaurant_id', null),
    supabase
      .from('order_items')
      .select('id, orders!inner(restaurant_id)', { count: 'exact', head: true })
      .neq('orders.restaurant_id', restaurantId),
    supabase
      .from('order_items')
      .select('id', { count: 'exact', head: true })
      .is('order_id', null),
    supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('restaurant_id', restaurantId),
    supabase
      .from('order_items')
      .select('id, orders!inner(restaurant_id)', { count: 'exact', head: true })
      .eq('orders.restaurant_id', restaurantId),
  ]);

  return {
    orphanOrders:      orphanRes.count ?? 0,
    crossTenantItems:  crossRes.count ?? 0,
    nullParentItems:   nullParentRes.count ?? 0,
    totalOrders:       totalOrdersRes.count ?? 0,
    totalItems:        totalItemsRes.count ?? 0,
    errors: [
      orphanRes.error,
      crossRes.error,
      nullParentRes.error,
      totalOrdersRes.error,
      totalItemsRes.error,
    ].filter(Boolean).map(e => e!.message),
  };
}

export default function OrderAuditPage() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;

  const [search, setSearch] = useState('');
  const [opFilter, setOpFilter] = useState<'all' | OrderOp>('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | OrderSeverity>('all');
  const [areaFilter, setAreaFilter] = useState<'all' | OrderAuditEntry['area']>('all');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ORDER_AUDIT_ENTRIES.filter(e => {
      if (opFilter !== 'all' && e.op !== opFilter) return false;
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (areaFilter !== 'all' && e.area !== areaFilter) return false;
      if (q && !(
        e.file.toLowerCase().includes(q) ||
        e.route.toLowerCase().includes(q) ||
        e.notes.toLowerCase().includes(q)
      )) return false;
      return true;
    });
  }, [search, opFilter, severityFilter, areaFilter]);

  const summary = useMemo(() => summarizeOrderAudit(ORDER_AUDIT_ENTRIES), []);
  const filteredSummary = useMemo(() => summarizeOrderAudit(filtered), [filtered]);

  const probe = useQuery({
    queryKey: ['order-audit-probe', restaurantId],
    enabled: !!restaurantId,
    queryFn: () => runOrderProbe(restaurantId!),
    staleTime: 30_000,
  });

  const probeIssues = (probe.data?.orphanOrders ?? 0)
                    + (probe.data?.crossTenantItems ?? 0)
                    + (probe.data?.nullParentItems ?? 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Order Tenant Audit</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Static index of every <code className="rounded bg-muted px-1 text-xs">orders</code> /{' '}
              <code className="rounded bg-muted px-1 text-xs">order_items</code> query in the app, with a
              live probe for orphan or cross-tenant rows in the active restaurant.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => probe.refetch()}
            disabled={probe.isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', probe.isFetching && 'animate-spin')} />
            Re-run probe
          </Button>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryTile
            label="Total call sites"
            value={summary.total}
            sublabel={`${summary.mutations} mutations · ${summary.inserts} inserts`}
            icon={<FileCode2 className="h-4 w-4" />}
          />
          <SummaryTile
            label="Safe"
            value={summary.ok}
            sublabel="restaurant_id or order_id scoped"
            tone="emerald"
            icon={<ShieldCheck className="h-4 w-4" />}
          />
          <SummaryTile
            label="To review"
            value={summary.warn + summary.info}
            sublabel={`${summary.warn} warn · ${summary.info} info`}
            tone={summary.warn > 0 ? 'amber' : 'sky'}
            icon={<AlertTriangle className="h-4 w-4" />}
          />
          <SummaryTile
            label="Unsafe"
            value={summary.error}
            sublabel={summary.error === 0 ? 'No unsafe sites' : 'Action required'}
            tone={summary.error > 0 ? 'rose' : 'emerald'}
            icon={<AlertOctagon className="h-4 w-4" />}
          />
        </div>

        {/* Live probe */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Database className="h-4 w-4 text-muted-foreground" />
              Live database probe
              {restaurant?.name && (
                <span className="text-sm font-normal text-muted-foreground">
                  · {restaurant.name}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!restaurantId ? (
              <p className="text-sm text-muted-foreground">
                No active restaurant selected.
              </p>
            ) : probe.isLoading ? (
              <p className="text-sm text-muted-foreground">Running probe…</p>
            ) : probe.error ? (
              <p className="text-sm text-rose-600">
                Probe failed: {(probe.error as Error).message}
              </p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                <ProbeTile label="Orders (this tenant)"     value={probe.data?.totalOrders ?? 0} tone="muted" />
                <ProbeTile label="Order items (this tenant)" value={probe.data?.totalItems  ?? 0} tone="muted" />
                <ProbeTile
                  label="Orphan orders (NULL restaurant_id)"
                  value={probe.data?.orphanOrders ?? 0}
                  tone={(probe.data?.orphanOrders ?? 0) > 0 ? 'rose' : 'emerald'}
                />
                <ProbeTile
                  label="Cross-tenant order_items"
                  value={probe.data?.crossTenantItems ?? 0}
                  tone={(probe.data?.crossTenantItems ?? 0) > 0 ? 'rose' : 'emerald'}
                />
                <ProbeTile
                  label="Items with NULL order_id"
                  value={probe.data?.nullParentItems ?? 0}
                  tone={(probe.data?.nullParentItems ?? 0) > 0 ? 'amber' : 'emerald'}
                />
              </div>
            )}

            {probeIssues === 0 && !probe.isLoading && !probe.error && restaurantId && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
                Probe passed. No orphan or cross-tenant rows visible.
              </p>
            )}
            {probeIssues > 0 && (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-rose-600">
                <AlertOctagon className="h-4 w-4" />
                Probe surfaced {probeIssues} suspect row{probeIssues === 1 ? '' : 's'}. Investigate the call sites below.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search file, route, or note…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <Select value={opFilter} onValueChange={v => setOpFilter(v as any)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Operation" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All ops</SelectItem>
                  <SelectItem value="select">SELECT</SelectItem>
                  <SelectItem value="insert">INSERT</SelectItem>
                  <SelectItem value="update">UPDATE</SelectItem>
                  <SelectItem value="delete">DELETE</SelectItem>
                </SelectContent>
              </Select>
              <Select value={severityFilter} onValueChange={v => setSeverityFilter(v as any)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Severity" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  <SelectItem value="ok">Safe</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="warn">Warn</SelectItem>
                  <SelectItem value="error">Unsafe</SelectItem>
                </SelectContent>
              </Select>
              <Select value={areaFilter} onValueChange={v => setAreaFilter(v as any)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Area" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All areas</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="staff">Staff</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="accounting">Accounting</SelectItem>
                  <SelectItem value="platform">Platform</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-3 text-xs text-muted-foreground">
              Showing {filteredSummary.total} of {summary.total} entries
              {filteredSummary.error > 0 && (
                <span className="ml-2 text-rose-600">· {filteredSummary.error} unsafe</span>
              )}
              {filteredSummary.warn > 0 && (
                <span className="ml-2 text-amber-600">· {filteredSummary.warn} warn</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <div className="max-w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]"></TableHead>
                    <TableHead>File · line</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Table</TableHead>
                    <TableHead>Op</TableHead>
                    <TableHead>Tenant scope</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((e, idx) => (
                    <TableRow
                      key={`${e.file}:${e.line}:${idx}`}
                      className={cn(
                        e.severity === 'error' && 'bg-rose-500/5',
                        e.severity === 'warn'  && 'bg-amber-500/5',
                      )}
                    >
                      <TableCell>{SEVERITY_ICON[e.severity]}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <div>{e.file}</div>
                        <div className="text-muted-foreground">:{e.line}</div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{e.route}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {e.table}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('uppercase text-xs', OP_TONE[e.op])}>
                          {e.op}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn('text-xs', SCOPE_TONE[e.tenantScope])}>
                          {SCOPE_LABEL[e.tenantScope]}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[420px] text-xs text-muted-foreground">
                        {e.notes}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                        No call sites match the current filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}

/* ── small presentational helpers ─────────────────────────────────────── */

function SummaryTile({
  label, value, sublabel, icon, tone = 'muted',
}: {
  label: string;
  value: number;
  sublabel?: string;
  icon?: React.ReactNode;
  tone?: 'muted' | 'emerald' | 'amber' | 'rose' | 'sky';
}) {
  const tones: Record<string, string> = {
    muted:   'text-foreground',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    rose:    'text-rose-600',
    sky:     'text-sky-600',
  };
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          {icon} {label}
        </div>
        <div className={cn('mt-1 text-3xl font-semibold tabular-nums', tones[tone])}>
          {value}
        </div>
        {sublabel && (
          <div className="mt-1 text-xs text-muted-foreground">{sublabel}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ProbeTile({
  label, value, tone,
}: {
  label: string;
  value: number;
  tone: 'muted' | 'emerald' | 'amber' | 'rose';
}) {
  const tones: Record<string, string> = {
    muted:   'border-border bg-muted/40',
    emerald: 'border-emerald-500/30 bg-emerald-500/5',
    amber:   'border-amber-500/30 bg-amber-500/5',
    rose:    'border-rose-500/40 bg-rose-500/10',
  };
  const valueTones: Record<string, string> = {
    muted:   'text-foreground',
    emerald: 'text-emerald-600',
    amber:   'text-amber-600',
    rose:    'text-rose-600',
  };
  return (
    <div className={cn('rounded-lg border p-3', tones[tone])}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn('mt-1 text-2xl font-semibold tabular-nums', valueTones[tone])}>
        {value}
      </div>
    </div>
  );
}