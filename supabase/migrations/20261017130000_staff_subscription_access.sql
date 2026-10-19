BEGIN;

-- Staff need the restaurant's plan to check access to POS/KDS. Keep billing
-- identifiers and subscription writes behind the existing owner/admin policies.
CREATE FUNCTION public.get_restaurant_subscription_access(_restaurant_id uuid)
RETURNS TABLE(plan text, status text, current_period_end timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    EXISTS (
      SELECT 1 FROM public.restaurant_members AS member
      WHERE member.user_id = auth.uid() AND member.restaurant_id = _restaurant_id
    ) OR public.is_platform_admin()
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'Restaurant membership required.';
  END IF;

  RETURN QUERY
    SELECT subscription.plan, subscription.status::text, subscription.current_period_end
    FROM public.subscriptions AS subscription
    WHERE subscription.restaurant_id = _restaurant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_restaurant_subscription_access(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_restaurant_subscription_access(uuid) TO authenticated;
COMMENT ON FUNCTION public.get_restaurant_subscription_access(uuid) IS
  'Read-only plan/status/expiry for restaurant members and platform administrators. Excludes billing identifiers.';

NOTIFY pgrst, 'reload schema';
COMMIT;
