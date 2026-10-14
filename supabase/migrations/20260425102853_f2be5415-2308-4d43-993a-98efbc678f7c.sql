-- Owner-only sitemap data access.
-- Returns restaurant + menu items only when the caller owns the restaurant.
-- All other callers (including unauthenticated, other owners, platform admins,
-- managers, customers) get zero rows.

CREATE OR REPLACE FUNCTION public.get_owner_sitemap_restaurant(_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  slug text,
  custom_domain text,
  custom_domain_verified boolean,
  page_slugs jsonb,
  updated_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT r.id, r.slug, r.custom_domain, r.custom_domain_verified,
         r.page_slugs, r.updated_at, r.created_at
  FROM public.restaurants r
  WHERE r.id = _restaurant_id
    AND r.owner_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_owner_sitemap_restaurant(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_sitemap_restaurant(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_owner_sitemap_menu_items(_restaurant_id uuid)
RETURNS TABLE (
  id uuid,
  custom_slug text,
  updated_at timestamptz,
  is_available boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT mi.id, mi.custom_slug, mi.updated_at, mi.is_available
  FROM public.menu_items mi
  WHERE mi.restaurant_id = _restaurant_id
    AND mi.is_available = true
    AND EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = _restaurant_id
        AND r.owner_id = auth.uid()
    )
  ORDER BY mi.updated_at DESC
  LIMIT 10000;
$$;

REVOKE ALL ON FUNCTION public.get_owner_sitemap_menu_items(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_sitemap_menu_items(uuid) TO authenticated;