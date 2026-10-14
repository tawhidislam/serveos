import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useSettings } from '@/hooks/useSettings';
import { useCurrency } from '@/lib/currency';
import { printHtml } from '@/lib/print-html';
import { buildOrderPrintDocument, type OrderPrintOrder, type OrderPrintItem } from '@/lib/order-print-document';

/**
 * Global auto-print for new orders.
 *
 * Mounted once inside `AdminLayout`, so it stays alive on every admin page
 * (not just /admin/orders). When enabled and a brand-new `pending` order
 * arrives via realtime, it prints ONE combined document (kitchen ticket +
 * invoice receipt) through a hidden iframe.
 *
 * Guards:
 *   - Only orders for the currently-viewed restaurant (impersonation-safe).
 *   - Skips orders created by the current user — POS already auto-prints
 *     its own receipts, so printing here would duplicate paper.
 *   - Dedup set prevents double prints from refetches/catch-up overlap.
 *   - Catch-up query on mount covers orders that arrived while the layout
 *     was remounting between admin pages (realtime subscription gap).
 *
 * The toggle is persisted per device in localStorage (`admin-auto-print`),
 * mirroring the KDS auto-print convention.
 */

const TOGGLE_KEY = 'admin-auto-print';
const LAST_SEEN_KEY = 'admin-autoprint-last-seen';

function readToggle(): boolean {
  try {
    return localStorage.getItem(TOGGLE_KEY) === 'true';
  } catch {
    return false;
  }
}

function readLastSeen(restaurantId: string): string | null {
  try {
    return localStorage.getItem(`${LAST_SEEN_KEY}:${restaurantId}`);
  } catch {
    return null;
  }
}

function writeLastSeen(restaurantId: string, iso: string): void {
  try {
    localStorage.setItem(`${LAST_SEEN_KEY}:${restaurantId}`, iso);
  } catch {
    /* noop */
  }
}

interface OrderRow {
  id: string;
  created_at: string;
  status: string;
  user_id: string | null;
  restaurant_id: string | null;
  ticket_number: number | null;
  table_id: string | null;
  order_type: string | null;
  notes: string | null;
  tax_rate: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  paid_at: string | null;
  payment_method: string | null;
  restaurant_tables?: { label: string } | null;
}

interface OrderItemRow {
  id: string;
  quantity: number;
  notes: string | null;
  selected_tags: string[] | null;
  menu_items?: { name: string; price: number; prep_time_minutes: number | null } | null;
}

interface Props {
  /** Controlled toggle state (owned by AdminLayout so it can render the toolbar button). */
  enabled: boolean;
}

export default function AdminOrderAutoPrint({ enabled }: Props) {
  const { user } = useAuth();
  const { data: restaurant } = useCurrentRestaurant();
  const { data: settings } = useSettings();
  const { format: fmt } = useCurrency();
  const restaurantId = restaurant?.id ?? null;

  const printedRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef(settings);
  const fmtRef = useRef(fmt);
  settingsRef.current = settings;
  fmtRef.current = fmt;

  /**
   * Fetch full order + items, build the combined document, and print it.
   * Items may not exist yet when the realtime INSERT on `orders` fires
   * (POS inserts order first, then items) — poll briefly until they land.
   */
  const processOrder = useCallback(
    async (orderId: string) => {
      if (!restaurantId) return;
      printedRef.current.add(orderId);

      // Poll for order_items — POS inserts them right after the order row.
      const ITEM_POLL_MS = 400;
      const ITEM_POLL_TRIES = 10;

      let orderRow: OrderRow | null = null;
      let items: OrderItemRow[] = [];

      for (let attempt = 0; attempt < ITEM_POLL_TRIES; attempt++) {
        const { data: order } = await supabase
          .from('orders')
          .select('*, restaurant_tables(label)')
          .eq('id', orderId)
          .maybeSingle();
        if (!order) return; // deleted meanwhile — nothing to print
        orderRow = order as unknown as OrderRow;

        const { data: itemRows } = await supabase
          .from('order_items')
          .select('*, menu_items(name, price, prep_time_minutes)')
          .eq('order_id', orderId);
        items = (itemRows as unknown as OrderItemRow[]) ?? [];

        if (items.length > 0) break;
        await new Promise((r) => setTimeout(r, ITEM_POLL_MS));
      }

      if (!orderRow || items.length === 0) return;

      // Re-check: only print orders still pending (staff may have cancelled
      // or resolved it while we were polling).
      if (orderRow.status !== 'pending') return;

      const printItems: OrderPrintItem[] = items.map((i) => ({
        name: i.menu_items?.name ?? 'Unknown',
        quantity: i.quantity,
        unitPrice: Number(i.menu_items?.price ?? 0),
        notes: i.notes ?? null,
        selectedTags: i.selected_tags ?? [],
        prepTimeMinutes: i.menu_items?.prep_time_minutes ?? null,
      }));

      const subtotal = printItems.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const taxRate = Number(orderRow.tax_rate ?? 0);
      const taxAmount = subtotal * (taxRate / 100);

      const printOrder: OrderPrintOrder = {
        id: orderRow.id,
        ticketNumber: orderRow.ticket_number ?? null,
        tableLabel: orderRow.restaurant_tables?.label ?? null,
        orderType: orderRow.order_type ?? null,
        status: orderRow.status,
        createdAt: orderRow.created_at,
        notes: orderRow.notes ?? null,
        items: printItems,
        subtotal,
        taxRate,
        taxAmount,
        discountAmount: Number(orderRow.discount_amount ?? 0),
        grandTotal: Number(orderRow.total_amount ?? subtotal + taxAmount),
        paidAt: orderRow.paid_at ?? null,
        paymentMethod: orderRow.payment_method ?? null,
      };

      const restaurantName = settingsRef.current?.restaurant_name ?? 'Restaurant';
      const html = buildOrderPrintDocument(printOrder, restaurantName, (n) => fmtRef.current(n));
      printHtml(html, { jobName: `order-${orderRow.ticket_number ?? orderRow.id.slice(0, 8)}` });

      writeLastSeen(restaurantId, orderRow.created_at);
    },
    [restaurantId]
  );

  /* ── realtime listener (only while enabled) ── */
  useEffect(() => {
    if (!enabled || !restaurantId) return;

    const currentUserId = user?.id;
    const channel = supabase
      .channel(`admin-autoprint-${restaurantId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          const order = payload.new as unknown as OrderRow;
          // Tenant guard — realtime is RLS-scoped but impersonation can
          // change the active restaurant mid-session.
          if (order.restaurant_id !== restaurantId) return;
          // POS self-print guard.
          if (currentUserId && order.user_id === currentUserId) return;
          // Only brand-new pending orders.
          if (order.status !== 'pending') return;
          if (printedRef.current.has(order.id)) return;
          void processOrder(order.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, restaurantId, user?.id, processOrder]);

  /* ── catch-up on mount: orders missed during layout remount gaps ── */
  useEffect(() => {
    if (!enabled || !restaurantId || !user) return;
    let cancelled = false;
    const currentUserId = user.id;

    (async () => {
      const lastSeen = readLastSeen(restaurantId);
      if (!lastSeen) return; // first ever run — nothing to catch up

      // Small overlap window guards against clock skew / timestamp rounding.
      const since = new Date(new Date(lastSeen).getTime() - 5_000).toISOString();

      const { data: missed } = await supabase
        .from('orders')
        .select('id, created_at, user_id, status')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .gt('created_at', since)
        .order('created_at', { ascending: true });

      if (cancelled || !missed) return;

      // Seed the dedup set with every pending order older than the window so
      // historical pendings never print; only genuinely-new ones process.
      const { data: allPending } = await supabase
        .from('orders')
        .select('id, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (allPending) {
        for (const row of allPending) {
          if (row.created_at <= since) printedRef.current.add(row.id);
        }
      }

      for (const row of missed) {
        if (cancelled) return;
        if (row.user_id === currentUserId) continue; // POS self-print guard
        if (printedRef.current.has(row.id)) continue;
        await processOrder(row.id);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally runs once per mount — restaurantId/user captured at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, restaurantId, user]);

  return null;
}
