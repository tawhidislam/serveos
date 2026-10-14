BEGIN;
-- Keep onboarding writes in one transaction. Only the authenticated Edge
-- Function backend may call this; browser roles cannot bypass its auth check.
CREATE OR REPLACE FUNCTION public.provision_restaurant_onboarding(
  p_restaurant_id uuid, p_actor_id uuid, p_details jsonb,
  p_groups jsonb, p_tables jsonb, p_qr jsonb
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  restaurant public.restaurants%ROWTYPE;
  branch_id_value uuid;
  category_id_value uuid;
  grp jsonb;
  item jsonb;
  category_index integer := 0;
  item_index integer;
  menu_created integer := 0;
  tables_created integer := 0;
  requested_tables integer := (p_tables->>'count')::integer;
  capacity_value integer := COALESCE((p_tables->>'defaultCapacity')::integer, 4);
  prefix_value text := COALESCE(NULLIF(p_tables->>'prefix', ''), 'T');
  tax_value numeric := COALESCE((p_details->>'taxPercentage')::numeric, 10);
BEGIN
  SELECT * INTO restaurant FROM public.restaurants WHERE id = p_restaurant_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Restaurant not found' USING ERRCODE = 'P0002'; END IF;
  IF p_actor_id IS NULL OR (restaurant.owner_id IS DISTINCT FROM p_actor_id AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_members m JOIN public.user_roles r ON r.user_id = m.user_id
    WHERE m.restaurant_id = p_restaurant_id AND m.user_id = p_actor_id AND r.role IN ('owner', 'admin', 'manager')
  )) THEN RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501'; END IF;
  IF requested_tables IS NULL OR requested_tables < 1 OR requested_tables > 100 OR capacity_value < 1 OR capacity_value > 20
    OR length(prefix_value) > 8 OR tax_value < 0 OR tax_value > 50
    OR NULLIF(btrim(p_details->>'cuisineType'), '') IS NULL OR NULLIF(btrim(p_details->>'address'), '') IS NULL
    OR COALESCE(p_details->>'currency', 'USD') NOT IN ('USD', 'EUR', 'GBP', 'BDT', 'INR', 'AED', 'CAD', 'AUD') THEN
    RAISE EXCEPTION 'Invalid restaurant details or table settings' USING ERRCODE = '22023';
  END IF;
  IF restaurant.onboarding_completed THEN
    RETURN jsonb_build_object('success', true, 'restaurantId', p_restaurant_id, 'menuCreated', 0, 'tablesCreated', 0);
  END IF;
  SELECT id INTO branch_id_value FROM public.branches WHERE restaurant_id = p_restaurant_id ORDER BY created_at LIMIT 1;
  IF branch_id_value IS NULL THEN RAISE EXCEPTION 'Restaurant has no default branch'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.menu_items WHERE restaurant_id = p_restaurant_id) THEN
    FOR grp IN SELECT value FROM jsonb_array_elements(p_groups) LOOP
      INSERT INTO public.categories (name, restaurant_id, branch_id, sort_order)
      VALUES (grp->>'category', p_restaurant_id, branch_id_value, category_index) RETURNING id INTO category_id_value;
      category_index := category_index + 1;
      item_index := 0;
      FOR item IN SELECT value FROM jsonb_array_elements(grp->'items') LOOP
        IF NULLIF(btrim(item->>'name'), '') IS NULL OR (item->>'price')::numeric < 0 THEN
          RAISE EXCEPTION 'Menu items need a name and a nonnegative price' USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.menu_items (category_id, restaurant_id, branch_id, name, description, price, sort_order, is_available)
        VALUES (category_id_value, p_restaurant_id, branch_id_value, item->>'name', item->>'description', (item->>'price')::numeric, item_index, true);
        item_index := item_index + 1;
        menu_created := menu_created + 1;
      END LOOP;
    END LOOP;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_tables WHERE restaurant_id = p_restaurant_id) THEN
    INSERT INTO public.restaurant_tables (label, capacity, restaurant_id, branch_id, status)
    SELECT prefix_value || i, capacity_value, p_restaurant_id, branch_id_value, 'available'
    FROM generate_series(1, requested_tables) i;
    tables_created := requested_tables;
  END IF;

  -- A failed menu, table or settings write rolls back the entire setup.
  UPDATE public.restaurants SET
    cuisine_type = p_details->>'cuisineType', phone = p_details->>'phone', address = p_details->>'address',
    tagline = p_details->>'tagline', primary_color = COALESCE(p_details->>'primaryColor', '#e87c1e'),
    accent_color = COALESCE(p_details->>'accentColor', '#c8a855'), onboarding_completed = true, onboarded_at = now()
  WHERE id = p_restaurant_id;
  IF NOT EXISTS (SELECT 1 FROM public.restaurant_settings WHERE restaurant_id = p_restaurant_id) THEN
    INSERT INTO public.restaurant_settings (restaurant_id, restaurant_name) VALUES (p_restaurant_id, restaurant.name);
  END IF;
  UPDATE public.restaurant_settings SET
    restaurant_name = restaurant.name, currency = COALESCE(p_details->>'currency', 'USD'), tax_percentage = tax_value,
    primary_color = COALESCE(p_details->>'primaryColor', '#e87c1e'), accent_color = COALESCE(p_details->>'accentColor', '#c8a855'),
    tagline = p_details->>'tagline', address = p_details->>'address', contact_phone = p_details->>'phone',
    qr_template = COALESCE(p_qr->>'template', 'classic'), qr_ordering_enabled = COALESCE((p_qr->>'enabled')::boolean, true),
    qr_color_overrides = jsonb_strip_nulls(jsonb_build_object('primary', p_qr->>'primaryColor', 'background', p_qr->>'backgroundColor'))
  WHERE restaurant_id = p_restaurant_id;
  RETURN jsonb_build_object('success', true, 'restaurantId', p_restaurant_id, 'menuCreated', menu_created, 'tablesCreated', tables_created);
END;
$$;
REVOKE ALL ON FUNCTION public.provision_restaurant_onboarding(uuid, uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.provision_restaurant_onboarding(uuid, uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;

GRANT SELECT ON public.restaurant_members TO service_role;

-- Read permissions needed by signup, onboarding and the owner's first screen.
-- These tables already have public SELECT or tenant-scoped SELECT policies.
GRANT SELECT ON public.platform_settings, public.subscription_plans, public.marketing_footer_settings,
  public.marketing_page_sections, public.restaurant_settings, public.branches, public.categories,
  public.menu_items, public.restaurant_tables TO anon, authenticated;
GRANT SELECT ON public.orders, public.subscriptions TO authenticated;

COMMIT;
