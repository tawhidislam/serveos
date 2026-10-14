-- Remove broad public listing/read policies on storage.objects.
-- Public buckets still serve files over their public URLs (no RLS involved),
-- but anonymous clients can no longer enumerate bucket contents.

DROP POLICY IF EXISTS "Demo screenshots public read" ON storage.objects;
DROP POLICY IF EXISTS "Floor plan images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Menu images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Platform assets are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Website images viewable by all" ON storage.objects;

-- Signed-in staff may read/list only files belonging to their own restaurant.
CREATE POLICY "Members can read own restaurant menu images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'menu-images'
  AND (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_members rm ON rm.restaurant_id = r.id
      WHERE rm.user_id = auth.uid()
        AND split_part(storage.objects.name, '/', 1) IN (r.slug, r.id::text)
    )
  )
);

CREATE POLICY "Members can read own restaurant website images"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'website-images'
  AND (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      JOIN public.restaurant_members rm ON rm.restaurant_id = r.id
      WHERE rm.user_id = auth.uid()
        AND split_part(storage.objects.name, '/', 1) IN (r.slug, r.id::text)
    )
  )
);

CREATE POLICY "Members can read own restaurant floor plans"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.floor_plans fp
      WHERE fp.id::text = split_part(storage.objects.name, '.', 1)
        AND fp.restaurant_id = public.current_restaurant_id()
    )
  )
);

-- Platform-owned buckets: only platform admins may list them.
CREATE POLICY "Platform admins can read platform assets"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'platform-assets' AND public.is_platform_admin());

CREATE POLICY "Platform admins can read demo screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'demo-screenshots' AND public.is_platform_admin());