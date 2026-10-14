-- ============================================================
-- loyalty_transactions: validate against real orders/users
-- ============================================================
DROP POLICY IF EXISTS "System can insert transactions" ON public.loyalty_transactions;

-- Authenticated users can create loyalty transactions only when:
--   - the row is tied to themselves (user_id = auth.uid())
--   - the referenced order exists, belongs to that user, and matches the restaurant_id
CREATE POLICY "Customers create own loyalty transactions"
ON public.loyalty_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND restaurant_id IS NOT NULL
  AND (
    order_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = loyalty_transactions.order_id
        AND o.restaurant_id = loyalty_transactions.restaurant_id
        AND o.user_id = auth.uid()
    )
  )
);

-- Staff can grant loyalty adjustments inside their own restaurant.
CREATE POLICY "Staff create loyalty transactions in own restaurant"
ON public.loyalty_transactions
FOR INSERT
TO authenticated
WITH CHECK (
  restaurant_id = public.current_restaurant_id()
  AND (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'waiter'::public.app_role)
    OR public.has_role(auth.uid(), 'server'::public.app_role)
  )
);

-- ============================================================
-- promotion_uses: validate promo + order exist and match restaurant
-- ============================================================
DROP POLICY IF EXISTS "Anyone can insert promotion uses" ON public.promotion_uses;

CREATE POLICY "Promotion uses recorded for valid promo+order"
ON public.promotion_uses
FOR INSERT
TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.promotions p
    WHERE p.id = promotion_uses.promotion_id
      AND p.restaurant_id = promotion_uses.restaurant_id
      AND p.is_active = true
      AND (p.starts_at IS NULL OR p.starts_at <= now())
      AND (p.ends_at IS NULL OR p.ends_at > now())
  )
  AND (
    order_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = promotion_uses.order_id
        AND o.restaurant_id = promotion_uses.restaurant_id
    )
  )
  AND (
    user_id IS NULL
    OR user_id = auth.uid()
  )
);

-- ============================================================
-- waiter_calls: must reference a real table on an active restaurant
-- ============================================================
DROP POLICY IF EXISTS "Anyone can create waiter calls" ON public.waiter_calls;

CREATE POLICY "Waiter calls only for valid active tables"
ON public.waiter_calls
FOR INSERT
TO anon, authenticated
WITH CHECK (
  table_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurant_tables t
    JOIN public.restaurants r ON r.id = t.restaurant_id
    WHERE t.id = waiter_calls.table_id
      AND r.is_active = true
  )
);