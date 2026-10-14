import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Search, Shield, ArrowUpRight, ArrowDownRight, Plus, Minus, Eye,
  Filter, Clock, Download, FileText,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

const TABLE_LABELS: Record<string, string> = {
  orders: 'Orders',
  expenses: 'Expenses',
  inventory_items: 'Inventory Items',
  inventory_transactions: 'Inventory Transactions',
  employee_shifts: 'Employee Shifts',
  employee_tips: 'Employee Tips',
  payroll_records: 'Payroll Records',
  cash_drawer_sessions: 'Cash Drawer',
};

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: typeof Plus }> = {
  INSERT: { label: 'Created', color: 'bg-green-500/10 text-green-600 border-green-500/30', icon: Plus },
  UPDATE: { label: 'Updated', color: 'bg-blue-500/10 text-blue-600 border-blue-500/30', icon: ArrowUpRight },
  DELETE: { label: 'Deleted', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: Minus },
};

const PERIOD_OPTIONS = [
  { value: '1', label: 'Last 24 Hours' },
  { value: '7', label: 'Last 7 Days' },
  { value: '30', label: 'Last 30 Days' },
  { value: '90', label: 'Last 90 Days' },
];

// Summarize what changed between old and new data
function getChangeSummary(action: string, oldData: any, newData: any): string {
  if (action === 'INSERT') {
    const name = newData?.name || newData?.guest_name || newData?.description || newData?.status || '';
    return name ? `Created: ${name}` : 'New record created';
  }
  if (action === 'DELETE') {
    const name = oldData?.name || oldData?.guest_name || oldData?.description || '';
    return name ? `Deleted: ${name}` : 'Record deleted';
  }
  if (action === 'UPDATE' && oldData && newData) {
    const changes: string[] = [];
    for (const key of Object.keys(newData)) {
      if (['updated_at', 'created_at'].includes(key)) continue;
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changes.push(key.replace(/_/g, ' '));
      }
    }
    return changes.length > 0 ? `Changed: ${changes.slice(0, 3).join(', ')}${changes.length > 3 ? ` +${changes.length - 3} more` : ''}` : 'No visible changes';
  }
  return '';
}

export default function AuditTrailPage() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [periodDays, setPeriodDays] = useState('30');
  const [detailLog, setDetailLog] = useState<any>(null);

  // Fetch staff profiles for resolving user names — limited to tenant members
  const { data: profiles = [] } = useQuery({
    queryKey: ['audit-profiles', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('restaurant_members')
        .select('user_id')
        .eq('restaurant_id', restaurantId!);
      const ids = (members ?? []).map(m => m.user_id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', ids);
      return data || [];
    },
  });

  const getUserName = (userId: string | null) => {
    if (!userId) return 'System';
    return profiles.find(p => p.user_id === userId)?.display_name || userId.slice(0, 8);
  };

  // Fetch audit logs — filter to changes made by tenant members
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs', periodDays, restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const tenantUserIds = profiles.map(p => p.user_id);
      const from = subDays(new Date(), Number(periodDays));
      let q = supabase
        .from('audit_logs')
        .select('*')
        .gte('changed_at', from.toISOString())
        .order('changed_at', { ascending: false })
        .limit(1000);
      if (tenantUserIds.length > 0) {
        q = q.in('changed_by', tenantUserIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Filter logs
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      if (tableFilter !== 'all' && log.table_name !== tableFilter) return false;
      if (actionFilter !== 'all' && log.action !== actionFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        const summary = getChangeSummary(log.action, log.old_data, log.new_data).toLowerCase();
        const user = getUserName(log.changed_by).toLowerCase();
        const table = (TABLE_LABELS[log.table_name] || log.table_name).toLowerCase();
        if (!summary.includes(s) && !user.includes(s) && !table.includes(s) && !log.record_id.includes(s)) return false;
      }
      return true;
    });
  }, [logs, tableFilter, actionFilter, search, profiles]);

  // Stats
  const stats = useMemo(() => {
    const inserts = logs.filter(l => l.action === 'INSERT').length;
    const updates = logs.filter(l => l.action === 'UPDATE').length;
    const deletes = logs.filter(l => l.action === 'DELETE').length;
    const uniqueUsers = new Set(logs.map(l => l.changed_by).filter(Boolean)).size;
    return { total: logs.length, inserts, updates, deletes, uniqueUsers };
  }, [logs]);

  // Export CSV
  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Table', 'Action', 'Record ID', 'Changed By', 'Summary'],
      ...filteredLogs.map(log => [
        format(new Date(log.changed_at), 'yyyy-MM-dd HH:mm:ss'),
        TABLE_LABELS[log.table_name] || log.table_name,
        log.action,
        log.record_id,
        getUserName(log.changed_by),
        getChangeSummary(log.action, log.old_data, log.new_data),
      ]),
    ];
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render JSON diff
  const renderJsonDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return null;
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    const sortedKeys = Array.from(allKeys).filter(k => !['created_at', 'updated_at'].includes(k)).sort();

    return (
      <div className="space-y-1 font-mono text-xs">
        {sortedKeys.map(key => {
          const oldVal = oldData?.[key];
          const newVal = newData?.[key];
          const changed = JSON.stringify(oldVal) !== JSON.stringify(newVal);
          return (
            <div key={key} className={`flex gap-2 py-1 px-2 rounded ${changed ? 'bg-primary/5' : ''}`}>
              <span className="text-muted-foreground w-36 shrink-0 truncate">{key}</span>
              {oldData && (
                <span className={`flex-1 truncate ${changed ? 'text-destructive line-through' : 'text-muted-foreground'}`}>
                  {oldVal !== undefined && oldVal !== null ? String(oldVal) : '—'}
                </span>
              )}
              {newData && (
                <span className={`flex-1 truncate ${changed ? 'text-accent-foreground font-medium' : 'text-muted-foreground'}`}>
                  {newVal !== undefined && newVal !== null ? String(newVal) : '—'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Audit Trail</h1>
            <p className="text-sm text-muted-foreground">Track all financial data changes automatically</p>
          </div>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />Export CSV
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Total Events</p>
              <p className="text-xl font-bold text-foreground">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Creates</p>
              <p className="text-xl font-bold text-primary">{stats.inserts}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Updates</p>
              <p className="text-xl font-bold text-accent-foreground">{stats.updates}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Deletes</p>
              <p className="text-xl font-bold text-destructive">{stats.deletes}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <p className="text-xs text-muted-foreground">Active Users</p>
              <p className="text-xl font-bold text-foreground">{stats.uniqueUsers}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search logs..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={tableFilter} onValueChange={setTableFilter}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {Object.entries(TABLE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="INSERT">Created</SelectItem>
                  <SelectItem value="UPDATE">Updated</SelectItem>
                  <SelectItem value="DELETE">Deleted</SelectItem>
                </SelectContent>
              </Select>
              <Select value={periodDays} onValueChange={setPeriodDays}>
                <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                <SelectContent>{PERIOD_OPTIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Audit Log
              <Badge variant="secondary" className="ml-2">{filteredLogs.length} entries</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">Timestamp</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Summary</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading audit logs...</TableCell></TableRow>
                ) : filteredLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No audit entries found</TableCell></TableRow>
                ) : filteredLogs.map(log => {
                  const actionCfg = ACTION_CONFIG[log.action] || { label: log.action, color: '', icon: Eye };
                  const Icon = actionCfg.icon;
                  return (
                    <TableRow key={log.id}>
                      <TableCell className="text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {format(new Date(log.changed_at), 'MMM dd, HH:mm:ss')}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{TABLE_LABELS[log.table_name] || log.table_name}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${actionCfg.color}`}>
                          <Icon className="h-3 w-3 mr-1" />{actionCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-foreground max-w-[250px] truncate">
                        {getChangeSummary(log.action, log.old_data, log.new_data)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{getUserName(log.changed_by)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailLog(log)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!detailLog} onOpenChange={() => setDetailLog(null)}>
           <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                Audit Detail
                {detailLog && (
                  <Badge variant="outline" className={`text-xs ${ACTION_CONFIG[detailLog.action]?.color || ''}`}>
                    {ACTION_CONFIG[detailLog.action]?.label || detailLog.action}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>
            {detailLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Table:</span>
                    <span className="ml-2 font-medium text-foreground">{TABLE_LABELS[detailLog.table_name] || detailLog.table_name}</span>
                  </div>
                  <div className="break-all">
                    <span className="text-muted-foreground">Record ID:</span>
                    <span className="ml-2 font-mono text-xs text-foreground">{detailLog.record_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Changed by:</span>
                    <span className="ml-2 font-medium text-foreground">{getUserName(detailLog.changed_by)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timestamp:</span>
                    <span className="ml-2 text-foreground">{format(new Date(detailLog.changed_at), 'MMM dd, yyyy HH:mm:ss')}</span>
                  </div>
                </div>
                <Separator />
                <div className="overflow-x-auto">
                  <div className="flex gap-4 mb-2 text-xs font-medium min-w-[400px]">
                    <span className="w-36 shrink-0 text-muted-foreground">Field</span>
                    {detailLog.old_data && <span className="flex-1 text-destructive">Old Value</span>}
                    {detailLog.new_data && <span className="flex-1 text-accent-foreground">New Value</span>}
                  </div>
                  <ScrollArea className="max-h-[350px]">
                    <div className="min-w-[400px]">
                      {renderJsonDiff(detailLog.old_data, detailLog.new_data)}
                    </div>
                  </ScrollArea>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
