BEGIN;
DO $$
DECLARE credentials jsonb; test_key text:='fake-transaction-test-key-123456789';
BEGIN
  IF has_function_privilege('authenticated','public.support_ai_credentials()','EXECUTE') OR has_function_privilege('anon','public.support_ai_credentials()','EXECUTE') THEN RAISE EXCEPTION 'Secret reader exposed'; END IF;
  IF has_function_privilege('authenticated','public.support_ai_set_credentials(text,text)','EXECUTE') OR has_function_privilege('anon','public.support_ai_set_credentials(text,text)','EXECUTE') THEN RAISE EXCEPTION 'Secret writer exposed'; END IF;
  PERFORM public.support_ai_set_credentials(test_key,'gemini-test');
  SELECT public.support_ai_credentials() INTO credentials;
  IF credentials->>'api_key'<>test_key THEN RAISE EXCEPTION 'Key not saved'; END IF;
  IF EXISTS(SELECT 1 FROM vault.secrets WHERE name='support_gemini_api_key' AND secret=test_key) THEN RAISE EXCEPTION 'Key not encrypted'; END IF;
  PERFORM public.support_ai_set_credentials(NULL,'gemini-new-model');
  SELECT public.support_ai_credentials() INTO credentials;
  IF credentials->>'api_key'<>test_key OR credentials->>'model'<>'gemini-new-model' THEN RAISE EXCEPTION 'Blank key did not preserve secret'; END IF;
END;
$$;
ROLLBACK;
