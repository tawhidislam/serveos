BEGIN;
DO $$
DECLARE admin_uid uuid; customer uuid; c uuid; queued integer;
BEGIN
  SELECT u.id INTO admin_uid FROM auth.users u JOIN platform_admins a ON a.email=u.email LIMIT 1;
  SELECT id INTO customer FROM auth.users WHERE id<>admin_uid LIMIT 1;
  UPDATE support_settings SET auto_reply_enabled=true WHERE id=true;
  INSERT INTO support_conversations(requester_kind,requester_user_id,status,channel,ai_enabled,assigned_admin_id) VALUES('visitor',customer,'open','chat',false,admin_uid) RETURNING id INTO c;
  INSERT INTO support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','Old question waiting for human');
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',customer)::text,true);
  BEGIN PERFORM support_resume_ai(c); RAISE EXCEPTION 'Customer resumed AI'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Customer resumed AI' THEN RAISE; END IF; END;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',admin_uid)::text,true);
  PERFORM support_resume_ai(c);
  IF NOT EXISTS(SELECT 1 FROM support_conversations WHERE id=c AND ai_enabled AND status='bot' AND assigned_admin_id IS NULL) THEN RAISE EXCEPTION 'Resume failed'; END IF;
  SELECT count(*) INTO queued FROM support_ai_jobs WHERE conversation_id=c;
  IF queued<>0 THEN RAISE EXCEPTION 'Resume re-sent old messages'; END IF;
  PERFORM set_config('request.jwt.claims','',true);
  INSERT INTO support_messages(conversation_id,sender_kind,body) VALUES(c,'requester','New question after resume');
  IF (SELECT count(*) FROM support_ai_jobs WHERE conversation_id=c)<>1 THEN RAISE EXCEPTION 'New message not queued'; END IF;
  UPDATE support_conversations SET status='resolved' WHERE id=c;
  PERFORM set_config('request.jwt.claims',jsonb_build_object('role','authenticated','sub',admin_uid)::text,true);
  BEGIN PERFORM support_resume_ai(c); RAISE EXCEPTION 'Resolved chat resumed'; EXCEPTION WHEN OTHERS THEN IF SQLERRM='Resolved chat resumed' THEN RAISE; END IF; END;
END;
$$;
ROLLBACK;
