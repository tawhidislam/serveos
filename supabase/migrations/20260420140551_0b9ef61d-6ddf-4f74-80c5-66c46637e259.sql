-- Create public storage bucket for demo page screenshots
INSERT INTO storage.buckets (id, name, public)
VALUES ('demo-screenshots', 'demo-screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read
CREATE POLICY "Demo screenshots public read"
ON storage.objects FOR SELECT
USING (bucket_id = 'demo-screenshots');

-- Only platform admins can upload / update / delete
CREATE POLICY "Platform admins upload demo screenshots"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'demo-screenshots' AND public.is_platform_admin());

CREATE POLICY "Platform admins update demo screenshots"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'demo-screenshots' AND public.is_platform_admin());

CREATE POLICY "Platform admins delete demo screenshots"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'demo-screenshots' AND public.is_platform_admin());