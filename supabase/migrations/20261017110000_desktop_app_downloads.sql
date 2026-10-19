BEGIN;

-- Add desktop releases without overwriting saved links or page customizations.
UPDATE public.platform_app_downloads
SET content = jsonb_build_object(
  'windows', '{"enabled":true,"status":"coming_soon","store_url":"","version":"","min_os":"","released_at":"","release_notes":"","installer_url":"","file_size_bytes":null}'::jsonb,
  'macos', '{"enabled":true,"status":"coming_soon","store_url":"","version":"","min_os":"","released_at":"","release_notes":"","installer_url":"","file_size_bytes":null}'::jsonb
) || content
WHERE NOT (content ? 'windows' AND content ? 'macos');

UPDATE public.platform_app_downloads
SET content = jsonb_set(content, '{title}', '"Your restaurant. On every screen."'::jsonb)
WHERE content->>'title' = 'Your restaurant. In your pocket.';

-- EXE, MSI, and PKG use application/octet-stream, already accepted by the bucket.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY(
  SELECT DISTINCT mime FROM unnest(allowed_mime_types || ARRAY['application/x-apple-diskimage']) AS mime
)
WHERE id = 'platform-apps' AND allowed_mime_types IS NOT NULL;

COMMIT;
