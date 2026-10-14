
-- Create storage bucket for menu item images
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true);

-- Allow anyone to view menu images (public bucket)
CREATE POLICY "Menu images are publicly accessible"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'menu-images');

-- Admin and manager can upload menu images
CREATE POLICY "Admin and manager can upload menu images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'menu-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Admin and manager can update menu images
CREATE POLICY "Admin and manager can update menu images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );

-- Admin and manager can delete menu images
CREATE POLICY "Admin and manager can delete menu images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'menu-images'
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  );
