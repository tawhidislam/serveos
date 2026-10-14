BEGIN;
CREATE TABLE public.support_agent_typing (
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY(conversation_id,admin_id)
);
ALTER TABLE public.support_agent_typing ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_agent_typing FROM anon,authenticated;

CREATE OR REPLACE FUNCTION public.support_set_agent_typing(_conversation_id uuid,_typing boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_platform_admin() THEN RAISE EXCEPTION 'Platform administrator access required'; END IF;
  IF NOT _typing THEN DELETE FROM public.support_agent_typing WHERE conversation_id=_conversation_id AND admin_id=auth.uid(); RETURN; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.support_conversations WHERE id=_conversation_id AND channel='chat' AND status NOT IN ('resolved','closed')) THEN RETURN; END IF;
  INSERT INTO public.support_agent_typing(conversation_id,admin_id,expires_at) VALUES(_conversation_id,auth.uid(),now()+interval '4 seconds')
  ON CONFLICT(conversation_id,admin_id) DO UPDATE SET expires_at=EXCLUDED.expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.support_set_agent_typing(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_set_agent_typing(uuid,boolean) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_typing_status(_conversation_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE agent boolean; ai boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT (public.is_platform_admin() OR public.support_can_access_conversation(_conversation_id)) THEN RAISE EXCEPTION 'Conversation access required'; END IF;
  SELECT EXISTS(SELECT 1 FROM public.support_agent_typing t JOIN public.support_conversations c ON c.id=t.conversation_id WHERE t.conversation_id=_conversation_id AND t.expires_at>now() AND c.channel='chat' AND c.status NOT IN ('resolved','closed')) INTO agent;
  SELECT EXISTS(SELECT 1 FROM public.support_ai_jobs j JOIN public.support_conversations c ON c.id=j.conversation_id WHERE j.conversation_id=_conversation_id AND j.status='processing' AND j.leased_at>now()-interval '2 minutes' AND c.ai_enabled AND c.status='bot' AND c.assigned_admin_id IS NULL AND EXISTS(SELECT 1 FROM public.support_settings WHERE auto_reply_enabled)) INTO ai;
  RETURN jsonb_build_object('agent',agent,'ai',ai);
END;
$$;
REVOKE ALL ON FUNCTION public.support_typing_status(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.support_typing_status(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.support_clear_agent_typing()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF NEW.sender_kind='agent' AND NOT NEW.is_internal THEN
    DELETE FROM public.support_agent_typing WHERE conversation_id=NEW.conversation_id AND admin_id=NEW.sender_user_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_clear_agent_typing AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.support_clear_agent_typing();
COMMIT;
