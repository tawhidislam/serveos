-- All fixtures roll back; queued HTTP requests are rolled back too.
BEGIN;
UPDATE public.support_settings SET auto_reply_enabled=true WHERE id=true;
DO $$
DECLARE c uuid; m uuid; j public.support_ai_jobs; newer uuid; result boolean; replies integer;
BEGIN
  INSERT INTO public.support_conversations(requester_user_id,requester_kind,channel,status,ai_enabled,subject)
  SELECT id,'visitor','chat','bot',true,'Transactional AI worker test' FROM auth.users LIMIT 1 RETURNING id INTO c;
  IF c IS NULL THEN RAISE EXCEPTION 'A local auth fixture is required'; END IF;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','How do I add a waiter?') RETURNING id INTO m;
  IF (SELECT count(*) FROM public.support_ai_jobs WHERE message_id=m)<>1 THEN RAISE EXCEPTION 'Incoming message not queued exactly once'; END IF;
  SELECT * INTO j FROM public.support_ai_claim_job() WHERE conversation_id=c;
  IF j.id IS NULL THEN RAISE EXCEPTION 'No job claimed'; END IF;
  result:=public.support_ai_finish_job(j.id,j.lease_token,'You can create a waiter at /owner/staff.',false,NULL);
  IF NOT result THEN RAISE EXCEPTION 'Reply not published'; END IF;
  IF public.support_ai_finish_job(j.id,j.lease_token,'Duplicate answer',false,NULL) THEN RAISE EXCEPTION 'Duplicate published'; END IF;
  SELECT count(*) INTO replies FROM public.support_messages WHERE conversation_id=c AND sender_kind='bot';
  IF replies<>1 THEN RAISE EXCEPTION 'Reply count mismatch'; END IF;
  IF (SELECT count(*) FROM public.support_ai_jobs WHERE conversation_id=c)<>1 THEN RAISE EXCEPTION 'Bot reply looped'; END IF;

  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','Second question') RETURNING id INTO m;
  SELECT * INTO j FROM public.support_ai_claim_job() WHERE conversation_id=c;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'agent','A human is helping now');
  IF public.support_ai_finish_job(j.id,j.lease_token,'Late AI answer',false,NULL) THEN RAISE EXCEPTION 'Human takeover interrupted'; END IF;
  IF (SELECT ai_enabled FROM public.support_conversations WHERE id=c) THEN RAISE EXCEPTION 'Human reply did not stop AI'; END IF;

  UPDATE public.support_conversations SET ai_enabled=true,status='bot' WHERE id=c;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','Older question') RETURNING id INTO m;
  SELECT * INTO j FROM public.support_ai_claim_job() WHERE conversation_id=c;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','Newest question') RETURNING id INTO newer;
  -- All messages in this transaction share now(); explicitly make the newest one sort last.
  UPDATE public.support_messages SET created_at=now()+interval '1 second' WHERE id=newer;
  IF public.support_ai_finish_job(j.id,j.lease_token,'Stale reply',false,NULL) THEN RAISE EXCEPTION 'Stale reply published'; END IF;
  SELECT * INTO j FROM public.support_ai_claim_job() WHERE conversation_id=c;
  IF NOT public.support_ai_finish_job(j.id,j.lease_token,'The support team will review your request.',true,'human_review_requested') THEN RAISE EXCEPTION 'Handoff not published'; END IF;
  IF (SELECT status FROM public.support_conversations WHERE id=c)<>'open' THEN RAISE EXCEPTION 'Handoff not in human inbox'; END IF;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body,is_internal) VALUES(c,'agent','Private test note',true);
  IF (SELECT count(*) FROM public.support_ai_jobs WHERE conversation_id=c)<>4 THEN RAISE EXCEPTION 'Private note queued'; END IF;

  UPDATE public.support_conversations SET ai_enabled=true,status='bot' WHERE id=c;
  INSERT INTO public.support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','Pause automation test') RETURNING id INTO m;
  SELECT * INTO j FROM public.support_ai_claim_job() WHERE conversation_id=c;
  UPDATE public.support_settings SET auto_reply_enabled=false WHERE id=true;
  IF public.support_ai_finish_job(j.id,j.lease_token,'Disabled AI reply',false,NULL) THEN RAISE EXCEPTION 'Disabled AI posted'; END IF;
END;
$$;
ROLLBACK;
