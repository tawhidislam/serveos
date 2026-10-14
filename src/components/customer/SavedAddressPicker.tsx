import { MapPin, Plus, Check } from 'lucide-react';
import { useCustomerAddresses } from '@/hooks/useCustomerAddresses';

/**
 * Compact saved-address chips shown inside the delivery checkout panel.
 * Lets a signed-in guest fill the form in one tap, or save what they typed.
 */
export default function SavedAddressPicker({
  restaurantId,
  address,
  phone,
  instructions,
  onPick,
}: {
  restaurantId: string | null | undefined;
  address: string;
  phone: string;
  instructions: string;
  onPick: (v: { address: string; phone?: string | null; instructions?: string | null }) => void;
}) {
  const { addresses, canSave, saveAddress } = useCustomerAddresses(restaurantId);
  if (!canSave) return null;

  const alreadySaved = addresses.some(
    a => a.address.trim().toLowerCase() === address.trim().toLowerCase(),
  );

  return (
    <div className="space-y-2">
      {addresses.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {addresses.map(a => {
            const active = a.address.trim() === address.trim();
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick({ address: a.address, phone: a.phone, instructions: a.instructions })}
                className={`flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                {active ? <Check className="h-3 w-3 shrink-0" /> : <MapPin className="h-3 w-3 shrink-0" />}
                <span className="font-medium">{a.label}</span>
                <span className="truncate opacity-70">· {a.address}</span>
              </button>
            );
          })}
        </div>
      )}
      {address.trim().length > 5 && !alreadySaved && (
        <button
          type="button"
          disabled={saveAddress.isPending}
          onClick={() =>
            saveAddress.mutate({
              label: addresses.length === 0 ? 'Home' : `Address ${addresses.length + 1}`,
              address: address.trim(),
              phone: phone.trim() || null,
              instructions: instructions.trim() || null,
              is_default: addresses.length === 0,
            })
          }
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline disabled:opacity-50"
        >
          <Plus className="h-3 w-3" /> Save this address for next time
        </button>
      )}
    </div>
  );
}
