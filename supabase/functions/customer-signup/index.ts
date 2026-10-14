// Per-restaurant customer signup. Same human email can register at every
// restaurant by namespacing the auth email under the hood as `local+<slug>@domain`.

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
  // Use a stable, reversible suffix that survives Supabase's email normalization.
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
    const password = String(body?.password ?? '');
    const displayName = String(body?.displayName ?? '').trim() || null;
    const phone = String(body?.phone ?? '').trim() || null;

    if (!restaurantId) return json(400, { error: 'Restaurant is required' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json(400, { error: 'Invalid email address' });
    if (password.length < 6)
      return json(400, { error: 'Password must be at least 6 characters' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: restaurant, error: rErr } = await admin
      .from('restaurants')
      .select('id, slug, name')
      .eq('id', restaurantId)
      .maybeSingle();
    if (rErr || !restaurant) return json(404, { error: 'Restaurant not found' });

    // Already registered as a customer of THIS restaurant?
    const { data: existing } = await admin
      .from('restaurant_customers')
      .select('id')
      .eq('restaurant_id', restaurant.id)
      .ilike('email', email)
      .maybeSingle();
    if (existing) {
      return json(409, {
        error: `An account with ${email} already exists at ${restaurant.name}. Please sign in instead.`,
      });
    }

    const namespacedEmail = namespaceEmail(email, restaurant.slug);

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: namespacedEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName ?? email, real_email: email, restaurant_id: restaurant.id },
    });
    if (cErr || !created.user) {
      return json(400, { error: cErr?.message ?? 'Failed to create account' });
    }

    const { error: insErr } = await admin.from('restaurant_customers').insert({
      restaurant_id: restaurant.id,
      auth_user_id: created.user.id,
      email,
      display_name: displayName,
      phone,
    });
    if (insErr) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => null);
      return json(500, { error: insErr.message });
    }

    return json(200, { ok: true, namespacedEmail });
  } catch (err) {
    return json(500, { error: err instanceof Error ? err.message : 'Unexpected error' });
  }
});
