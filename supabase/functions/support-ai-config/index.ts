import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildDraftRequest, generateSupportDraft } from '../_shared/support-ai.ts';
import { credentialStatus, resolveSupportCredentials } from '../_shared/support-ai-credentials.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return reply({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return reply({ error: 'Sign in as a platform administrator.' }, 401);
  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return reply({ error: 'Sign in as a platform administrator.' }, 401);
  const { data: admin, error: roleError } = await caller.rpc('is_platform_admin');
  if (roleError || !admin) return reply({ error: 'Platform administrator access required.' }, 403);
  let body;
  try { body = await req.json(); } catch { return reply({ error: 'Invalid request.' }, 400); }
  if (!body || !['status', 'save', 'test'].includes(body.action)) return reply({ error: 'Invalid action.' }, 400);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  try {
    if (body.action !== 'status') {
      const { data: allowed, error } = await caller.rpc('support_ai_claim_request');
      if (error || !allowed) return reply({ error: 'Please wait a minute before changing or testing the AI connection again.' }, 429);
    }
    if (body.action === 'save') {
      const key = typeof body.api_key === 'string' ? body.api_key.trim() : '';
      if (body.api_key != null && typeof body.api_key !== 'string') return reply({ error: 'Invalid Gemini API key.' }, 400);
      if (key && (key.length < 20 || key.length > 256 || /\s/.test(key))) return reply({ error: 'Enter a valid Gemini API key.' }, 400);
      if (typeof body.model !== 'string' || body.model.length > 100 || !/^gemini-[a-zA-Z0-9._-]+$/.test(body.model)) return reply({ error: 'Enter a valid Gemini model name.' }, 400);
      const { error } = await client.rpc('support_ai_set_credentials', { _api_key: key || null, _model: body.model });
      if (error) return reply({ error: 'Could not save the Gemini connection.' }, 500);
    }
    const credentials = await resolveSupportCredentials(() => client.rpc('support_ai_credentials'), name => Deno.env.get(name));
    if (body.action === 'test') {
      if (!credentials.apiKey) return reply({ error: 'Save a Gemini API key first.' }, 409);
      const request = buildDraftRequest(credentials.model, [], {});
      request.systemInstruction = { parts: [{ text: 'Reply with exactly OK. This is a connection test.' }] };
      request.contents = [{ role: 'user', parts: [{ text: 'Connection test. Reply OK.' }] }];
      await generateSupportDraft(credentials.apiKey, request);
    }
    return reply({ ...credentialStatus(credentials), tested: body.action === 'test' });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : 'Could not check the Gemini connection.' }, 502);
  }
});
