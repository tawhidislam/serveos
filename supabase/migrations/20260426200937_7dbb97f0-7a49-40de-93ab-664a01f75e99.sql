ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS features_heading TEXT,
  ADD COLUMN IF NOT EXISTS features_visible BOOLEAN NOT NULL DEFAULT true;