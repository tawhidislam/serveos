-- Add per-addon quantity-limit boosts. Each active grant adds these numbers
-- to the tenant's plan limits (or unlocks "unlimited" when the unlimited_* flag is true).
ALTER TABLE public.platform_addons
  ADD COLUMN IF NOT EXISTS extra_menu_items integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_branches integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS extra_staff integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unlimited_menu_items boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlimited_branches boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unlimited_staff boolean NOT NULL DEFAULT false;