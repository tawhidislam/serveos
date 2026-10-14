import { Store, Bike, Utensils } from 'lucide-react';
import SavedAddressPicker from '@/components/customer/SavedAddressPicker';

export type FulfillmentType = 'dine_in' | 'pickup' | 'delivery';

export interface FulfillmentDetails {
  orderType: FulfillmentType;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryInstructions: string;
}

export const emptyFulfillment: FulfillmentDetails = {
  orderType: 'pickup',
  customerName: '',
  customerPhone: '',
  deliveryAddress: '',
  deliveryInstructions: '',
};

export interface FulfillmentConfig {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  deliveryFee: number;
  freeDeliveryMin: number | null;
  deliveryMinOrder: number;
  deliveryEtaMinutes: number;
  pickupEtaMinutes: number;
  deliveryAreaNote: string | null;
}

/** Delivery fee for a given subtotal, respecting the free-delivery threshold. */
export function computeDeliveryFee(cfg: FulfillmentConfig, orderType: FulfillmentType, subtotal: number) {
  if (orderType !== 'delivery') return 0;
  if (cfg.freeDeliveryMin != null && subtotal >= cfg.freeDeliveryMin) return 0;
  return Math.max(0, cfg.deliveryFee || 0);
}

/** Returns an error message when the details are incomplete, otherwise null. */
export function validateFulfillment(
  cfg: FulfillmentConfig,
  d: FulfillmentDetails,
  subtotal: number,
): string | null {
  if (d.orderType === 'dine_in') return null;
  if (!d.customerName.trim()) return 'Please enter your name';
  if (d.customerPhone.trim().length < 6) return 'Please enter a valid phone number';
  if (d.orderType === 'delivery') {
    if (!d.deliveryAddress.trim()) return 'Please enter your delivery address';
    if (cfg.deliveryMinOrder > 0 && subtotal < cfg.deliveryMinOrder) {
      return `Minimum order for delivery is ${cfg.deliveryMinOrder}`;
    }
  }
  return null;
}

const inputClass =
  'w-full rounded-xl border border-input bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring';

export default function FulfillmentPanel({
  config,
  value,
  onChange,
  format,
  subtotal,
  allowDineIn = false,
  restaurantId,
}: {
  config: FulfillmentConfig;
  value: FulfillmentDetails;
  onChange: (next: FulfillmentDetails) => void;
  format: (n: number) => string;
  subtotal: number;
  allowDineIn?: boolean;
  restaurantId?: string | null;
}) {
  const options: { type: FulfillmentType; label: string; icon: typeof Store; eta?: number }[] = [];
  if (allowDineIn) options.push({ type: 'dine_in', label: 'Dine in', icon: Utensils });
  if (config.pickupEnabled) options.push({ type: 'pickup', label: 'Pickup', icon: Store, eta: config.pickupEtaMinutes });
  if (config.deliveryEnabled) options.push({ type: 'delivery', label: 'Delivery', icon: Bike, eta: config.deliveryEtaMinutes });

  if (options.length === 0) return null;

  const set = (patch: Partial<FulfillmentDetails>) => onChange({ ...value, ...patch });
  const fee = computeDeliveryFee(config, value.orderType, subtotal);

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
          How would you like your order?
        </p>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Order type">
          {options.map(opt => {
            const Icon = opt.icon;
            const active = value.orderType === opt.type;
            return (
              <button
                key={opt.type}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => set({ orderType: opt.type })}
                className={`flex flex-col items-start gap-1 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  active
                    ? 'border-primary bg-primary/10 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:text-foreground'
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4" strokeWidth={1.75} /> {opt.label}
                </span>
                {opt.eta ? <span className="text-[11px]">~{opt.eta} min</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {value.orderType !== 'dine_in' && (
        <div className="space-y-2">
          <input
            className={inputClass}
            placeholder="Your name"
            aria-label="Your name"
            value={value.customerName}
            onChange={e => set({ customerName: e.target.value })}
            maxLength={80}
          />
          <input
            className={inputClass}
            placeholder="Phone number"
            aria-label="Phone number"
            type="tel"
            inputMode="tel"
            value={value.customerPhone}
            onChange={e => set({ customerPhone: e.target.value })}
            maxLength={30}
          />
          {value.orderType === 'delivery' && (
            <>
              <SavedAddressPicker
                restaurantId={restaurantId}
                address={value.deliveryAddress}
                phone={value.customerPhone}
                instructions={value.deliveryInstructions}
                onPick={picked =>
                  set({
                    deliveryAddress: picked.address,
                    customerPhone: value.customerPhone || picked.phone || '',
                    deliveryInstructions: picked.instructions ?? value.deliveryInstructions,
                  })
                }
              />
              <textarea
                className={`${inputClass} min-h-[72px] resize-none`}
                placeholder="Delivery address"
                aria-label="Delivery address"
                value={value.deliveryAddress}
                onChange={e => set({ deliveryAddress: e.target.value })}
                maxLength={300}
              />
              <input
                className={inputClass}
                placeholder="Delivery notes (optional)"
                aria-label="Delivery notes"
                value={value.deliveryInstructions}
                onChange={e => set({ deliveryInstructions: e.target.value })}
                maxLength={200}
              />
              {config.deliveryAreaNote && (
                <p className="text-[11px] text-muted-foreground">{config.deliveryAreaNote}</p>
              )}
              {config.deliveryMinOrder > 0 && subtotal < config.deliveryMinOrder && (
                <p className="text-[11px] text-destructive">
                  Minimum delivery order is {format(config.deliveryMinOrder)}.
                </p>
              )}
              {config.freeDeliveryMin != null && fee > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Free delivery on orders over {format(config.freeDeliveryMin)}.
                </p>
              )}
            </>
          )}
          <p className="text-[11px] text-muted-foreground">
            Payment is cash on {value.orderType === 'delivery' ? 'delivery' : 'pickup'}.
          </p>
        </div>
      )}
    </div>
  );
}
