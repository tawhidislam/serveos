import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SelectedAddon {
  addonId: string;
  optionId: string;
  optionName: string;
  priceModifier: number;
}

export interface CartItem {
  cartKey: string; // unique key = menuItemId + sorted addon option ids
  menuItemId: string;
  restaurantId: string | null; // tenant scope; null = legacy/unknown
  name: string;
  price: number;
  quantity: number;
  notes?: string;
  selectedAddons?: SelectedAddon[];
  selectedTags?: string[];
}

function makeCartKey(menuItemId: string, addons?: SelectedAddon[]): string {
  if (!addons || addons.length === 0) return menuItemId;
  const sorted = [...addons].sort((a, b) => a.optionId.localeCompare(b.optionId));
  return `${menuItemId}::${sorted.map(a => a.optionId).join(',')}`;
}

interface CartStore {
  items: CartItem[]; // ALL items across tenants (raw)
  tableId: string | null;
  activeRestaurantId: string | null;
  setActiveRestaurant: (id: string | null) => void;
  setTableId: (id: string) => void;
  addItem: (item: Omit<CartItem, 'quantity' | 'cartKey' | 'restaurantId'> & { restaurantId?: string | null }) => void;
  removeItem: (cartKey: string) => void;
  updateQuantity: (cartKey: string, quantity: number) => void;
  updateNotes: (cartKey: string, notes: string) => void;
  updateTags: (cartKey: string, tags: string[]) => void;
  clearCart: () => void;
  resetCart: (userId?: string | null) => void;
  mergeItems: (incoming: CartItem[]) => void;
  totalItems: () => number;
  totalAmount: () => number;
  getQtyForItem: (menuItemId: string) => number;
}

const USER_CART_PREFIX = 'restaurant-cart:user:';

function userCartKey(userId: string, restaurantId: string | null) {
  return `${USER_CART_PREFIX}${userId}:${restaurantId ?? 'none'}`;
}

export function saveCartForUser(userId: string, restaurantId: string | null, items: CartItem[]) {
  try { localStorage.setItem(userCartKey(userId, restaurantId), JSON.stringify(items)); } catch {}
}

export function loadCartForUser(userId: string, restaurantId: string | null): CartItem[] {
  try {
    const raw = localStorage.getItem(userCartKey(userId, restaurantId));
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch { return []; }
}

export function clearPersistedUserCart(userId: string, restaurantId: string | null) {
  try { localStorage.removeItem(userCartKey(userId, restaurantId)); } catch {}
}

export function mergeCartItems(a: CartItem[], b: CartItem[]): CartItem[] {
  const map = new Map<string, CartItem>();
  for (const it of [...a, ...b]) {
    // Scope merge key by restaurant so identical menuItemIds across tenants never collide.
    const key = `${it.restaurantId ?? 'none'}::${it.cartKey}`;
    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        ...existing,
        quantity: existing.quantity + it.quantity,
        notes: existing.notes || it.notes,
        selectedTags: (existing.selectedTags?.length ? existing.selectedTags : it.selectedTags) || [],
      });
    } else {
      map.set(key, { ...it });
    }
  }
  return Array.from(map.values());
}

export const useCartStore = create<CartStore>()(persist((set, get) => ({
  items: [],
  tableId: null,
  activeRestaurantId: null,
  setActiveRestaurant: (id) => set((state) => {
    if (state.activeRestaurantId === id) return state;
    // When switching tenants we drop any items belonging to other restaurants from the
    // visible/active workspace by filtering them out entirely. This guarantees customers
    // never see or reuse another restaurant's cart.
    return {
      activeRestaurantId: id,
      items: state.items.filter(i => i.restaurantId === id),
      tableId: null,
    };
  }),
  setTableId: (id) => set({ tableId: id }),
  addItem: (item) => set((state) => {
    const restaurantId = item.restaurantId ?? state.activeRestaurantId ?? null;
    const cartKey = makeCartKey(item.menuItemId, item.selectedAddons);
    const existing = state.items.find(i => i.cartKey === cartKey && i.restaurantId === restaurantId);
    if (existing) {
      return {
        items: state.items.map(i =>
          i.cartKey === cartKey && i.restaurantId === restaurantId
            ? { ...i, quantity: i.quantity + 1 }
            : i
        ),
      };
    }
    return { items: [...state.items, { ...item, restaurantId, cartKey, quantity: 1 }] };
  }),
  removeItem: (cartKey) => set((state) => ({
    items: state.items.filter(i => !(i.cartKey === cartKey && i.restaurantId === state.activeRestaurantId)),
  })),
  updateQuantity: (cartKey, quantity) => set((state) => {
    const active = state.activeRestaurantId;
    return {
      items: quantity <= 0
        ? state.items.filter(i => !(i.cartKey === cartKey && i.restaurantId === active))
        : state.items.map(i => (i.cartKey === cartKey && i.restaurantId === active) ? { ...i, quantity } : i),
    };
  }),
  updateNotes: (cartKey, notes) => set((state) => {
    const active = state.activeRestaurantId;
    return { items: state.items.map(i => (i.cartKey === cartKey && i.restaurantId === active) ? { ...i, notes } : i) };
  }),
  updateTags: (cartKey, tags) => set((state) => {
    const active = state.activeRestaurantId;
    return { items: state.items.map(i => (i.cartKey === cartKey && i.restaurantId === active) ? { ...i, selectedTags: tags } : i) };
  }),
  clearCart: () => set((state) => ({ items: state.items.filter(i => i.restaurantId !== state.activeRestaurantId) })),
  // Full reset: wipes the active tenant's items in memory AND removes the matching
  // persisted per-user cart entry from localStorage. Called after successful checkout
  // and from the explicit "Clear cart" UI action.
  resetCart: (userId) => {
    const active = get().activeRestaurantId;
    set((state) => ({ items: state.items.filter(i => i.restaurantId !== active) }));
    if (userId) clearPersistedUserCart(userId, active);
  },
  mergeItems: (incoming) => set((state) => ({ items: mergeCartItems(state.items, incoming) })),
  totalItems: () => {
    const active = get().activeRestaurantId;
    return get().items.filter(i => i.restaurantId === active).reduce((sum, i) => sum + i.quantity, 0);
  },
  totalAmount: () => {
    const active = get().activeRestaurantId;
    return get().items.filter(i => i.restaurantId === active).reduce((sum, i) => {
      const addonTotal = i.selectedAddons?.reduce((s, a) => s + a.priceModifier, 0) ?? 0;
      return sum + (i.price + addonTotal) * i.quantity;
    }, 0);
  },
  getQtyForItem: (menuItemId) => {
    const active = get().activeRestaurantId;
    return get().items
      .filter(i => i.menuItemId === menuItemId && i.restaurantId === active)
      .reduce((sum, i) => sum + i.quantity, 0);
  },
}), {
  name: 'restaurant-cart',
  version: 2,
  migrate: (persisted: any) => {
    // v1 had no restaurantId on items — drop legacy items so cross-tenant leakage cannot occur.
    if (!persisted) return persisted;
    if (persisted.version === undefined || persisted.version < 2) {
      return { ...persisted, items: [], activeRestaurantId: null, tableId: null };
    }
    return persisted;
  },
}));
