-- Platform Packages uses browser-authenticated CRUD. Existing RLS policies
-- restrict all writes to is_platform_admin(); public readers stay read-only.
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;
