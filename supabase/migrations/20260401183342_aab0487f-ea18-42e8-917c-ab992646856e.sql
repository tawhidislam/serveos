
CREATE OR REPLACE FUNCTION public.increment_promotion_usage(promo_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.promotions SET used_count = used_count + 1 WHERE id = promo_id;
END;
$$;
