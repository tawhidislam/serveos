CREATE OR REPLACE FUNCTION public.get_public_order_items(_order_id uuid)
RETURNS TABLE(id uuid, quantity integer, notes text, status text, item_name text, item_price numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.id, oi.quantity, oi.notes, oi.status, mi.name, mi.price
  FROM public.order_items oi
  LEFT JOIN public.menu_items mi ON mi.id = oi.menu_item_id
  WHERE oi.order_id = _order_id
  ORDER BY oi.created_at ASC
$$;

REVOKE ALL ON FUNCTION public.get_public_order_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_order_items(uuid) TO anon, authenticated;