import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const ACTION_COLORS: Record<string, string> = {
  INSERT: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
  DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
};

export default function PlatformAudit() {
  const [search, setSearch] = useState('');
  const [tableFilter, setTableFilter] = useState<string>('all');

  const { data: logs, isLoading } = useQuery({
    queryKey: ['platform-audit-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('id, table_name, record_id, action, changed_by, changed_at')
        .order('changed_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const tables = Array.from(new Set((logs ?? []).map((l) => l.table_name))).sort();

  const filtered = (logs ?? []).filter((l) => {
    if (tableFilter !== 'all' && l.table_name !== tableFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      l.table_name.toLowerCase().includes(q) ||
      l.record_id.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q)
    );
  });

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last {filtered.length} events across all tenants
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search table, record id, or action…"
              className="pl-9"
            />
          </div>
          <Select value={tableFilter} onValueChange={setTableFilter}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tables</SelectItem>
              {tables.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
                <Activity className="h-8 w-8 opacity-30" />
                No audit events match
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((l) => (
                  <div key={l.id} className="p-3 flex items-center gap-3 text-sm">
                    <Badge variant="outline" className={`${ACTION_COLORS[l.action] ?? ''} font-mono text-[10px] uppercase tracking-wide`}>
                      {l.action}
                    </Badge>
                    <span className="font-medium">{l.table_name}</span>
                    <span className="text-xs text-muted-foreground font-mono truncate flex-1">
                      {l.record_id}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {formatDistanceToNow(new Date(l.changed_at), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformLayout>
  );
}
