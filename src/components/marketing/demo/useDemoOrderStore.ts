import { useSyncExternalStore } from 'react';

export type DemoOrderStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface DemoOrderItem {
  name: string;
  qty: number;
  price: number;
  note?: string;
}

export interface DemoOrder {
  id: string;
  num: number;
  table: string;
  items: DemoOrderItem[];
  total: number;
  status: DemoOrderStatus;
  createdAt: number;
  fresh: boolean; // newly added (for highlight animation)
}

let orders: DemoOrder[] = [];
let nextNum = 1290;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function patch(id: string, fn: (o: DemoOrder) => DemoOrder) {
  orders = orders.map((o) => (o.id === id ? fn(o) : o));
  emit();
}

export const demoOrderStore = {
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
  getSnapshot() {
    return orders;
  },
  add(input: { table: string; items: DemoOrderItem[] }) {
    const id = `demo-${Date.now()}`;
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    const order: DemoOrder = {
      id,
      num: nextNum++,
      table: input.table,
      items: input.items,
      total,
      status: 'pending',
      createdAt: Date.now(),
      fresh: true,
    };
    orders = [order, ...orders];
    emit();
    // remove "fresh" highlight after a short window
    setTimeout(() => patch(id, (o) => ({ ...o, fresh: false })), 5000);
    return order;
  },
  advance(id: string) {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const next: Record<DemoOrderStatus, DemoOrderStatus> = {
      pending: 'preparing',
      preparing: 'ready',
      ready: 'served',
      served: 'served',
    };
    patch(id, (o) => ({ ...o, status: next[o.status] }));
  },
  reset() {
    orders = [];
    emit();
  },
};

export function useDemoOrders(): DemoOrder[] {
  return useSyncExternalStore(demoOrderStore.subscribe, demoOrderStore.getSnapshot, demoOrderStore.getSnapshot);
}