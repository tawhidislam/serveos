import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Copy, Check, Link2, Loader2, Power, BarChart3, Download } from 'lucide-react';
import { toast } from 'sonner';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
const UNASSIGNED = '__none__';

function randomCode(len = 4) {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

type TableRow = { id: string; label: string };

export default function QrShortLinksCard({
  restaurantId,
  tables,
}: {
  restaurantId: string | null | undefined;
  tables: TableRow[];
}) {
  const queryClient = useQueryClient();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newTableId, setNewTableId] = useState<string>('');
  const [newLabel, setNewLabel] = useState('');

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['qr_short_links', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('qr_short_links')
        .select('id, code, table_id, label, is_active, created_at')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Last 30 days of scan events, aggregated in the client.
  const { data: scans = [] } = useQuery({
    queryKey: ['qr_scans', restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from('qr_scans')
        .select('short_link_id, device_hash, scanned_at')
        .eq('restaurant_id', restaurantId!)
        .gte('scanned_at', since)
        .order('scanned_at', { ascending: false })
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = useMemo(() => {
    const byLink = new Map<
      string,
      { total: number; devices: Set<string>; hours: number[]; last: string | null }
    >();
    const globalHours = new Array(24).fill(0);
    const globalDevices = new Set<string>();

    for (const s of scans as any[]) {
      const entry =
        byLink.get(s.short_link_id) ??
        { total: 0, devices: new Set<string>(), hours: new Array(24).fill(0), last: null };
      entry.total += 1;
      if (s.device_hash) entry.devices.add(s.device_hash);
      const hour = new Date(s.scanned_at).getHours();
      entry.hours[hour] += 1;
      globalHours[hour] += 1;
      if (s.device_hash) globalDevices.add(s.device_hash);
      if (!entry.last) entry.last = s.scanned_at;
      byLink.set(s.short_link_id, entry);
    }

    const peakHour = globalHours.some(Boolean) ? globalHours.indexOf(Math.max(...globalHours)) : null;
    return {
      byLink,
      total: scans.length,
      uniqueDevices: globalDevices.size,
      peakHour,
      globalHours,
    };
  }, [scans]);

  const shortUrl = (code: string) => `${window.location.origin}/t/${code}`;

  const createLink = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No restaurant');
      // Retry a few times in case of a code collision.
      for (let attempt = 0; attempt < 6; attempt++) {
        const code = randomCode(attempt < 3 ? 4 : 5);
        const { error } = await supabase.from('qr_short_links').insert({
          restaurant_id: restaurantId,
          code,
          table_id: newTableId || null,
          label: newLabel.trim() || null,
        });
        if (!error) return code;
        if (error.code !== '23505') throw error;
      }
      throw new Error('Could not generate a unique code, please try again');
    },
    onSuccess: (code) => {
      setNewLabel('');
      setNewTableId('');
      queryClient.invalidateQueries({ queryKey: ['qr_short_links', restaurantId] });
      toast.success(`Short code ${code} created`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLink = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { table_id?: string | null; is_active?: boolean; label?: string | null } }) => {
      const { error } = await supabase.from('qr_short_links').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['qr_short_links', restaurantId] });
      toast.success('Short link updated — printed codes now point to the new table');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const copy = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(shortUrl(code));
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      toast.success('Short link copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  const exportCsv = () => {
    if (!links.length) return;
    const rows = [
      ['Code', 'Label', 'Table', 'Active', 'Scans (30d)', 'Unique devices', 'Short link'],
      ...links.map((l: any) => {
        const s = stats.byLink.get(l.id);
        return [
          l.code,
          l.label ?? '',
          tables.find(t => t.id === l.table_id)?.label ?? 'Unassigned',
          l.is_active ? 'Yes' : 'No',
          String(s?.total ?? 0),
          String(s?.devices.size ?? 0),
          shortUrl(l.code),
        ];
      }),
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.download = 'qr-short-links.csv';
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const formatHour = (h: number) => {
    const suffix = h < 12 ? 'AM' : 'PM';
    const base = h % 12 === 0 ? 12 : h % 12;
    return `${base} ${suffix}`;
  };

  return (
    <div className="bg-card card-shadow ring-subtle rounded-lg p-4 mb-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="label-ui">Short QR Links & Scan Analytics</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Print <code className="text-xs">/t/CODE</code> instead of a table id — re-point a code to another
            table any time without reprinting.
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" disabled={!links.length} onClick={exportCsv}>
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {[
          { label: 'Scans (30d)', value: stats.total },
          { label: 'Unique devices', value: stats.uniqueDevices },
          { label: 'Peak hour', value: stats.peakHour === null ? '—' : formatHour(stats.peakHour) },
          { label: 'Active codes', value: links.filter((l: any) => l.is_active).length },
        ].map(card => (
          <div key={card.label} className="rounded-lg border border-border bg-secondary/40 p-3">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-lg font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Hour histogram */}
      {stats.total > 0 && (
        <div className="rounded-lg border border-border bg-secondary/30 p-3 mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Scans by hour (last 30 days)</p>
          </div>
          <div className="flex items-end gap-[3px] h-16" role="img" aria-label="Scans by hour of day">
            {stats.globalHours.map((count: number, h: number) => {
              const max = Math.max(...stats.globalHours, 1);
              return (
                <div
                  key={h}
                  title={`${formatHour(h)} — ${count} scan${count === 1 ? '' : 's'}`}
                  className="flex-1 rounded-t bg-primary/70 min-h-[2px]"
                  style={{ height: `${(count / max) * 100}%` }}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Create */}
      <div className="flex flex-wrap items-end gap-2 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Table</Label>
          <Select value={newTableId || UNASSIGNED} onValueChange={v => setNewTableId(v === UNASSIGNED ? '' : v)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
              {tables.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Label (optional)</Label>
          <Input
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            placeholder="Window tent card"
            className="w-[200px]"
            maxLength={60}
          />
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          disabled={createLink.isPending || !restaurantId}
          onClick={() => createLink.mutate()}
        >
          {createLink.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          Generate code
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading short links…</p>
      ) : !links.length ? (
        <p className="text-sm text-muted-foreground">
          No short codes yet. Generate one, print it, and re-point it whenever your floor plan changes.
        </p>
      ) : (
        <div className="space-y-2">
          {links.map((l: any) => {
            const s = stats.byLink.get(l.id);
            const peak = s?.hours.some(Boolean) ? s.hours.indexOf(Math.max(...s.hours)) : null;
            return (
              <div
                key={l.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-background p-3"
              >
                <div className="min-w-[90px]">
                  <p className="font-mono font-bold text-foreground">{l.code}</p>
                  {l.label && <p className="text-xs text-muted-foreground truncate max-w-[140px]">{l.label}</p>}
                </div>

                <Select
                  value={l.table_id ?? UNASSIGNED}
                  onValueChange={v =>
                    updateLink.mutate({ id: l.id, patch: { table_id: v === UNASSIGNED ? null : v } })
                  }
                >
                  <SelectTrigger className="w-[170px]" aria-label={`Table for code ${l.code}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                    {tables.map(t => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{s?.total ?? 0} scans</Badge>
                  <Badge variant="secondary">{s?.devices.size ?? 0} devices</Badge>
                  {peak !== null && <Badge variant="secondary">peak {formatHour(peak)}</Badge>}
                  {!l.is_active && <Badge variant="destructive">inactive</Badge>}
                </div>

                <div className="ml-auto flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => copy(l.id, l.code)}>
                    {copiedId === l.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    Copy
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => updateLink.mutate({ id: l.id, patch: { is_active: !l.is_active } })}
                  >
                    <Power className="h-3.5 w-3.5" />
                    {l.is_active ? 'Disable' : 'Enable'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
