-- Plan tier enum
DO $$ BEGIN
  CREATE TYPE public.plan_tier AS ENUM ('free', 'pro', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Subscriptions table (one row per restaurant)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL UNIQUE REFERENCES public.restaurants(id) ON DELETE CASCADE,
  plan plan_tier NOT NULL DEFAULT 'free',
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_end TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own subscription" ON public.subscriptions;
CREATE POLICY "Owners read own subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_restaurant_owner(restaurant_id));

DROP POLICY IF EXISTS "Owners update own subscription" ON public.subscriptions;
CREATE POLICY "Owners update own subscription" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_restaurant_owner(restaurant_id))
  WITH CHECK (public.is_restaurant_owner(restaurant_id));

DROP POLICY IF EXISTS "Platform admins manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Platform admins manage all subscriptions" ON public.subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Touch trigger
DROP TRIGGER IF EXISTS subscriptions_set_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create a free subscription on new restaurant
CREATE OR REPLACE FUNCTION public.handle_new_restaurant_subscription()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.subscriptions (restaurant_id, plan, status)
  VALUES (NEW.id, 'free', 'trialing')
  ON CONFLICT (restaurant_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_subscription_on_restaurant ON public.restaurants;
CREATE TRIGGER create_subscription_on_restaurant
  AFTER INSERT ON public.restaurants
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_restaurant_subscription();

-- Backfill subscriptions for existing restaurants
INSERT INTO public.subscriptions (restaurant_id, plan, status)
SELECT id, 'free', 'trialing' FROM public.restaurants
ON CONFLICT (restaurant_id) DO NOTHING;