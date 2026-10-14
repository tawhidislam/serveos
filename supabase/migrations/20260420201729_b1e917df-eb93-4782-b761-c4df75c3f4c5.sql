-- Drop existing overly-permissive write policies on floor-plans bucket
DROP POLICY IF EXISTS "Authenticated users can upload floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Floor plans upload" ON storage.objects;
DROP POLICY IF EXISTS "Floor plans update" ON storage.objects;
DROP POLICY IF EXISTS "Floor plans delete" ON storage.objects;
DROP POLICY IF EXISTS "Floor plans insert" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update floor plans" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete floor plans" ON storage.objects;

-- Helper: extract floor_plan id from the object name "{floor_plan_id}.{ext}"
-- and check the caller belongs to the owning restaurant with admin/manager role.

-- INSERT (upload new floor plan image)
CREATE POLICY "Admin/manager can upload floor plans"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'floor-plans'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.floor_plans fp
    WHERE fp.id::text = split_part(storage.objects.name, '.', 1)
      AND fp.restaurant_id = current_restaurant_id()
  )
);

-- UPDATE (replace existing floor plan image)
CREATE POLICY "Admin/manager can update floor plans"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.floor_plans fp
    WHERE fp.id::text = split_part(storage.objects.name, '.', 1)
      AND fp.restaurant_id = current_restaurant_id()
  )
)
WITH CHECK (
  bucket_id = 'floor-plans'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.floor_plans fp
    WHERE fp.id::text = split_part(storage.objects.name, '.', 1)
      AND fp.restaurant_id = current_restaurant_id()
  )
);

-- DELETE
CREATE POLICY "Admin/manager can delete floor plans"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'floor-plans'
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND EXISTS (
    SELECT 1 FROM public.floor_plans fp
    WHERE fp.id::text = split_part(storage.objects.name, '.', 1)
      AND fp.restaurant_id = current_restaurant_id()
  )
);