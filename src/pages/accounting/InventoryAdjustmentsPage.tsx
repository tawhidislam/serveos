import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Trash2, ClipboardCheck, TrendingDown, TrendingUp, Search } from 'lucide-react';
import { format } from 'date-fns';

const REASONS = [
  { value: 'waste', label: 'Waste' },
  { value: 'damage', label: 'Damage' },
  { value: 'expiry', label: 'Expiry' },
  { value: 'theft', label: 'Theft / Loss' },
  { value: 'cycle_count', label: 'Cycle count' },
  { value: 'correction', label: 'Correction' },
];

const reasonLabel = (v: string) => REASONS.find(r => r.value === v)?.label ?? v;

interface Line {
  key: string;
  item_id: string;
  mode: 'delta' | 'count';
  value: string;
  notes: string;
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  item_id: '',
  mode: 'delta',
  value: '',
  notes: '',
});

export default function InventoryAdjustmentsPage() {
  const qc = useQueryClient();
  const { format: fc } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;

  const [reason, setReason] = useState('waste');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([newLine()]);
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState('all');

  const { data: items = [] } = useQuery({
    queryKey: ['inventory-items', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: adjustments = [], isLoading } = useQuery({
    queryKey: ['inventory-adjustments', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_adjustments')
        .select('*, inventory_items(name, unit)')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['adjustment-profiles', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('user_id, display_name');
      if (error) throw error;
      return data as any[];
    },
  });

  const userName = (id: string | null) =>
    !id ? 'System' : profiles.find(p => p.user_id === id)?.display_name || id.slice(0, 8);

  const itemById = useMemo(() => Object.fromEntries((items as any[]).map(i => [i.id, i])), [items]);

  const preview = useMemo(
    () =>
      lines.map(l => {
        const item = itemById[l.item_id];
        const num = Number(l.value);
        if (!item || l.value === '' || Number.isNaN(num)) return { ...l, item, delta: 0, after: item?.current_stock ?? 0, valid: false };
        const delta = l.mode === 'count' ? num - Number(item.current_stock) : num;
        return { ...l, item, delta, after: Number(item.current_stock) + delta, valid: delta !== 0 };
      }),
    [lines, itemById],
  );

  const costImpact = preview.reduce(
    (s, p) => s + (p.item ? Math.abs(p.delta) * Number(p.item.cost_per_unit || 0) : 0),
    0,
  );

  const submit = useMutation({
    mutationFn: async () => {
      if (!restaurantId) throw new Error('No active restaurant');
      const payload = preview
        .filter(p => p.item && p.valid)
        .map(p =>
          p.mode === 'count'
            ? { item_id: p.item_id, counted_quantity: String(Number(p.value)), notes: p.notes }
            : { item_id: p.item_id, delta: Number(p.value), notes: p.notes },
        );
      if (payload.length === 0) throw new Error('Add at least one line with a non-zero change');
      const { data, error } = await supabase.rpc('apply_inventory_adjustments', {
        _restaurant_id: restaurantId,
        _reason: reason,
        _notes: notes,
        _reference: reference,
        _lines: payload as any,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (count) => {
      toast.success(`${count} adjustment${count === 1 ? '' : 's'} recorded`);
      setLines([newLine()]);
      setNotes('');
      setReference('');
      qc.invalidateQueries({ queryKey: ['inventory-adjustments'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to record adjustments'),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (adjustments as any[]).filter(a => {
      if (reasonFilter !== 'all' && a.reason !== reasonFilter) return false;
      if (!q) return true;
      return (
        (a.inventory_items?.name || '').toLowerCase().includes(q) ||
        (a.notes || '').toLowerCase().includes(q) ||
        (a.reference || '').toLowerCase().includes(q)
      );
    });
  }, [adjustments, reasonFilter, search]);

  const totalLoss = (adjustments as any[])
    .filter(a => Number(a.delta) < 0)
    .reduce((s, a) => s + Number(a.cost_impact || 0), 0);

  return (
    <AdminLayout>
      <div className="p-4 lg:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inventory Adjustments</h1>
          <p className="text-sm text-muted-foreground">
            Record manual corrections for waste, damage and cycle counts — every change is logged with a full audit trail
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Adjustments logged</p>
              <p className="text-2xl font-bold">{adjustments.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Value written off</p>
              <p className="text-2xl font-bold text-destructive">{fc(totalLoss)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Items tracked</p>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" /> New adjustment
            </CardTitle>
            <CardDescription>
              Use “Change by” for waste/damage (negative numbers) or “Counted” to set the exact stock from a physical count.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Reason</Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Reference (optional)</Label>
                <Input value={reference} onChange={e => setReference(e.target.value)} placeholder="Count sheet #12" />
              </div>
              <div className="space-y-2">
                <Label>Notes (optional)</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={1} placeholder="Applies to all lines" />
              </div>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const item = itemById[line.item_id];
                const p = preview[idx];
                return (
                  <div key={line.key} className="grid gap-2 md:grid-cols-12 items-end border rounded-lg p-3">
                    <div className="md:col-span-4 space-y-1">
                      <Label className="text-xs">Item</Label>
                      <Select
                        value={line.item_id}
                        onValueChange={v => setLines(ls => ls.map(l => (l.key === line.key ? { ...l, item_id: v } : l)))}
                      >
                        <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                        <SelectContent>
                          {(items as any[]).map(i => (
                            <SelectItem key={i.id} value={i.id}>{i.name} ({i.current_stock} {i.unit})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <Label className="text-xs">Mode</Label>
                      <Select
                        value={line.mode}
                        onValueChange={(v: any) => setLines(ls => ls.map(l => (l.key === line.key ? { ...l, mode: v } : l)))}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="delta">Change by (+/-)</SelectItem>
                          <SelectItem value="count">Counted quantity</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">{line.mode === 'count' ? 'Counted' : 'Change'}</Label>
                      <Input
                        type="number"
                        step="any"
                        value={line.value}
                        onChange={e => setLines(ls => ls.map(l => (l.key === line.key ? { ...l, value: e.target.value } : l)))}
                        placeholder={line.mode === 'count' ? '0' : '-2'}
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <Label className="text-xs">Line note</Label>
                      <Input
                        value={line.notes}
                        onChange={e => setLines(ls => ls.map(l => (l.key === line.key ? { ...l, notes: e.target.value } : l)))}
                        placeholder="Optional"
                      />
                    </div>
                    <div className="md:col-span-1 flex justify-end">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setLines(ls => (ls.length === 1 ? [newLine()] : ls.filter(l => l.key !== line.key)))}
                        aria-label="Remove line"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {item && p?.valid && (
                      <p className="md:col-span-12 text-xs text-muted-foreground">
                        {item.current_stock} → <span className="font-medium text-foreground">{p.after}</span> {item.unit}
                        {' · '}
                        <span className={p.delta < 0 ? 'text-destructive' : 'text-primary'}>
                          {p.delta > 0 ? '+' : ''}{p.delta}
                        </span>
                        {' · '}{fc(Math.abs(p.delta) * Number(item.cost_per_unit || 0))}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={() => setLines(ls => [...ls, newLine()])}>
                <Plus className="h-4 w-4 mr-1" /> Add line
              </Button>
              <div className="flex items-center gap-4">
                <span className="text-sm text-muted-foreground">Cost impact: <strong className="text-foreground">{fc(costImpact)}</strong></span>
                <Button onClick={() => submit.mutate()} disabled={submit.isPending}>
                  {submit.isPending ? 'Saving…' : 'Apply adjustments'}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audit trail</CardTitle>
            <CardDescription>Every manual stock correction with before/after values and who made it</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search item, note or reference" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reasons</SelectItem>
                  {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Before</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                    <TableHead className="text-right">After</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>By</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No adjustments recorded yet</TableCell></TableRow>
                  ) : (
                    filtered.map(a => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap text-sm">{format(new Date(a.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                        <TableCell className="font-medium">{a.inventory_items?.name || '—'}</TableCell>
                        <TableCell><Badge variant="outline">{reasonLabel(a.reason)}</Badge></TableCell>
                        <TableCell className="text-right">{a.quantity_before} {a.inventory_items?.unit}</TableCell>
                        <TableCell className={`text-right font-medium ${Number(a.delta) < 0 ? 'text-destructive' : 'text-primary'}`}>
                          <span className="inline-flex items-center gap-1 justify-end">
                            {Number(a.delta) < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Number(a.delta) > 0 ? '+' : ''}{a.delta}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{a.quantity_after} {a.inventory_items?.unit}</TableCell>
                        <TableCell className="text-right">{fc(Number(a.cost_impact || 0))}</TableCell>
                        <TableCell className="text-sm">{userName(a.adjusted_by)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-[220px] truncate">
                          {[a.reference, a.notes].filter(Boolean).join(' · ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))
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
