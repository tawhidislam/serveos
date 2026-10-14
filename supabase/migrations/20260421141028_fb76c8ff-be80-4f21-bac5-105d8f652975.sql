-- Add branding fields to platform_settings
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS site_name TEXT NOT NULL DEFAULT 'ServeOS';

-- Create public storage bucket for platform assets (logo, favicons, etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Public read access to platform-assets bucket
DROP POLICY IF EXISTS "Platform assets are publicly readable" ON storage.objects;
CREATE POLICY "Platform assets are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'platform-assets');

-- Only platform admins can upload to platform-assets
DROP POLICY IF EXISTS "Platform admins upload platform assets" ON storage.objects;
CREATE POLICY "Platform admins upload platform assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'platform-assets' AND public.is_platform_admin());

-- Only platform admins can update platform assets
DROP POLICY IF EXISTS "Platform admins update platform assets" ON storage.objects;
CREATE POLICY "Platform admins update platform assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'platform-assets' AND public.is_platform_admin());

-- Only platform admins can delete platform assets
DROP POLICY IF EXISTS "Platform admins delete platform assets" ON storage.objects;
CREATE POLICY "Platform admins delete platform assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'platform-assets' AND public.is_platform_admin());