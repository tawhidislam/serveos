import { useState } from 'react';
import { MapPin, Plus, Trash2, Star, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCustomerAddresses, type CustomerAddress } from '@/hooks/useCustomerAddresses';

const inputClass =
  'w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

/** Saved delivery addresses manager for the customer portal. */
export default function SavedAddresses({ restaurantId }: { restaurantId: string | null | undefined }) {
  const { addresses, isLoading, canSave, saveAddress, deleteAddress, setDefault } =
    useCustomerAddresses(restaurantId);
  const [editing, setEditing] = useState<CustomerAddress | 'new' | null>(null);
  const [form, setForm] = useState({ label: 'Home', address: '', phone: '', instructions: '', is_default: false });

  const openNew = () => {
    setForm({ label: 'Home', address: '', phone: '', instructions: '', is_default: addresses.length === 0 });
    setEditing('new');
  };
  const openEdit = (a: CustomerAddress) => {
    setForm({
      label: a.label,
      address: a.address,
      phone: a.phone ?? '',
      instructions: a.instructions ?? '',
      is_default: a.is_default,
    });
    setEditing(a);
  };

  const submit = () => {
    if (!form.address.trim()) return;
    saveAddress.mutate(
      {
        id: editing && editing !== 'new' ? editing.id : undefined,
        label: form.label.trim() || 'Address',
        address: form.address.trim(),
        phone: form.phone.trim() || null,
        instructions: form.instructions.trim() || null,
        is_default: form.is_default,
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  if (!canSave) return null;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold tracking-tight">Saved Addresses</h2>
        {!editing && (
          <Button size="sm" variant="outline" className="gap-1" onClick={openNew}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>

      {editing && (
        <Card className="p-4 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{editing === 'new' ? 'New address' : 'Edit address'}</p>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <input
            className={inputClass}
            placeholder="Label (Home, Work…)"
            aria-label="Address label"
            value={form.label}
            maxLength={40}
            onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
          />
          <textarea
            className={`${inputClass} min-h-[70px] resize-none`}
            placeholder="Full delivery address"
            aria-label="Full delivery address"
            value={form.address}
            maxLength={300}
            onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Phone (optional)"
            aria-label="Phone"
            value={form.phone}
            maxLength={30}
            onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
          />
          <input
            className={inputClass}
            placeholder="Delivery notes (optional)"
            aria-label="Delivery notes"
            value={form.instructions}
            maxLength={200}
            onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
          />
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => setForm(f => ({ ...f, is_default: e.target.checked }))}
            />
            Use as my default address
          </label>
          <Button size="sm" onClick={submit} disabled={saveAddress.isPending || !form.address.trim()}>
            Save address
          </Button>
        </Card>
      )}

      {isLoading ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">Loading addresses…</Card>
      ) : addresses.length === 0 ? (
        !editing && (
          <Card className="p-8 text-center">
            <MapPin className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No saved addresses yet</p>
          </Card>
        )
      ) : (
        <div className="space-y-2">
          {addresses.map(a => (
            <Card key={a.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">{a.label}</span>
                    {a.is_default && <Badge variant="secondary" className="text-[10px]">Default</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{a.address}</p>
                  {a.phone && <p className="text-xs text-muted-foreground mt-0.5">{a.phone}</p>}
                  {a.instructions && <p className="text-xs text-muted-foreground mt-0.5">{a.instructions}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!a.is_default && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      aria-label="Set as default"
                      onClick={() => setDefault.mutate(a.id)}
                    >
                      <Star className="h-4 w-4" />
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => openEdit(a)}>Edit</Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive"
                    aria-label="Delete address"
                    onClick={() => deleteAddress.mutate(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
