BEGIN;
CREATE TABLE IF NOT EXISTS public.support_ai_request_limits (
  admin_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);
ALTER TABLE public.support_ai_request_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_ai_request_limits FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.support_ai_claim_request()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE used integer;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'Platform administrator access required';
  END IF;
  INSERT INTO public.support_ai_request_limits(admin_id, request_count) VALUES(auth.uid(), 1)
  ON CONFLICT(admin_id) DO UPDATE SET
    request_count = CASE WHEN support_ai_request_limits.window_started_at <= now() - interval '1 minute' THEN 1 ELSE support_ai_request_limits.request_count + 1 END,
    window_started_at = CASE WHEN support_ai_request_limits.window_started_at <= now() - interval '1 minute' THEN now() ELSE support_ai_request_limits.window_started_at END
  RETURNING request_count INTO used;
  RETURN used <= 10;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_claim_request() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_ai_claim_request() TO authenticated;
COMMIT;
