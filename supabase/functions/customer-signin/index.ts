// Resolve the namespaced auth email for a (restaurantId, email) pair so the
// client can call signInWithPassword. Returns 404 if no such customer exists.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

function namespaceEmail(email: string, slug: string) {
  const [local, domain] = email.toLowerCase().split('@');
  return `${local}+rc-${slug}@${domain}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const body = await req.json();
    const restaurantId = String(body?.restaurantId ?? '').trim();
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!restaurantId || !email)
      return json(400, { error: 'restaurantId and email are required' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: restaurant } = await admin
      .from('restaurants')
      .select('id, slug, name')
      .eq('id', restaurantId)
      .maybeSingle();
    if (!restaurant) return json(404, { error: 'Restaurant not found' });

    const { data: customer } = await admin
      .from('restaurant_customers')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .ilike('email', email)
      .maybeSingle();
    if (!customer)
      return json(404, {
        error: `No customer account for ${email} at ${restaurant.name}. Please sign up first.`,
      });

    return json(200, { namespacedEmail: namespaceEmail(email, restaurant.slug) });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unexpected error' });
  }
});
