
-- Loyalty program configuration (single-row settings)
CREATE TABLE public.loyalty_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  -- Earning
  earn_type TEXT NOT NULL DEFAULT 'per_currency', -- 'per_order' or 'per_currency'
  points_per_order INTEGER NOT NULL DEFAULT 10,
  points_per_currency NUMERIC NOT NULL DEFAULT 1, -- e.g. 1 point per $1
  -- Redemption
  redemption_type TEXT NOT NULL DEFAULT 'flexible', -- 'flexible' or 'tiers'
  point_value NUMERIC NOT NULL DEFAULT 0.05, -- value of 1 point in currency (for flexible)
  min_redeem_points INTEGER NOT NULL DEFAULT 100,
  redemption_tiers JSONB NOT NULL DEFAULT '[]'::jsonb, -- [{points: 100, discount: 5}, ...]
  -- Expiry
  expiry_enabled BOOLEAN NOT NULL DEFAULT false,
  expiry_days INTEGER NOT NULL DEFAULT 180,
  -- Meta
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Settings viewable by all" ON public.loyalty_settings FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage loyalty settings" ON public.loyalty_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage loyalty settings" ON public.loyalty_settings FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Seed default settings row
INSERT INTO public.loyalty_settings (is_enabled) VALUES (false);

-- Loyalty transactions ledger
CREATE TABLE public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  points INTEGER NOT NULL, -- positive = earn, negative = redeem/expire
  type TEXT NOT NULL DEFAULT 'earn', -- 'earn', 'redeem', 'expire', 'adjust'
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON public.loyalty_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Staff can view all transactions" ON public.loyalty_transactions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "System can insert transactions" ON public.loyalty_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin can manage transactions" ON public.loyalty_transactions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to get user's current points balance (excluding expired)
CREATE OR REPLACE FUNCTION public.get_loyalty_balance(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(points), 0)::INTEGER
  FROM public.loyalty_transactions
  WHERE user_id = _user_id
    AND (expires_at IS NULL OR expires_at > now())
$$;
