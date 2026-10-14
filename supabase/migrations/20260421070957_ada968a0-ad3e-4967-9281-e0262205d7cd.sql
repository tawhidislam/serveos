-- 1. mobile_payment_settings: restrict authenticated SELECT to platform admins only.
DROP POLICY IF EXISTS "Mobile payment settings readable by all authenticated" ON public.mobile_payment_settings;

CREATE POLICY "Platform admins read mobile payment settings"
ON public.mobile_payment_settings
FOR SELECT
TO authenticated
USING (public.is_platform_admin());

-- The existing anon policy (is_enabled = true) stays so customer checkout flows
-- can still discover enabled payment methods without exposing extra rows.

-- 2. waiter_calls: remove the anonymous read-all policy.
DROP POLICY IF EXISTS "Anon can view waiter calls" ON public.waiter_calls;

-- 3. reservations: tighten public INSERT to require a valid, active restaurant.
DROP POLICY IF EXISTS "Anyone can create reservations" ON public.reservations;

CREATE POLICY "Anyone can create reservations for active restaurants"
ON public.reservations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  restaurant_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = reservations.restaurant_id
      AND r.is_active = true
  )
);

-- 4. realtime.messages: restrict customer table channels to the owning restaurant's staff.
DROP POLICY IF EXISTS "Customers subscribe to table channels" ON realtime.messages;

CREATE POLICY "Staff subscribe to own restaurant table channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'table:%'
  AND EXISTS (
    SELECT 1 FROM public.restaurant_tables rt
    WHERE rt.id::text = split_part(realtime.topic(), ':', 2)
      AND rt.restaurant_id = public.current_restaurant_id()
  )
);
