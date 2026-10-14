-- Explicit privileges for Edge Function provisioning after a fresh local reset.
-- Owner membership, role and default branch are created by SECURITY DEFINER
-- triggers; the service role only needs direct access to these two tables.
GRANT SELECT, INSERT ON public.restaurants TO service_role;
GRANT SELECT, UPDATE ON public.subdomain_pool TO service_role;

-- Let signed-in owners resolve their restaurant and role after registration.
-- Existing row-level policies continue to control which rows can be read.
GRANT SELECT ON public.restaurants, public.restaurant_members, public.user_roles TO authenticated;
