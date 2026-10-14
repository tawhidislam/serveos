DROP POLICY IF EXISTS "Admin and manager can upload menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin and manager can update menu images" ON storage.objects;
DROP POLICY IF EXISTS "Admin and manager can delete menu images" ON storage.objects;

CREATE POLICY "Owner admin manager can upload menu images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

CREATE POLICY "Owner admin manager can update menu images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  )
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );

CREATE POLICY "Owner admin manager can delete menu images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (
      public.has_role(auth.uid(), 'owner'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
      OR public.has_role(auth.uid(), 'manager'::public.app_role)
    )
  );