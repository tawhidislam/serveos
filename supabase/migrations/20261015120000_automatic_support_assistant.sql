BEGIN;
ALTER TABLE public.support_settings ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE public.support_ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  message_id uuid NOT NULL UNIQUE REFERENCES public.support_messages(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processing','completed','skipped','handoff')),
  lease_token uuid, leased_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz, error_code text
);
ALTER TABLE public.support_ai_jobs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.support_ai_jobs FROM anon, authenticated;
GRANT SELECT ON public.support_ai_jobs TO service_role;
CREATE INDEX support_ai_jobs_pending ON public.support_ai_jobs(status,created_at);

-- URL and a dedicated worker token live in Vault, never in public settings.
CREATE OR REPLACE FUNCTION public.support_ai_dispatch()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions
AS $$
DECLARE endpoint text; token text;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.support_ai_jobs WHERE status='pending' OR (status='processing' AND leased_at < now()-interval '2 minutes')) THEN RETURN; END IF;
  SELECT decrypted_secret INTO endpoint FROM vault.decrypted_secrets WHERE name='support_ai_worker_url' LIMIT 1;
  SELECT decrypted_secret INTO token FROM vault.decrypted_secrets WHERE name='support_ai_worker_token' LIMIT 1;
  IF endpoint IS NULL OR token IS NULL THEN RETURN; END IF;
  PERFORM net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','x-support-worker-secret',token),body:='{}'::jsonb,timeout_milliseconds:=60000);
EXCEPTION WHEN OTHERS THEN
  -- Chat delivery succeeds even if the background dispatcher is temporarily down.
  NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_dispatch() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_dispatch() TO service_role;

CREATE OR REPLACE FUNCTION public.support_ai_enqueue()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE c public.support_conversations; recent integer;
BEGIN
  IF NEW.is_internal THEN RETURN NEW; END IF;
  SELECT * INTO c FROM public.support_conversations WHERE id=NEW.conversation_id FOR UPDATE;
  IF NEW.sender_kind='agent' THEN
    UPDATE public.support_conversations SET ai_enabled=false,status=CASE WHEN status='bot' THEN 'open' ELSE status END WHERE id=c.id;
    RETURN NEW;
  END IF;
  IF NEW.sender_kind<>'requester' OR c.channel<>'chat' OR c.status<>'bot' OR NOT c.ai_enabled OR c.assigned_admin_id IS NOT NULL
    OR NOT EXISTS(SELECT 1 FROM public.support_settings WHERE id=true AND auto_reply_enabled) THEN RETURN NEW; END IF;
  SELECT count(*) INTO recent FROM public.support_ai_jobs WHERE conversation_id=c.id AND created_at>now()-interval '1 minute';
  IF recent>=10 THEN
    UPDATE public.support_conversations SET ai_enabled=false,status='open' WHERE id=c.id;
    RETURN NEW;
  END IF;
  INSERT INTO public.support_ai_jobs(conversation_id,message_id) VALUES(c.id,NEW.id) ON CONFLICT(message_id) DO NOTHING;
  PERFORM public.support_ai_dispatch();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_auto_enqueue AFTER INSERT ON public.support_messages FOR EACH ROW EXECUTE FUNCTION public.support_ai_enqueue();

CREATE OR REPLACE FUNCTION public.support_ai_stop_on_takeover()
RETURNS trigger LANGUAGE plpgsql SET search_path=public
AS $$
BEGIN
  IF NEW.assigned_admin_id IS NOT NULL OR NEW.status IN ('open','pending','resolved','closed') THEN NEW.ai_enabled:=false; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_ai_stop_on_takeover BEFORE UPDATE OF assigned_admin_id,status ON public.support_conversations FOR EACH ROW EXECUTE FUNCTION public.support_ai_stop_on_takeover();

CREATE OR REPLACE FUNCTION public.support_ai_claim_job()
RETURNS SETOF public.support_ai_jobs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE job public.support_ai_jobs;
BEGIN
  UPDATE public.support_ai_jobs j SET status='skipped',completed_at=now()
  WHERE j.status='pending' AND NOT EXISTS(SELECT 1 FROM public.support_conversations c WHERE c.id=j.conversation_id AND c.status='bot' AND c.ai_enabled AND c.assigned_admin_id IS NULL AND c.channel='chat');
  IF NOT EXISTS(SELECT 1 FROM public.support_settings WHERE id=true AND auto_reply_enabled) THEN RETURN; END IF;
  SELECT j.* INTO job FROM public.support_ai_jobs j
  JOIN public.support_conversations c ON c.id=j.conversation_id
  WHERE (j.status='pending' OR (j.status='processing' AND j.leased_at<now()-interval '2 minutes'))
    AND c.status='bot' AND c.ai_enabled AND c.assigned_admin_id IS NULL AND c.channel='chat'
    AND NOT EXISTS(SELECT 1 FROM public.support_ai_jobs p WHERE p.conversation_id=j.conversation_id AND p.id<>j.id AND p.status='processing' AND p.leased_at>=now()-interval '2 minutes')
  ORDER BY j.created_at FOR UPDATE OF j,c SKIP LOCKED LIMIT 1;
  IF job.id IS NULL THEN RETURN; END IF;
  UPDATE public.support_ai_jobs SET status='processing',leased_at=now(),lease_token=gen_random_uuid() WHERE id=job.id RETURNING * INTO job;
  RETURN NEXT job;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_claim_job() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_claim_job() TO service_role;

CREATE OR REPLACE FUNCTION public.support_ai_finish_job(_job_id uuid,_lease_token uuid,_reply text,_handoff boolean DEFAULT false,_error_code text DEFAULT NULL)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE job public.support_ai_jobs; c public.support_conversations; latest uuid;
BEGIN
  SELECT * INTO job FROM public.support_ai_jobs WHERE id=_job_id;
  IF job.id IS NULL THEN RETURN false; END IF;
  SELECT * INTO c FROM public.support_conversations WHERE id=job.conversation_id FOR UPDATE;
  SELECT * INTO job FROM public.support_ai_jobs WHERE id=_job_id FOR UPDATE;
  IF job.status<>'processing' OR job.lease_token IS DISTINCT FROM _lease_token THEN RETURN false; END IF;
  SELECT id INTO latest FROM public.support_messages WHERE conversation_id=c.id AND NOT is_internal ORDER BY created_at DESC,id DESC LIMIT 1;
  IF c.status<>'bot' OR NOT c.ai_enabled OR c.assigned_admin_id IS NOT NULL OR latest IS DISTINCT FROM job.message_id
    OR NOT EXISTS(SELECT 1 FROM public.support_settings WHERE id=true AND auto_reply_enabled) THEN
    UPDATE public.support_ai_jobs SET status='skipped',completed_at=now() WHERE id=job.id;
    RETURN false;
  END IF;
  IF length(btrim(coalesce(_reply,'')))=0 OR length(_reply)>4000 THEN RAISE EXCEPTION 'Invalid automatic reply'; END IF;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body,is_internal) VALUES(c.id,'bot',btrim(_reply),false);
  IF _handoff THEN UPDATE public.support_conversations SET ai_enabled=false,status='open' WHERE id=c.id; END IF;
  UPDATE public.support_ai_jobs SET status=CASE WHEN _handoff THEN 'handoff' ELSE 'completed' END,completed_at=now(),error_code=_error_code WHERE id=job.id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_finish_job(uuid,uuid,text,boolean,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_finish_job(uuid,uuid,text,boolean,text) TO service_role;

CREATE OR REPLACE FUNCTION public.support_start_conversation(
  _message text,
  _category text DEFAULT 'other',
  _visitor_name text DEFAULT NULL,
  _visitor_email text DEFAULT NULL,
  _source_url text DEFAULT NULL,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_restaurant uuid;
  v_open int;
  v_id uuid;
  v_ai boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;
  IF btrim(COALESCE(_message, '')) = '' THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;

  SELECT count(*) INTO v_open
  FROM public.support_conversations
  WHERE requester_user_id = v_uid AND status NOT IN ('resolved', 'closed');
  IF v_open >= 5 THEN
    RAISE EXCEPTION 'You already have several open conversations. Please continue in one of them.';
  END IF;

  v_restaurant := public.current_restaurant_id();
  SELECT auto_reply_enabled INTO v_ai FROM public.support_settings LIMIT 1;

  INSERT INTO public.support_conversations (
    requester_kind, requester_user_id, restaurant_id, visitor_name, visitor_email,
    category, subject, status, ai_enabled, source_url, user_agent, unread_for_agent
  ) VALUES (
    CASE WHEN v_restaurant IS NULL THEN 'visitor' ELSE 'restaurant' END,
    v_uid, v_restaurant,
    NULLIF(left(btrim(COALESCE(_visitor_name, '')), 80), ''),
    NULLIF(left(btrim(COALESCE(_visitor_email, '')), 160), ''),
    CASE WHEN _category IN ('sales', 'billing', 'technical', 'other') THEN _category ELSE 'other' END,
    left(regexp_replace(btrim(_message), '\s+', ' ', 'g'), 80),
    CASE WHEN COALESCE(v_ai, false) THEN 'bot' ELSE 'open' END,
    COALESCE(v_ai, false),
    left(_source_url, 500), left(_user_agent, 300), 0
  )
  RETURNING id INTO v_id;

  -- The message insert runs the normal checks/triggers as this requester.
  INSERT INTO public.support_messages (conversation_id, sender_kind, sender_user_id, body)
  VALUES (v_id, 'requester', v_uid, _message);

  RETURN v_id;
END;
$$;

-- Retry delivery after a network outage, even with no browser open.
SELECT cron.schedule('support-ai-worker','* * * * *','SELECT public.support_ai_dispatch();');
COMMIT;
