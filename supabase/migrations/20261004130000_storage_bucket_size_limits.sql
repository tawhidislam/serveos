-- Cap object size on the public image buckets. The app compresses images
-- client-side and never uploads more than 10 MB, but without a bucket limit
-- anyone holding the public anon key could upload arbitrarily large files
-- straight to the Storage API and exhaust the storage quota.
UPDATE storage.buckets
SET file_size_limit = 10 * 1024 * 1024
WHERE id IN ('menu-images', 'website-images', 'floor-plans', 'demo-screenshots', 'platform-assets');
