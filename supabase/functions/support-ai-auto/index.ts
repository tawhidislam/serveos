import { clarificationReply, needsClarification, handoffReply } from '../_shared/support-language.ts';
import { selectSupportKnowledge } from '../_shared/support-knowledge.ts';
import { resolveSupportCredentials } from '../_shared/support-ai-credentials.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AUTO_HANDOFF_REPLY, buildAutoReplyRequest, generateSupportDraft, needsHumanSupport, readAutoReply } from '../_shared/support-ai.ts';

Deno.serve(async (req) => {
  const headers = { 'Content-Type': 'application/json' };
  const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  const secret = Deno.env.get('SUPPORT_AI_WORKER_SECRET');
  if (!secret || req.headers.get('x-support-worker-secret') !== secret) return respond({ error: 'Unauthorized' }, 401);
  const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: jobs, error: claimError } = await client.rpc('support_ai_claim_job');
  if (claimError) return respond({ error: 'Could not claim a support job' }, 500);
  const job = jobs?.[0];
  if (!job) return respond({ processed: false });
  let reply = AUTO_HANDOFF_REPLY, handoff = true, errorCode: string | null = null;
  try {
    const [settings, conversation, messages, plans, knowledge, addons] = await Promise.all([
      client.from('support_settings').select('ai_extra_instructions').eq('id', true).single(),
      client.from('support_conversations').select('subject,category,restaurant_id').eq('id', job.conversation_id).single(),
      client.from('support_messages').select('id,sender_kind,body,is_internal,attachments').eq('conversation_id', job.conversation_id).eq('is_internal', false).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(30),
      client.from('subscription_plans').select('name,tier,currency,price_monthly,price_yearly,features').eq('is_active', true).eq('is_public', true).order('sort_order').limit(20),
      client.from('support_knowledge_articles').select('id,title,category,body,is_active').eq('is_active', true).order('updated_at', { ascending: false }).limit(100),
      client.from('platform_addons').select('name,description,badge,price_amount,currency,billing_type,feature_key,extra_staff,extra_menu_items,extra_branches').eq('is_active', true).eq('is_public', true).order('sort_order').limit(30),
    ]);
    if (!messages.error && messages.data) {
      const throughIncoming = [...messages.data].reverse();
      reply = handoffReply(throughIncoming);
    }
    if (settings.error || conversation.error || messages.error || plans.error || knowledge.error || addons.error) throw new Error('context_unavailable');
    const incoming = messages.data?.find(message => message.id === job.message_id);
    if (!incoming) throw new Error('message_unavailable');
    if (needsHumanSupport(incoming.body) || (Array.isArray(incoming.attachments) && incoming.attachments.length > 0)) {
      errorCode = 'human_review_requested';
    } else if (needsClarification(incoming.body)) {
      reply = clarificationReply([...messages.data].reverse());
      handoff = false;
    } else {
      const credentials = await resolveSupportCredentials(() => client.rpc('support_ai_credentials'), name => Deno.env.get(name));
      const apiKey = credentials.apiKey;
      if (!apiKey) throw new Error('provider_not_configured');
      const subscription = conversation.data.restaurant_id ? await client.from('subscriptions').select('plan,status,current_period_end').eq('restaurant_id', conversation.data.restaurant_id).maybeSingle() : { data: null, error: null };
      if (subscription.error) throw new Error('context_unavailable');
      const context = { subject: conversation.data.subject, category: conversation.data.category, subscription: subscription.data, addons: addons.data, knowledge: selectSupportKnowledge(knowledge.data ?? [], incoming.body, conversation.data.category), packages: (plans.data ?? []).map(plan => ({ ...plan, term: ({ trial: '7 days', monthly: '1 month', quarterly: '3 months', biannual: '6 months', yearly: '12 months' } as Record<string, string>)[plan.tier] || 'Confirm with the support team' })) };
      const request = buildAutoReplyRequest(credentials.model, [...(messages.data ?? [])].reverse(), context, settings.data.ai_extra_instructions || '');
      ({ reply, handoff } = readAutoReply(await generateSupportDraft(apiKey, request)));
      if (handoff) errorCode = 'ai_requested_human_review';
    }
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    errorCode = ['provider_not_configured', 'context_unavailable', 'message_unavailable'].includes(code) ? code : 'generation_failed';
    // Failed generation stays visible in the human inbox, with no invented AI answer.
  }
  const { data: published, error: finishError } = await client.rpc('support_ai_finish_job', { _job_id: job.id, _lease_token: job.lease_token, _reply: reply, _handoff: handoff, _error_code: errorCode });
  if (finishError) return respond({ error: 'Could not finish support job' }, 500);
  await client.rpc('support_ai_dispatch');
  return respond({ processed: true, published, handoff });
});
