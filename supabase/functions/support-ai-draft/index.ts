import { selectSupportKnowledge } from '../_shared/support-knowledge.ts';
import { resolveSupportCredentials } from '../_shared/support-ai-credentials.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildDraftRequest, generateSupportDraft } from '../_shared/support-ai.ts';

const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json' };
const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return respond({ error: 'Sign in as a platform administrator.' }, 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  try {
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return respond({ error: 'Sign in as a platform administrator.' }, 401);
    const { data: isAdmin, error: roleError } = await client.rpc('is_platform_admin');
    if (roleError || !isAdmin) return respond({ error: 'Platform administrator access required.' }, 403);
    let body;
    try { body = await req.json(); } catch { return respond({ error: 'Invalid request.' }, 400); }
    if (!body || typeof body.conversation_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.conversation_id)) return respond({ error: 'A valid conversation is required.' }, 400);
    const [settings, conversation] = await Promise.all([
      client.from('support_settings').select('ai_enabled, ai_extra_instructions').eq('id', true).single(),
      client.from('support_conversations').select('id, subject, category, channel, status, restaurant_id').eq('id', body.conversation_id).maybeSingle(),
    ]);
    if (settings.error || conversation.error) return respond({ error: 'Could not load support context.' }, 500);
    if (!conversation.data) return respond({ error: 'Conversation not found.' }, 404);
    if (!settings.data.ai_enabled) return respond({ error: 'Enable AI reply drafts in Support settings first.' }, 409);
    if (['resolved', 'closed'].includes(conversation.data.status)) return respond({ error: 'Reopen the conversation before generating a reply.' }, 409);
    const backend = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
    const credentials = await resolveSupportCredentials(() => backend.rpc('support_ai_credentials'), name => Deno.env.get(name));
    const apiKey = credentials.apiKey;
    if (!apiKey) return respond({ error: 'AI is not connected yet. Save a Gemini API key in Support settings.' }, 503);
    const { data: allowed, error: rateError } = await client.rpc('support_ai_claim_request');
    if (rateError) return respond({ error: 'Could not check AI request limits.' }, 500);
    if (!allowed) return respond({ error: 'Please wait a minute before generating more drafts.' }, 429);
    const [messages, plans, subscription, knowledge, addons] = await Promise.all([
      client.from('support_messages').select('sender_kind, body, is_internal').eq('conversation_id', body.conversation_id).eq('is_internal', false).order('created_at', { ascending: false }).limit(30),
      client.from('subscription_plans').select('name, tier, currency, price_monthly, price_yearly, features').eq('is_active', true).eq('is_public', true).order('sort_order').limit(20),
      conversation.data.restaurant_id ? client.from('subscriptions').select('plan, status, current_period_end').eq('restaurant_id', conversation.data.restaurant_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      backend.from('support_knowledge_articles').select('id,title,category,body,is_active').eq('is_active', true).order('updated_at', { ascending: false }).limit(100),
      backend.from('platform_addons').select('name,description,badge,price_amount,currency,billing_type,feature_key,extra_staff,extra_menu_items,extra_branches').eq('is_active', true).eq('is_public', true).order('sort_order').limit(30),
    ]);
    if (messages.error || plans.error || subscription.error || knowledge.error || addons.error) return respond({ error: 'Could not load conversation or package details.' }, 500);
    if (!(messages.data ?? []).some(message => message.sender_kind === 'requester')) return respond({ error: 'A customer message is needed to draft a reply.' }, 409);
    const request = buildDraftRequest(credentials.model, [...(messages.data ?? [])].reverse(), { subject: conversation.data.subject, category: conversation.data.category, packages: (plans.data ?? []).map(plan => ({ ...plan, term: ({ trial: '7 days', monthly: '1 month', quarterly: '3 months', biannual: '6 months', yearly: '12 months' } as Record<string, string>)[plan.tier] || 'Ask the administrator to confirm the term' })), subscription: subscription.data, addons: addons.data, knowledge: selectSupportKnowledge(knowledge.data ?? [], (messages.data ?? []).find(message => message.sender_kind === 'requester')?.body ?? '', conversation.data.category) }, settings.data.ai_extra_instructions || '');
    const draft = await generateSupportDraft(apiKey, request);
    // Return text only. Nothing is posted, saved as a message, or emailed here.
    return respond({ draft, conversation_id: conversation.data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI draft generation failed.';
    return respond({ error: message.includes('timeout') || message.includes('aborted') ? 'AI generation timed out. Try again.' : message }, 502);
  }
});
