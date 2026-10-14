-- Remove unsafe direct INSERT policies on audit_logs.
-- Audit entries are still written by the SECURITY DEFINER trigger function
-- public.log_audit_change(), which bypasses RLS as the function owner.
DROP POLICY IF EXISTS "Anon can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;