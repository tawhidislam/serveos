-- Harden guest order creation: replace unconditional INSERT policies with
-- validated ones that ensure orders/order_items are tied to an active
-- restaurant and (when present) a table belonging to that restaurant.

-- ============================================================
-- orders: tighten anon/authenticated INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create orders" ON public.orders;
DROP POLICY IF EXISTS "Anon can create orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated can create orders" ON public.orders;

-- Guest (anonymous) order creation: must reference an active restaurant.
-- If a table_id is supplied, it must belong to that same restaurant.
-- user_id must be NULL for guests (they can't claim someone else's account).
CREATE POLICY "Guests create orders for active restaurants"
ON public.orders
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND restaurant_id IS NOT NULL
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
      AND r.is_active = true
  )
  AND (
    table_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.restaurant_tables t
      WHERE t.id = orders.table_id
        AND t.restaurant_id = orders.restaurant_id
    )
  )
);

-- Authenticated customer order creation: same checks, plus user_id must be
-- either NULL (guest-style table order) or the caller's own auth.uid().
CREATE POLICY "Customers create orders for active restaurants"
ON public.orders
FOR INSERT
TO authenticated
WITH CHECK (
  (user_id IS NULL OR user_id = auth.uid())
  AND restaurant_id IS NOT NULL
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = orders.restaurant_id
      AND r.is_active = true
  )
  AND (
    table_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.restaurant_tables t
      WHERE t.id = orders.table_id
        AND t.restaurant_id = orders.restaurant_id
    )
  )
);

-- ============================================================
-- order_items: tighten anon/authenticated INSERT
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create order items" ON public.order_items;

-- Guest order item creation: must reference an existing order whose
-- restaurant_id matches this row, and the parent order must still be pending
-- (prevents tampering with submitted/paid orders).
CREATE POLICY "Guests create items on own pending orders"
ON public.order_items
FOR INSERT
TO anon
WITH CHECK (
  restaurant_id IS NOT NULL
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.restaurant_id = order_items.restaurant_id
      AND o.status = 'pending'
      AND o.user_id IS NULL
  )
  AND EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = order_items.menu_item_id
      AND mi.restaurant_id = order_items.restaurant_id
      AND mi.is_available = true
  )
);

-- Authenticated customer order item creation: parent order must belong to
-- the caller (or be a guest/table order), be pending, and the menu item
-- must belong to the same restaurant.
CREATE POLICY "Customers create items on own pending orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND status = 'pending'
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = order_items.order_id
      AND o.restaurant_id = order_items.restaurant_id
      AND o.status = 'pending'
      AND (o.user_id IS NULL OR o.user_id = auth.uid())
  )
  AND EXISTS (
    SELECT 1 FROM public.menu_items mi
    WHERE mi.id = order_items.menu_item_id
      AND mi.restaurant_id = order_items.restaurant_id
      AND mi.is_available = true
  )
);