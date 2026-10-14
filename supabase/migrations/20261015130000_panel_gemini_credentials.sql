BEGIN;
-- Secret access is backend-only. Public support settings never contain API keys.
CREATE OR REPLACE FUNCTION public.support_ai_credentials()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE api_key text; model text;
BEGIN
  SELECT decrypted_secret INTO api_key FROM vault.decrypted_secrets WHERE name='support_gemini_api_key' LIMIT 1;
  SELECT decrypted_secret INTO model FROM vault.decrypted_secrets WHERE name='support_gemini_model' LIMIT 1;
  RETURN jsonb_build_object('api_key',api_key,'model',model);
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_credentials() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_credentials() TO service_role;

CREATE OR REPLACE FUNCTION public.support_ai_set_credentials(_api_key text,_model text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public
AS $$
DECLARE secret_id uuid;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('serveos-support-gemini-credentials'));
  IF _model IS NULL OR _model !~ '^gemini-[a-zA-Z0-9._-]+$' OR length(_model)>100 THEN RAISE EXCEPTION 'Invalid Gemini model'; END IF;
  IF _api_key IS NOT NULL AND (length(btrim(_api_key))<20 OR length(_api_key)>256 OR _api_key ~ '[[:space:]]') THEN RAISE EXCEPTION 'Invalid API key'; END IF;
  IF _api_key IS NOT NULL THEN
    SELECT id INTO secret_id FROM vault.secrets WHERE name='support_gemini_api_key';
    IF secret_id IS NULL THEN PERFORM vault.create_secret(_api_key,'support_gemini_api_key');
    ELSE PERFORM vault.update_secret(secret_id,_api_key); END IF;
  END IF;
  SELECT id INTO secret_id FROM vault.secrets WHERE name='support_gemini_model';
  IF secret_id IS NULL THEN PERFORM vault.create_secret(_model,'support_gemini_model');
  ELSE PERFORM vault.update_secret(secret_id,_model); END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.support_ai_set_credentials(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.support_ai_set_credentials(text,text) TO service_role;
COMMIT;
