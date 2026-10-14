-- Add ability for admins to allow multiple-quantity purchases of an add-on,
-- and track the chosen quantity on both purchase requests and active grants.

ALTER TABLE public.platform_addons
  ADD COLUMN IF NOT EXISTS allow_multiple boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS max_quantity integer;

ALTER TABLE public.platform_addons
  ADD CONSTRAINT platform_addons_max_quantity_positive
  CHECK (max_quantity IS NULL OR max_quantity > 0);

ALTER TABLE public.addon_purchase_requests
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.addon_purchase_requests
  ADD CONSTRAINT addon_purchase_requests_quantity_positive
  CHECK (quantity >= 1);

ALTER TABLE public.restaurant_addons
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

ALTER TABLE public.restaurant_addons
  ADD CONSTRAINT restaurant_addons_quantity_positive
  CHECK (quantity >= 1);
