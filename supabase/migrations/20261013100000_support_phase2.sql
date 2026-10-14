-- Support system, phase 2:
--   • contact-form submissions land in the support inbox
--   • restaurant owners/admins see (and reply in) their restaurant's conversations
--   • file/image attachments in a private bucket
--   • starter saved replies

-- ── Contact-form channel ────────────────────────────────────────────────────
ALTER TABLE public.support_conversations
  ADD COLUMN IF NOT EXISTS channel text NOT NULL DEFAULT 'chat',
  ADD COLUMN IF NOT EXISTS contact_company text;

ALTER TABLE public.support_conversations
  ADD CONSTRAINT support_conversations_channel_check CHECK (channel IN ('chat', 'contact_form'));

ALTER TABLE public.support_conversations ALTER COLUMN requester_user_id DROP NOT NULL;
ALTER TABLE public.support_conversations
  ADD CONSTRAINT support_conversations_requester_check
  CHECK (channel = 'contact_form' OR requester_user_id IS NOT NULL);

-- ── Access helper: requester, or owner/admin of the conversation's restaurant
CREATE OR REPLACE FUNCTION public.support_can_access_conversation(_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = _conversation_id
      AND auth.uid() IS NOT NULL
      AND (
        c.requester_user_id = auth.uid()
        OR (
          c.restaurant_id IS NOT NULL
          AND c.restaurant_id = public.current_restaurant_id()
          AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
        )
      )
  )
$$;
REVOKE ALL ON FUNCTION public.support_can_access_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_can_access_conversation(uuid) TO authenticated;

DROP POLICY IF EXISTS "Requesters read own conversations" ON public.support_conversations;
CREATE POLICY "Requesters read own conversations" ON public.support_conversations
FOR SELECT TO authenticated USING (
  requester_user_id = auth.uid()
  OR (
    restaurant_id IS NOT NULL
    AND restaurant_id = public.current_restaurant_id()
    AND (public.has_role(auth.uid(), 'owner'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

DROP POLICY IF EXISTS "Requesters read own messages" ON public.support_messages;
CREATE POLICY "Requesters read own messages" ON public.support_messages
FOR SELECT TO authenticated USING (
  is_internal = false AND public.support_can_access_conversation(conversation_id)
);

DROP POLICY IF EXISTS "Requesters send messages" ON public.support_messages;
CREATE POLICY "Requesters send messages" ON public.support_messages
FOR INSERT TO authenticated WITH CHECK (
  sender_kind = 'requester'
  AND is_internal = false
  AND sender_user_id = auth.uid()
  AND public.support_can_access_conversation(conversation_id)
  AND EXISTS (
    SELECT 1 FROM public.support_conversations c
    WHERE c.id = conversation_id AND c.status <> 'closed' AND c.channel = 'chat'
  )
);

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
  ELSIF public.support_can_access_conversation(_conversation_id) THEN
    UPDATE public.support_conversations SET unread_for_requester = 0
    WHERE id = _conversation_id AND unread_for_requester <> 0;
  END IF;
END;
$$;

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
  IF NOT public.support_can_access_conversation(_conversation_id) THEN
    RAISE EXCEPTION 'Conversation not found or not resolved yet';
  END IF;
  UPDATE public.support_conversations
  SET rating = _rating, rating_comment = NULLIF(left(btrim(COALESCE(_comment, '')), 1000), '')
  WHERE id = _conversation_id AND status IN ('resolved', 'closed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found or not resolved yet';
  END IF;
END;
$$;

-- ── Message validation: system inserts + attachments ───────────────────────
CREATE OR REPLACE FUNCTION public.support_message_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_admin boolean := public.is_platform_admin();
  service boolean := COALESCE(current_setting('request.jwt.claims', true), '') = ''
    OR COALESCE(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    OR COALESCE(current_setting('app.support_system_insert', true), '') = 'on';
  recent int;
  att jsonb;
BEGIN
  NEW.body := COALESCE(btrim(NEW.body), '');
  NEW.attachments := COALESCE(NEW.attachments, '[]'::jsonb);
  IF jsonb_typeof(NEW.attachments) <> 'array' THEN
    RAISE EXCEPTION 'Invalid attachments';
  END IF;
  IF jsonb_array_length(NEW.attachments) > 5 THEN
    RAISE EXCEPTION 'Up to 5 attachments per message';
  END IF;
  FOR att IN SELECT * FROM jsonb_array_elements(NEW.attachments) LOOP
    IF jsonb_typeof(att) <> 'object'
       OR COALESCE(att->>'path', '') NOT LIKE NEW.conversation_id::text || '/%' THEN
      RAISE EXCEPTION 'Invalid attachment';
    END IF;
  END LOOP;
  IF length(NEW.body) > 4000 THEN
    RAISE EXCEPTION 'Message is too long (max 4000 characters)';
  END IF;
  IF NEW.body = '' AND jsonb_array_length(NEW.attachments) = 0 THEN
    RAISE EXCEPTION 'Message is empty';
  END IF;
  NEW.created_at := now();

  IF service THEN
    RETURN NEW;  -- bot/system messages and contact-form imports
  END IF;

  NEW.sender_user_id := auth.uid();
  IF is_admin AND NEW.sender_kind <> 'requester' THEN
    IF NEW.sender_kind NOT IN ('agent', 'system') THEN
      NEW.sender_kind := 'agent';
    END IF;
    RETURN NEW;
  END IF;

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

-- ── Contact form → support inbox ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.support_import_contact_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_reason text := lower(COALESCE(NEW.reason, ''));
  v_category text;
  v_body text;
BEGIN
  v_category := CASE
    WHEN v_reason ~ '(price|pricing|plan|package|demo|sales)' THEN 'sales'
    WHEN v_reason ~ '(bill|pay|invoice|refund|subscription)' THEN 'billing'
    WHEN v_reason ~ '(bug|error|help|support|technical|problem|issue)' THEN 'technical'
    ELSE 'other'
  END;
  v_body := left(btrim(COALESCE(NEW.message, '')), 4000);
  IF v_body = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.support_conversations (
    channel, requester_kind, requester_user_id, visitor_name, visitor_email, contact_company,
    category, subject, status, source_url, user_agent
  ) VALUES (
    'contact_form', 'visitor', NULL,
    NULLIF(left(btrim(COALESCE(NEW.name, '')), 80), ''),
    NULLIF(left(btrim(COALESCE(NEW.email, '')), 160), ''),
    NULLIF(left(btrim(COALESCE(NEW.company, '')), 120), ''),
    v_category,
    left(COALESCE(NULLIF(btrim(NEW.reason), ''), regexp_replace(v_body, '\s+', ' ', 'g')), 80),
    'open', '/contact', left(NEW.user_agent, 300)
  )
  RETURNING id INTO v_id;

  PERFORM set_config('app.support_system_insert', 'on', true);
  INSERT INTO public.support_messages (conversation_id, sender_kind, sender_user_id, body)
  VALUES (v_id, 'requester', NULL, v_body);
  PERFORM set_config('app.support_system_insert', '', true);
  RETURN NEW;
END;
$$;

-- The contact form inserts as the anon role, but anon was never granted
-- INSERT (only the RLS policy existed), so logged-out visitors' submissions
-- failed with "permission denied".
GRANT INSERT ON public.marketing_contact_submissions TO anon;

DROP TRIGGER IF EXISTS trg_support_import_contact_submission ON public.marketing_contact_submissions;
CREATE TRIGGER trg_support_import_contact_submission
AFTER INSERT ON public.marketing_contact_submissions
FOR EACH ROW EXECUTE FUNCTION public.support_import_contact_submission();

-- ── Attachments bucket ──────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'support-attachments', 'support-attachments', false, 10 * 1024 * 1024,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain']
)
ON CONFLICT (id) DO UPDATE
SET public = false, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Conversation id from an object path "<conversation_id>/<file>" (NULL if malformed).
CREATE OR REPLACE FUNCTION public.support_object_conversation(_name text)
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN split_part(_name, '/', 1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN split_part(_name, '/', 1)::uuid
  END
$$;

DROP POLICY IF EXISTS "Support attachments upload" ON storage.objects;
CREATE POLICY "Support attachments upload" ON storage.objects
FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'support-attachments'
  AND (
    public.is_platform_admin()
    OR public.support_can_access_conversation(public.support_object_conversation(name))
  )
);

DROP POLICY IF EXISTS "Support attachments read" ON storage.objects;
CREATE POLICY "Support attachments read" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'support-attachments'
  AND (
    public.is_platform_admin()
    OR public.support_can_access_conversation(public.support_object_conversation(name))
  )
);

DROP POLICY IF EXISTS "Support attachments delete" ON storage.objects;
CREATE POLICY "Support attachments delete" ON storage.objects
FOR DELETE TO authenticated USING (
  bucket_id = 'support-attachments' AND public.is_platform_admin()
);

-- ── Starter saved replies ───────────────────────────────────────────────────
INSERT INTO public.support_saved_replies (title, shortcut, body)
SELECT * FROM (VALUES
  ('Greeting', '/hi', 'Hi {name}, thanks for reaching out! How can I help you today?'),
  ('Ask for restaurant link', '/slug', 'Could you share your restaurant''s link (for example yourname.serveos.net) so I can take a look?'),
  ('How to pay', '/pay', 'You can pay for your plan with bKash, Nagad or Rocket from Subscription in your dashboard. Your plan is activated as soon as we confirm the payment.')
) AS v(title, shortcut, body)
WHERE NOT EXISTS (SELECT 1 FROM public.support_saved_replies);
