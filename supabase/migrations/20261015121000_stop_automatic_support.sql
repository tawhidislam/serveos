BEGIN;
CREATE OR REPLACE FUNCTION public.support_ai_disable_automation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
BEGIN
  IF OLD.auto_reply_enabled AND NOT NEW.auto_reply_enabled THEN
    UPDATE public.support_conversations SET ai_enabled=false,status='open' WHERE status='bot' AND ai_enabled;
    UPDATE public.support_ai_jobs SET status='skipped',completed_at=now() WHERE status='pending';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_support_ai_disable_automation AFTER UPDATE OF auto_reply_enabled ON public.support_settings FOR EACH ROW EXECUTE FUNCTION public.support_ai_disable_automation();
COMMIT;
