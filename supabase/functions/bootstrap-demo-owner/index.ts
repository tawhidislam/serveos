// Idempotently provisions the demo owner account (owner@bellacucina.demo) and links
// it to the existing "demo" restaurant as owner + member with the 'owner' role.
// Public endpoint — safe because it only ever touches the fixed demo tenant.
//
// SECURITY: The demo password is read from the DEMO_OWNER_PASSWORD secret and is
// NEVER returned in the response. Callers should display only the demo email; the
// password should be communicated through a separately-secured channel (e.g. a
// public marketing page that documents the shared demo credentials).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_SLUG = 'demo';
const DEMO_EMAIL = 'owner@bellacucina.demo';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    // Password is read from a secret. If unset, fall back to a generated random
    // value so the account is still provisioned but credentials never leak.
    const DEMO_PASSWORD =
      Deno.env.get('DEMO_OWNER_PASSWORD') ?? crypto.randomUUID() + '!Aa1';

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Find demo restaurant
    const { data: restaurant, error: rErr } = await admin
      .from('restaurants')
      .select('id, owner_id')
      .eq('slug', DEMO_SLUG)
      .maybeSingle();
    if (rErr || !restaurant) {
      return new Response(
        JSON.stringify({ error: 'Demo restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Find or create owner user
    let ownerId: string | null = null;
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const found = usersList?.users?.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
    if (found) {
      ownerId = found.id;
    } else {
      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { display_name: 'Bella Cucina (Demo)' },
      });
      if (cErr || !created.user) {
        return new Response(
          JSON.stringify({ error: cErr?.message ?? 'Failed to create demo owner' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      ownerId = created.user.id;
    }

    // Set owner_id on restaurant if missing
    if (!restaurant.owner_id) {
      await admin.from('restaurants').update({ owner_id: ownerId }).eq('id', restaurant.id);
    }

    // Ensure membership
    await admin
      .from('restaurant_members')
      .upsert({ user_id: ownerId, restaurant_id: restaurant.id }, { onConflict: 'user_id,restaurant_id' });

    // Ensure owner role
    await admin
      .from('user_roles')
      .upsert({ user_id: ownerId, role: 'owner' as any }, { onConflict: 'user_id,role' });

    // NOTE: We deliberately do NOT return the password. The function only signals
    // that the demo account is ready; credentials are documented elsewhere.
    return new Response(
      JSON.stringify({
        success: true,
        email: DEMO_EMAIL,
        ownerId,
        restaurantId: restaurant.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? 'Unexpected error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
