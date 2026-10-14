-- Support system: live chat between platform admins and website visitors /
-- restaurant staff.
--
-- Visitors chat with a Supabase *anonymous* session (an isolated client in
-- the browser), so every requester has an auth.uid() and RLS can scope rows
-- to their own conversations. Restaurant staff use their normal session.
-- Platform admins (is_platform_admin()) see and manage everything.

-- ── Tables ──────────────────────────────────────────────────────────────────
CREATE TABLE public.support_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_kind text NOT NULL CHECK (requester_kind IN ('visitor', 'restaurant')),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  restaurant_id uuid REFERENCES public.restaurants(id) ON DELETE SET NULL,
  visitor_name text,
  visitor_email text,
  subject text,
  category text NOT NULL DEFAULT 'other' CHECK (category IN ('sales', 'billing', 'technical', 'other')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('bot', 'open', 'pending', 'resolved', 'closed')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_enabled boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  last_message_preview text,
  last_message_sender text,
  unread_for_agent integer NOT NULL DEFAULT 0,
  unread_for_requester integer NOT NULL DEFAULT 0,
  source_url text,
  user_agent text,
  rating text CHECK (rating IN ('good', 'bad')),
  rating_comment text,
  first_response_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_conv_status_last ON public.support_conversations (status, last_message_at DESC);
CREATE INDEX idx_support_conv_requester ON public.support_conversations (requester_user_id);
CREATE INDEX idx_support_conv_restaurant ON public.support_conversations (restaurant_id);

CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.support_conversations(id) ON DELETE CASCADE,
  sender_kind text NOT NULL CHECK (sender_kind IN ('requester', 'agent', 'bot', 'system')),
  sender_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL DEFAULT '',
  is_internal boolean NOT NULL DEFAULT false,
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_support_msg_conv_created ON public.support_messages (conversation_id, created_at);
CREATE INDEX idx_support_msg_sender_created ON public.support_messages (sender_user_id, created_at DESC);

CREATE TABLE public.support_saved_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  shortcut text,
  body text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Single-row settings (id fixed to true).
CREATE TABLE public.support_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  widget_enabled boolean NOT NULL DEFAULT true,
  greeting text NOT NULL DEFAULT 'Hi! How can we help you today?',
  offline_message text NOT NULL DEFAULT 'We''re away right now. Leave a message and we''ll reply here — come back to this page to see it.',
  business_hours jsonb NOT NULL DEFAULT '{"days":[0,1,2,3,4,6],"start":"10:00","end":"20:00"}'::jsonb,
  timezone text NOT NULL DEFAULT 'Asia/Dhaka',
  ai_enabled boolean NOT NULL DEFAULT false,
  ai_extra_instructions text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.support_settings (id) VALUES (true) ON CONFLICT DO NOTHING;

CREATE TRIGGER update_support_conversations_updated_at
BEFORE UPDATE ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_saved_replies_updated_at
BEFORE UPDATE ON public.support_saved_replies
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_support_settings_updated_at
BEFORE UPDATE ON public.support_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.support_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_saved_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.support_conversations TO authenticated;
GRANT UPDATE, DELETE ON public.support_conversations TO authenticated;
GRANT SELECT, INSERT ON public.support_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_saved_replies TO authenticated;
GRANT SELECT ON public.support_settings TO anon, authenticated;
GRANT UPDATE ON public.support_settings TO authenticated;
GRANT ALL ON public.support_conversations, public.support_messages,
  public.support_saved_replies, public.support_settings TO service_role;

-- Conversations: requesters read their own; only admins change them.
-- (Requesters create them through support_start_conversation().)
CREATE POLICY "Requesters read own conversations" ON public.support_conversations
FOR SELECT TO authenticated USING (requester_user_id = auth.uid());
CREATE POLICY "Platform admins manage conversations" ON public.support_conversations
FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- Messages: requesters read non-internal messages of their conversations and
-- write requester messages; admins read/write everything.
CREATE POLICY "Requesters read own messages" ON public.support_messages
FOR SELECT TO authenticated USING (
  is_internal = false
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = conversation_id AND c.requester_user_id = auth.uid()
  )
);
CREATE POLICY "Requesters send messages" ON public.support_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_kind = 'requester'
  AND is_internal = false
  AND sender_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = conversation_id AND c.requester_user_id = auth.uid() AND c.status <> 'closed'
  )
);
CREATE POLICY "Platform admins manage messages" ON public.support_messages
FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "Platform admins manage saved replies" ON public.support_saved_replies
FOR ALL TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

CREATE POLICY "Anyone reads support settings" ON public.support_settings
FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Platform admins update support settings" ON public.support_settings
FOR UPDATE TO authenticated USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());

-- ── Message triggers ────────────────────────────────────────────────────────
-- Validate + normalise before insert: sender identity, size and rate limits.
CREATE OR REPLACE FUNCTION public.support_message_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean := public.is_platform_admin();
  service boolean := COALESCE(current_setting('request.jwt.claims', true), '') = ''
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role';
  recent int;
BEGIN
  NEW.body := COALESCE(btrim(NEW.body), '');
  IF length(NEW.body) > 4000 THEN
    RAISE EXCEPTION 'Message is too long (max 4000 characters)';
  END IF;
  IF NEW.body = '' AND jsonb_array_length(COALESCE(NEW.attachments, '[]'::jsonb)) = 0 THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;
  NEW.created_at := now();

  IF service THEN
    RETURN NEW;  -- bot / system messages from edge functions
  END IF;

  NEW.sender_user_id := auth.uid();
  IF is_admin AND NEW.sender_kind <> 'requester' THEN
    IF NEW.sender_kind NOT IN ('agent', 'system') THEN
      NEW.sender_kind := 'agent';
    END IF;
    RETURN NEW;
  END IF;

  -- Requester: never internal, rate limited.
  NEW.sender_kind := 'requester';
  NEW.is_internal := false;
  SELECT count(*) INTO recent
  FROM public.support_messages
  WHERE sender_user_id = auth.uid() AND created_at > now() - interval '1 minute';
  IF recent >= 10 THEN
    RAISE EXCEPTION 'You are sending messages too quickly. Please wait a moment.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_message_before_insert
BEFORE INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_message_before_insert();

-- Keep the conversation summary (last message, unread counts, status) current.
CREATE OR REPLACE FUNCTION public.support_message_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  preview text := CASE
    WHEN NEW.body <> '' THEN left(regexp_replace(NEW.body, '\s+', ' ', 'g'), 140)
    ELSE '📎 Attachment'
  END;
BEGIN
  IF NEW.is_internal THEN
    UPDATE public.support_conversations SET updated_at = now() WHERE id = NEW.conversation_id;
    RETURN NULL;
  END IF;

  IF NEW.sender_kind = 'requester' THEN
    UPDATE public.support_conversations
    SET last_message_at = NEW.created_at,
        last_message_preview = preview,
        last_message_sender = 'requester',
        unread_for_agent = unread_for_agent + 1,
        status = CASE WHEN status IN ('resolved', 'closed', 'pending') THEN 'open' ELSE status END,
        resolved_at = CASE WHEN status IN ('resolved', 'closed') THEN NULL ELSE resolved_at END
    WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.support_conversations
    SET last_message_at = NEW.created_at,
        last_message_preview = preview,
        last_message_sender = NEW.sender_kind,
        unread_for_requester = unread_for_requester + 1,
        unread_for_agent = CASE WHEN NEW.sender_kind = 'agent' THEN 0 ELSE unread_for_agent END,
        first_response_at = CASE WHEN NEW.sender_kind = 'agent' THEN COALESCE(first_response_at, NEW.created_at) ELSE first_response_at END,
        status = CASE WHEN NEW.sender_kind = 'agent' AND status = 'open' THEN 'pending' ELSE status END
    WHERE id = NEW.conversation_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_support_message_after_insert
AFTER INSERT ON public.support_messages
FOR EACH ROW EXECUTE FUNCTION public.support_message_after_insert();

-- Stamp resolved_at when an admin resolves a conversation.
CREATE OR REPLACE FUNCTION public.support_conversation_before_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at := now();
  ELSIF NEW.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_support_conversation_before_update
BEFORE UPDATE OF status ON public.support_conversations
FOR EACH ROW EXECUTE FUNCTION public.support_conversation_before_update();

-- ── RPCs for requesters ─────────────────────────────────────────────────────
-- Start a conversation with its first message. Restaurant and requester kind
-- are derived server-side; requesters can't set status, assignee or priority.
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
  SELECT ai_enabled INTO v_ai FROM public.support_settings LIMIT 1;

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

-- Mark a conversation read for whoever is looking at it.
CREATE OR REPLACE FUNCTION public.support_mark_read(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_platform_admin() THEN
    UPDATE public.support_conversations SET unread_for_agent = 0
    WHERE id = _conversation_id AND unread_for_agent <> 0;
  ELSE
    UPDATE public.support_conversations SET unread_for_requester = 0
    WHERE id = _conversation_id AND requester_user_id = auth.uid() AND unread_for_requester <> 0;
  END IF;
END;
$$;

-- Rate a resolved conversation (requester only, once it's resolved/closed).
CREATE OR REPLACE FUNCTION public.support_rate_conversation(_conversation_id uuid, _rating text, _comment text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF _rating NOT IN ('good', 'bad') THEN
    RAISE EXCEPTION 'Invalid rating';
  END IF;
  UPDATE public.support_conversations
  SET rating = _rating, rating_comment = NULLIF(left(btrim(COALESCE(_comment, '')), 1000), '')
  WHERE id = _conversation_id AND requester_user_id = auth.uid() AND status IN ('resolved', 'closed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or not resolved yet';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.support_start_conversation(text, text, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_mark_read(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_rate_conversation(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_start_conversation(text, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_mark_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.support_rate_conversation(uuid, text, text) TO authenticated;

-- ── Realtime ────────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;
