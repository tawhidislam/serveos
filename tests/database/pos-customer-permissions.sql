-- Run against local Supabase with psql -v ON_ERROR_STOP=1.
-- Fixtures and POS orders are rolled back after verification.
BEGIN;

DO $$
DECLARE
  staff_id uuid;
  tenant_id uuid;
  other_tenant uuid := gen_random_uuid();
  customer_user uuid := gen_random_uuid();
  other_customer uuid := gen_random_uuid();
BEGIN
  SELECT r.owner_id, r.id INTO staff_id, tenant_id
  FROM public.restaurants r
  JOIN public.restaurant_members m ON m.restaurant_id = r.id AND m.user_id = r.owner_id
  LIMIT 1;
  IF staff_id IS NULL THEN
    RAISE EXCEPTION 'A local restaurant owner/member fixture is required';
  END IF;

  INSERT INTO public.restaurants(id, name, slug)
  VALUES(other_tenant, 'POS permission test', 'pos-permissions-' || other_tenant);
  INSERT INTO public.restaurant_customers(restaurant_id, auth_user_id, email)
  VALUES (tenant_id, customer_user, 'pos-permissions@example.test'),
         (other_tenant, other_customer, 'other-pos-permissions@example.test');

  PERFORM set_config('test.pos_staff', staff_id::text, true);
  PERFORM set_config('test.pos_tenant', tenant_id::text, true);
  PERFORM set_config('test.pos_other_tenant', other_tenant::text, true);
  PERFORM set_config('test.pos_customer', customer_user::text, true);
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated', 'sub', staff_id)::text, true);
END;
$$;

SET LOCAL ROLE authenticated;
DO $$
DECLARE pos_order_id uuid; item_id uuid; drawer_id uuid;
BEGIN
  -- Reproduce the POS insert-and-select, including orders' customer policy.
  INSERT INTO public.orders(user_id, restaurant_id, total_amount, tax_rate,
                            discount_amount, payment_method, status, paid_at)
  VALUES(current_setting('test.pos_staff')::uuid,
         current_setting('test.pos_tenant')::uuid, 0, 0, 0, 'cash', 'pending', now())
  RETURNING id INTO pos_order_id;
  IF NOT EXISTS (SELECT 1 FROM public.orders WHERE id = pos_order_id) THEN
    RAISE EXCEPTION 'POS order not readable after creation';
  END IF;
  SELECT id INTO item_id FROM public.menu_items
  WHERE restaurant_id = current_setting('test.pos_tenant')::uuid LIMIT 1;
  IF item_id IS NULL THEN
    RAISE EXCEPTION 'A local menu item fixture is required';
  END IF;
  INSERT INTO public.order_items(order_id, menu_item_id, restaurant_id, quantity)
  VALUES(pos_order_id, item_id, current_setting('test.pos_tenant')::uuid, 1);
  IF NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = pos_order_id) THEN
    RAISE EXCEPTION 'POS order items not readable';
  END IF;
  INSERT INTO public.cash_drawer_sessions(opened_by, restaurant_id, opening_balance)
  VALUES(current_setting('test.pos_staff')::uuid,
         current_setting('test.pos_tenant')::uuid, 0)
  RETURNING id INTO drawer_id;
  UPDATE public.cash_drawer_sessions SET cash_in = 10 WHERE id = drawer_id;
  IF NOT EXISTS (SELECT 1 FROM public.cash_drawer_sessions WHERE id = drawer_id AND cash_in = 10) THEN
    RAISE EXCEPTION 'POS cash drawer not updated';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_customers
                 WHERE auth_user_id = current_setting('test.pos_customer')::uuid) THEN
    RAISE EXCEPTION 'Owner cannot read restaurant customers';
  END IF;
  IF EXISTS (SELECT 1 FROM public.restaurant_customers
             WHERE restaurant_id = current_setting('test.pos_other_tenant')::uuid) THEN
    RAISE EXCEPTION 'Customers from another restaurant leaked';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated',
                     'sub', current_setting('test.pos_customer'))::text, true);
  IF (SELECT count(*) FROM public.restaurant_customers) <> 1 THEN
    RAISE EXCEPTION 'Customer must see only their own record';
  END IF;
  PERFORM set_config('request.jwt.claims', jsonb_build_object('role', 'authenticated',
                     'sub', gen_random_uuid())::text, true);
  IF EXISTS (SELECT 1 FROM public.restaurant_customers) THEN
    RAISE EXCEPTION 'Unrelated user can read customers';
  END IF;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF has_table_privilege('anon', 'public.restaurant_customers', 'SELECT') THEN
    RAISE EXCEPTION 'Anonymous users must not have customer read access';
  END IF;
END;
$$;
ROLLBACK;
