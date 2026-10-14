BEGIN;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS unit_price numeric CHECK(unit_price>=0);
CREATE OR REPLACE FUNCTION public.snapshot_order_item_price()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF TG_OP='INSERT' THEN
    SELECT price+COALESCE((SELECT sum((a->>'price_modifier')::numeric) FROM jsonb_array_elements(COALESCE(NEW.selected_addons,'[]')) a),0) INTO NEW.unit_price FROM menu_items WHERE id=NEW.menu_item_id AND restaurant_id=NEW.restaurant_id;
  ELSIF NEW.menu_item_id IS DISTINCT FROM OLD.menu_item_id OR NEW.selected_addons IS DISTINCT FROM OLD.selected_addons THEN
    IF EXISTS(SELECT 1 FROM orders WHERE id=NEW.order_id AND (paid_at IS NOT NULL OR status IN ('completed','cancelled','paid'))) THEN RAISE EXCEPTION 'Cannot change pricing of a closed order'; END IF;
    SELECT price+COALESCE((SELECT sum((a->>'price_modifier')::numeric) FROM jsonb_array_elements(COALESCE(NEW.selected_addons,'[]')) a),0) INTO NEW.unit_price FROM menu_items WHERE id=NEW.menu_item_id AND restaurant_id=NEW.restaurant_id;
  ELSE NEW.unit_price:=OLD.unit_price; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_snapshot_order_item_price BEFORE INSERT OR UPDATE ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.snapshot_order_item_price();
-- Use immutable line prices for new orders; retain the legacy calculation for historical rows without a snapshot.
CREATE OR REPLACE FUNCTION public.validate_order_totals()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE subtotal numeric; tax numeric; trusted boolean:=public.can_write_order_pricing(NEW.restaurant_id);
BEGIN
  NEW.delivery_fee:=GREATEST(0,COALESCE(NEW.delivery_fee,0));NEW.discount_amount:=GREATEST(0,COALESCE(NEW.discount_amount,0));
  IF TG_OP='INSERT' THEN IF NOT trusted THEN NEW.discount_amount:=0;NEW.total_amount:=0; END IF;RETURN NEW; END IF;
  IF NOT trusted THEN NEW.discount_amount:=OLD.discount_amount;NEW.delivery_fee:=OLD.delivery_fee; END IF;
  SELECT COALESCE(sum(COALESCE(oi.unit_price,mi.price+COALESCE((SELECT sum((a->>'price_modifier')::numeric) FROM jsonb_array_elements(oi.selected_addons) a),0))*oi.quantity),0) INTO subtotal FROM order_items oi JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=NEW.id;
  IF OLD.paid_at IS NOT NULL THEN NEW.tax_rate:=OLD.tax_rate;NEW.discount_amount:=OLD.discount_amount;NEW.delivery_fee:=OLD.delivery_fee;NEW.total_amount:=OLD.total_amount;RETURN NEW; END IF;
  SELECT COALESCE(tax_percentage,0) INTO tax FROM restaurant_settings WHERE restaurant_id=NEW.restaurant_id LIMIT 1;NEW.tax_rate:=COALESCE(tax,0);NEW.discount_amount:=LEAST(NEW.discount_amount,subtotal);NEW.total_amount:=GREATEST(0,round(subtotal*(1+NEW.tax_rate/100),2)-NEW.discount_amount+NEW.delivery_fee);RETURN NEW;
END; $$;
GRANT UPDATE(display_name) ON public.profiles TO service_role;
COMMIT;
