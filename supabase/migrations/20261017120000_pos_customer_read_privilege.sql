-- POS INSERT ... RETURNING and order history evaluate the customer SELECT
-- policy on orders, which queries restaurant_customers as the caller.
-- RLS policies alone do not grant the underlying table privilege.
GRANT SELECT ON TABLE public.restaurant_customers TO authenticated;

-- Keep the existing customer-self and restaurant-staff RLS policies in force.

-- POS also writes orders/items and opens or updates cash drawer sessions.
-- Grant only the operations it uses; existing tenant policies still apply.
GRANT SELECT, INSERT ON TABLE public.orders, public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.cash_drawer_sessions TO authenticated;
