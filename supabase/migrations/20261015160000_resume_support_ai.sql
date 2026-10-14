BEGIN;
CREATE OR REPLACE FUNCTION public.support_resume_ai(_conversation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform administrator access required'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.support_settings WHERE id=true AND auto_reply_enabled) THEN RAISE EXCEPTION 'Enable automatic AI replies in Support settings first'; END IF;
  UPDATE public.support_conversations SET ai_enabled=true,status='bot',assigned_admin_id=NULL
  WHERE id=_conversation_id AND channel='chat' AND status NOT IN ('resolved','closed');
  IF NOT FOUND THEN RAISE EXCEPTION 'Reopen a chat conversation before resuming AI'; END IF;
  -- Future incoming messages are queued normally. Existing messages are not sent again.
END;
$$;
REVOKE ALL ON FUNCTION public.support_resume_ai(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_resume_ai(uuid) TO authenticated;
COMMIT;
