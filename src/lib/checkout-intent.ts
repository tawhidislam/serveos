/**
 * Checkout intent — how a customer arrived at the menu (delivery / pickup /
 * dine-in / reservation).
 *
 * CTA links, QR codes, marketing emails and custom domains all point at the
 * menu with slightly different query strings, so we parse a generous set of
 * aliases and then persist the resolved intent per tenant. Persistence is what
 * makes preselection reliable: the choice survives item-detail navigation,
 * the sign-in round trip and any redirect that drops the query string.
 */
export type CheckoutIntent = 'delivery' | 'pickup' | 'dine_in' | 'reserve';

const ALIASES: Record<string, CheckoutIntent> = {
  delivery: 'delivery',
  deliver: 'delivery',
  home_delivery: 'delivery',
  'home-delivery': 'delivery',
  pickup: 'pickup',
  'pick-up': 'pickup',
  pick_up: 'pickup',
  takeaway: 'pickup',
  'take-away': 'pickup',
  takeout: 'pickup',
  collection: 'pickup',
  self_pickup: 'pickup',
  dinein: 'dine_in',
  'dine-in': 'dine_in',
  dine_in: 'dine_in',
  table: 'dine_in',
  qr: 'dine_in',
  reserve: 'reserve',
  reservation: 'reserve',
  booking: 'reserve',
  book: 'reserve',
};

/** Query keys an inbound link may use to express the intent. */
const PARAM_KEYS = ['order', 'order_type', 'ordertype', 'fulfillment', 'type', 'mode', 'intent'];

const storageKey = (restaurantId?: string | null) => `checkout_intent:${restaurantId || 'default'}`;

export function normalizeIntent(raw?: string | null): CheckoutIntent | null {
  if (!raw) return null;
  return ALIASES[raw.trim().toLowerCase().replace(/\s+/g, '-')] ?? null;
}

/**
 * Read the intent from a URL's query string and hash
 * (`?order=delivery`, `?fulfillment=takeaway`, `#order=pickup`, `#reserve`).
 */
export function readIntentFromUrl(search: string, hash = ''): CheckoutIntent | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of PARAM_KEYS) {
    const found = normalizeIntent(params.get(key));
    if (found) return found;
  }
  const rawHash = hash.replace(/^#/, '');
  if (!rawHash) return null;
  if (rawHash.includes('=')) {
    const hashParams = new URLSearchParams(rawHash);
    for (const key of PARAM_KEYS) {
      const found = normalizeIntent(hashParams.get(key));
      if (found) return found;
    }
    return null;
  }
  return normalizeIntent(rawHash);
}

export function storeIntent(intent: CheckoutIntent | null, restaurantId?: string | null) {
  try {
    if (!intent) sessionStorage.removeItem(storageKey(restaurantId));
    else sessionStorage.setItem(storageKey(restaurantId), intent);
  } catch { /* storage unavailable */ }
}

export function loadStoredIntent(restaurantId?: string | null): CheckoutIntent | null {
  try {
    return normalizeIntent(sessionStorage.getItem(storageKey(restaurantId)));
  } catch {
    return null;
  }
}

/** Clears the sticky intent — call once an order is placed. */
export function clearIntent(restaurantId?: string | null) {
  storeIntent(null, restaurantId);
}

/**
 * Resolve the intent that should actually be applied, given what the
 * restaurant currently offers. Returns null when nothing is applicable.
 */
export function resolveApplicableIntent(
  intent: CheckoutIntent | null,
  opts: { deliveryEnabled: boolean; pickupEnabled: boolean },
): 'delivery' | 'pickup' | null {
  if (intent === 'delivery' && opts.deliveryEnabled) return 'delivery';
  if (intent === 'pickup' && opts.pickupEnabled) return 'pickup';
  return null;
}
