
INSERT INTO storage.buckets (id, name, public) VALUES ('website-images', 'website-images', true);

CREATE POLICY "Website images viewable by all" ON storage.objects FOR SELECT TO public USING (bucket_id = 'website-images');

CREATE POLICY "Admin can upload website images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Manager can upload website images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admin can delete website images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Manager can delete website images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'manager'::public.app_role));

CREATE POLICY "Admin can update website images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Manager can update website images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'website-images' AND public.has_role(auth.uid(), 'manager'::public.app_role));
