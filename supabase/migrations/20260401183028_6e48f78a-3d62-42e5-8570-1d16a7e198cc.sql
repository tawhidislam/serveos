
-- Promotions table
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL DEFAULT 'percentage', -- percentage, fixed, happy_hour, first_order
  discount_value NUMERIC NOT NULL DEFAULT 0, -- % or fixed amount
  promo_code TEXT UNIQUE, -- null = auto-apply
  min_order_amount NUMERIC DEFAULT 0,
  max_discount_amount NUMERIC, -- cap for percentage discounts
  max_uses INTEGER, -- total uses allowed, null = unlimited
  used_count INTEGER NOT NULL DEFAULT 0,
  max_uses_per_user INTEGER DEFAULT 1,
  applies_to TEXT NOT NULL DEFAULT 'order', -- order, category, item
  applies_to_ids UUID[], -- specific category/item ids if not whole order
  happy_hour_start TIME, -- for happy_hour type
  happy_hour_end TIME,
  happy_hour_days INTEGER[], -- 0=Sun..6=Sat
  is_first_order_only BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ends_at TIMESTAMP WITH TIME ZONE,
  branch_id UUID REFERENCES public.branches(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Track per-user usage
CREATE TABLE public.promotion_uses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID,
  order_id UUID REFERENCES public.orders(id),
  discount_applied NUMERIC NOT NULL DEFAULT 0,
  used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_uses ENABLE ROW LEVEL SECURITY;

-- Promotions: viewable by all, managed by admin/manager
CREATE POLICY "Promotions viewable by all" ON public.promotions FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage promotions" ON public.promotions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage promotions" ON public.promotions FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Promotion uses: insertable by anyone (anon ordering), viewable by staff
CREATE POLICY "Anyone can insert promotion uses" ON public.promotion_uses FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Staff can view promotion uses" ON public.promotion_uses FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Updated_at trigger
CREATE TRIGGER update_promotions_updated_at BEFORE UPDATE ON public.promotions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
