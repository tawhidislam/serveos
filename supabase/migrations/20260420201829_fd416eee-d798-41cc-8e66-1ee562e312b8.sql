CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT restaurant_id
  FROM public.restaurant_members
  WHERE user_id = auth.uid()
  ORDER BY created_at ASC, restaurant_id ASC
  LIMIT 1
$function$;