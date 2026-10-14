-- Custom slug per menu item (unique per restaurant when set)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS custom_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS menu_items_restaurant_custom_slug_uniq
  ON public.menu_items (restaurant_id, custom_slug)
  WHERE custom_slug IS NOT NULL;

-- Custom slugs for tenant static pages: { menu, about, gallery, contact }
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS page_slugs JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Lightweight format guard: lowercase letters, digits, hyphens only, 1-80 chars
CREATE OR REPLACE FUNCTION public.validate_menu_item_custom_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.custom_slug IS NOT NULL THEN
    NEW.custom_slug := lower(trim(NEW.custom_slug));
    IF NEW.custom_slug = '' THEN
      NEW.custom_slug := NULL;
    ELSIF NEW.custom_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' OR length(NEW.custom_slug) > 80 THEN
      RAISE EXCEPTION 'Invalid custom_slug: %, use lowercase letters, numbers and hyphens only', NEW.custom_slug;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_menu_item_custom_slug_trg ON public.menu_items;
CREATE TRIGGER validate_menu_item_custom_slug_trg
BEFORE INSERT OR UPDATE OF custom_slug ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.validate_menu_item_custom_slug();