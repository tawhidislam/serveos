-- The platform-manage-tenant Edge Function verifies is_platform_admin() on
-- every request before using the backend role. No new browser write access.
GRANT UPDATE (is_active, theme_id) ON public.restaurants TO service_role;
GRANT DELETE ON public.restaurants TO service_role;
GRANT SELECT ON public.subscription_plans, public.profiles, public.user_roles, public.platform_themes TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO service_role;
GRANT SELECT ON public.platform_themes TO authenticated;
