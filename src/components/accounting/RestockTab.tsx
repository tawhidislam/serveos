import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Trash2, Truck, PackagePlus, CalendarClock } from 'lucide-react';
import { format, differenceInCalendarDays } from 'date-fns';

interface Props {
  restaurantId?: string;
  items: any[];
}

interface Line {
  key: string;
  item_id: string;
  quantity: string;
  unit_cost: string;
  expiry_date: string;
  batch_code: string;
}

const newLine = (): Line => ({
  key: Math.random().toString(36).slice(2),
  item_id: '',
  quantity: '',
  unit_cost: '',
  expiry_date: '',
  batch_code: '',
});

export default function RestockTab({ restaurantId, items }: Props) {
  const qc = useQueryClient();
  const { format: fc } = useCurrency();
  const [open, setOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: '', contact_name: '', phone: '', email: '' });
  const [header, setHeader] = useState({
    supplier_id: '',
    supplier_name: '',
    reference: '',
    received_date: format(new Date(), 'yyyy-MM-dd'),
    notes: '',
  });
  const [lines, setLines] = useState<Line[]>([newLine()]);

  const { data: suppliers = [] } = useQuery({
    queryKey: ['suppliers', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: receipts = [] } = useQuery({
    queryKey: ['stock-receipts', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_receipts')
        .select('*, stock_receipt_lines(*)')
        .eq('restaurant_id', restaurantId!)
        .order('received_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  const itemById = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items]);

  const batchTotal = lines.reduce(
    (s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_cost) || 0),
    0,
  );

  const expiring = useMemo(() => {
    const rows: any[] = [];
    (receipts as any[]).forEach(r =>
      (r.stock_receipt_lines || []).forEach((l: any) => {
        if (!l.expiry_date) return;
        const days = differenceInCalendarDays(new Date(l.expiry_date), new Date());
        if (days <= 30) rows.push({ ...l, days, supplier: r.supplier_name });
      }),
    );
    return rows.sort((a, b) => a.days - b.days).slice(0, 8);
  }, [receipts]);

  const createSupplier = useMutation({
    mutationFn: async () => {
      if (!supplierForm.name.trim()) throw new Error('Supplier name is required');
      const { data, error } = await supabase
        .from('suppliers')
        .insert({ ...supplierForm, restaurant_id: restaurantId! })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      setHeader(h => ({ ...h, supplier_id: data.id, supplier_name: data.name }));
      setSupplierForm({ name: '', contact_name: '', phone: '', email: '' });
      setSupplierOpen(false);
      toast.success('Supplier added');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const submitBatch = useMutation({
    mutationFn: async () => {
      const payload = lines
        .filter(l => l.item_id && Number(l.quantity) > 0)
        .map(l => ({
          item_id: l.item_id,
          quantity: Number(l.quantity),
          unit_cost: Number(l.unit_cost) || 0,
          expiry_date: l.expiry_date || null,
          batch_code: l.batch_code || null,
        }));
      if (payload.length === 0) throw new Error('Add at least one item with a quantity');

      const { error } = await supabase.rpc('receive_stock_batch', {
        _restaurant_id: restaurantId!,
        _supplier_id: header.supplier_id || null,
        _supplier_name:
          header.supplier_name ||
          (suppliers as any[]).find(s => s.id === header.supplier_id)?.name ||
          null,
        _reference: header.reference || null,
        _received_date: header.received_date,
        _notes: header.notes || null,
        _lines: payload,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['stock-receipts'] });
      qc.invalidateQueries({ queryKey: ['inventory-items'] });
      qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
      toast.success('Stock received');
      setOpen(false);
      setLines([newLine()]);
      setHeader({
        supplier_id: '',
        supplier_name: '',
        reference: '',
        received_date: format(new Date(), 'yyyy-MM-dd'),
        notes: '',
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateLine = (key: string, patch: Partial<Line>) =>
    setLines(ls => ls.map(l => (l.key === key ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Truck className="h-5 w-5" /> Restock &amp; Supplier Intake
              </CardTitle>
              <CardDescription>
                Receive deliveries in batches — costs and optional expiry dates per line.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Dialog open={supplierOpen} onOpenChange={setSupplierOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Plus className="h-4 w-4 mr-2" /> Supplier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Supplier</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Name</Label>
                      <Input
                        value={supplierForm.name}
                        onChange={e => setSupplierForm(f => ({ ...f, name: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <Label>Contact person</Label>
                        <Input
                          value={supplierForm.contact_name}
                          onChange={e => setSupplierForm(f => ({ ...f, contact_name: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={supplierForm.phone}
                          onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={supplierForm.email}
                        onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                      />
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => createSupplier.mutate()}
                      disabled={createSupplier.isPending}
                    >
                      {createSupplier.isPending ? 'Saving...' : 'Save Supplier'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <PackagePlus className="h-4 w-4 mr-2" /> Receive Stock
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85dvh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Receive Stock Batch</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <Label>Supplier</Label>
                        <Select
                          value={header.supplier_id || 'none'}
                          onValueChange={v =>
                            setHeader(h => ({
                              ...h,
                              supplier_id: v === 'none' ? '' : v,
                              supplier_name:
                                v === 'none'
                                  ? ''
                                  : (suppliers as any[]).find(s => s.id === v)?.name ?? '',
                            }))
                          }
                        >
                          <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No supplier</SelectItem>
                            {(suppliers as any[]).map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Invoice / Reference</Label>
                        <Input
                          value={header.reference}
                          onChange={e => setHeader(h => ({ ...h, reference: e.target.value }))}
                          placeholder="INV-1042"
                        />
                      </div>
                      <div>
                        <Label>Received date</Label>
                        <Input
                          type="date"
                          value={header.received_date}
                          onChange={e => setHeader(h => ({ ...h, received_date: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      {lines.map((l, idx) => {
                        const item = itemById[l.item_id];
                        return (
                          <div key={l.key} className="rounded-lg border p-3 space-y-3">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-muted-foreground">
                                Line {idx + 1}
                              </span>
                              <Button
                                size="icon"
                                variant="ghost"
                                aria-label="Remove line"
                                onClick={() =>
                                  setLines(ls => (ls.length === 1 ? [newLine()] : ls.filter(x => x.key !== l.key)))
                                }
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <Label>Item</Label>
                                <Select value={l.item_id} onValueChange={v => updateLine(l.key, { item_id: v })}>
                                  <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                                  <SelectContent>
                                    {items.filter(i => i.is_active).map(i => (
                                      <SelectItem key={i.id} value={i.id}>
                                        {i.name} ({i.unit})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <Label>Quantity {item ? `(${item.unit})` : ''}</Label>
                                <Input
                                  type="number"
                                  step="0.001"
                                  min="0"
                                  value={l.quantity}
                                  onChange={e => updateLine(l.key, { quantity: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Unit cost</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={l.unit_cost}
                                  onChange={e => updateLine(l.key, { unit_cost: e.target.value })}
                                />
                              </div>
                              <div>
                                <Label>Expiry date (optional)</Label>
                                <Input
                                  type="date"
                                  value={l.expiry_date}
                                  onChange={e => updateLine(l.key, { expiry_date: e.target.value })}
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <Label>Batch / lot code (optional)</Label>
                                <Input
                                  value={l.batch_code}
                                  onChange={e => updateLine(l.key, { batch_code: e.target.value })}
                                />
                              </div>
                            </div>
                            <p className="text-right text-sm text-muted-foreground">
                              Line total: {fc((Number(l.quantity) || 0) * (Number(l.unit_cost) || 0))}
                            </p>
                          </div>
                        );
                      })}
                      <Button variant="outline" onClick={() => setLines(ls => [...ls, newLine()])}>
                        <Plus className="h-4 w-4 mr-2" /> Add line
                      </Button>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea
                        value={header.notes}
                        onChange={e => setHeader(h => ({ ...h, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>

                    <div className="flex items-center justify-between border-t pt-3">
                      <span className="font-semibold">Batch total</span>
                      <span className="text-lg font-bold">{fc(batchTotal)}</span>
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => submitBatch.mutate()}
                      disabled={submitBatch.isPending}
                    >
                      {submitBatch.isPending ? 'Receiving...' : 'Receive Stock'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(receipts as any[]).map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.received_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{r.supplier_name || '—'}</TableCell>
                    <TableCell>{r.reference || '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(r.stock_receipt_lines || []).map((l: any) => (
                          <Badge key={l.id} variant="secondary" className="text-xs">
                            {itemById[l.item_id]?.name ?? 'Item'} · {Number(l.quantity)}
                            {l.expiry_date ? ` · exp ${format(new Date(l.expiry_date), 'MMM dd')}` : ''}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{fc(Number(r.total_cost))}</TableCell>
                  </TableRow>
                ))}
                {receipts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No stock received yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Expiring Soon
          </CardTitle>
          <CardDescription>Received batches expiring within 30 days.</CardDescription>
        </CardHeader>
        <CardContent>
          {expiring.length === 0 ? (
            <p className="text-sm text-muted-foreground">No batches expiring soon.</p>
          ) : (
            <div className="space-y-2">
              {expiring.map(l => (
                <div key={l.id} className="flex items-center justify-between rounded-md border p-2">
                  <span className="text-sm">
                    {itemById[l.item_id]?.name ?? 'Item'} — {Number(l.quantity)}{' '}
                    {itemById[l.item_id]?.unit ?? ''}
                    {l.batch_code ? ` · ${l.batch_code}` : ''}
                  </span>
                  <Badge variant={l.days < 0 ? 'destructive' : l.days <= 7 ? 'destructive' : 'secondary'}>
                    {l.days < 0 ? `Expired ${Math.abs(l.days)}d ago` : `${l.days}d left`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
