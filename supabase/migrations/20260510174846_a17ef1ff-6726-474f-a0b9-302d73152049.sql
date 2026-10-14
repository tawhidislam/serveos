ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS cuisine_type text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS onboarded_at timestamptz;

-- Existing restaurants are considered onboarded
UPDATE public.restaurants SET onboarding_completed = true, onboarded_at = COALESCE(onboarded_at, now()) WHERE onboarding_completed = false AND created_at < now() - interval '1 minute';