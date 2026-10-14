-- Ensure RLS is enabled on realtime.messages so channel subscriptions are gated
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any prior policies we may have created
DROP POLICY IF EXISTS "Staff subscribe to own restaurant channels" ON realtime.messages;
DROP POLICY IF EXISTS "Customers subscribe to table channels" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated subscribe to own restaurant channels" ON realtime.messages;

-- Staff (any restaurant role) may subscribe to channels prefixed with their restaurant_id
-- Convention: channel topic should start with the restaurant_id, e.g. "<rid>:orders", "<rid>:waiter_calls"
CREATE POLICY "Staff subscribe to own restaurant channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'manager'::public.app_role)
    OR public.has_role(auth.uid(), 'kitchen'::public.app_role)
    OR public.has_role(auth.uid(), 'waiter'::public.app_role)
    OR public.has_role(auth.uid(), 'server'::public.app_role)
    OR public.has_role(auth.uid(), 'owner'::public.app_role)
  )
  AND public.current_restaurant_id() IS NOT NULL
  AND (
    realtime.topic() LIKE public.current_restaurant_id()::text || ':%'
    OR realtime.topic() = public.current_restaurant_id()::text
  )
);

-- Customers (and guests via authenticated session) may subscribe to per-table channels
-- Convention: channel topic "table:<table_id>" — table-level RLS still gates row payloads
CREATE POLICY "Customers subscribe to table channels"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE 'table:%'
);