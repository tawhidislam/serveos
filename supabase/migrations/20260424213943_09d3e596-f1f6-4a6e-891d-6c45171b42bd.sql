-- Update handle_new_restaurant to also seed restaurant_settings
CREATE OR REPLACE FUNCTION public.handle_new_restaurant()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    -- Link owner as a member
    INSERT INTO public.restaurant_members (user_id, restaurant_id)
    VALUES (NEW.owner_id, NEW.id)
    ON CONFLICT DO NOTHING;

    -- Grant owner role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.owner_id, 'owner')
    ON CONFLICT DO NOTHING;

    -- Create a default branch
    INSERT INTO public.branches (name, restaurant_id)
    VALUES ('Main Branch', NEW.id);
  END IF;

  -- Auto-create restaurant_settings row so the Settings page always has a row to update
  INSERT INTO public.restaurant_settings (restaurant_id, restaurant_name)
  VALUES (NEW.id, COALESCE(NEW.name, 'My Restaurant'))
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Backfill: create a settings row for any restaurant that doesn't already have one
INSERT INTO public.restaurant_settings (restaurant_id, restaurant_name)
SELECT r.id, COALESCE(r.name, 'My Restaurant')
FROM public.restaurants r
LEFT JOIN public.restaurant_settings rs ON rs.restaurant_id = r.id
WHERE rs.id IS NULL;

-- Ensure one settings row per restaurant going forward
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_settings_restaurant_id_unique
  ON public.restaurant_settings(restaurant_id)
  WHERE restaurant_id IS NOT NULL;