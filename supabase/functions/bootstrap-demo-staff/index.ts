// Idempotently provisions demo staff accounts (admin, manager, kitchen, waiter, server)
// for the "demo" restaurant. Each account uses a deterministic email and a shared
// password (DEMO_STAFF_PASSWORD secret, fallback "DemoStaff2025!").
// Public endpoint — only ever touches the fixed demo tenant. Safe to call repeatedly.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const DEMO_SLUG = 'demo';

type RoleSpec = {
  role: 'admin' | 'manager' | 'kitchen' | 'waiter' | 'server' | 'customer';
  email: string;
  displayName: string;
  password?: string; // override default
};

const DEMO_CUSTOMER_PASSWORD = 'DemoGuest2025!';

const STAFF: RoleSpec[] = [
  { role: 'admin',    email: 'admin@bellacucina.demo',    displayName: 'Demo Admin' },
  { role: 'manager',  email: 'manager@bellacucina.demo',  displayName: 'Demo Manager' },
  { role: 'kitchen',  email: 'kitchen@bellacucina.demo',  displayName: 'Demo Kitchen' },
  { role: 'waiter',   email: 'waiter@bellacucina.demo',   displayName: 'Demo Waiter' },
  { role: 'server',   email: 'server@bellacucina.demo',   displayName: 'Demo Server' },
  { role: 'customer', email: 'guest@bellacucina.demo',    displayName: 'Demo Guest',   password: DEMO_CUSTOMER_PASSWORD },
];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const DEMO_PASSWORD = Deno.env.get('DEMO_STAFF_PASSWORD') ?? 'DemoStaff2025!';

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const { data: restaurant, error: rErr } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', DEMO_SLUG)
      .maybeSingle();
    if (rErr || !restaurant) {
      return new Response(
        JSON.stringify({ error: 'Demo restaurant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Cache existing users (single page is plenty for the demo tenant)
    const { data: usersList } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const usersByEmail = new Map<string, string>();
    usersList?.users?.forEach((u) => {
      if (u.email) usersByEmail.set(u.email.toLowerCase(), u.id);
    });

    const provisioned: { role: string; email: string; userId: string }[] = [];

    for (const spec of STAFF) {
      const pw = spec.password ?? DEMO_PASSWORD;
      let userId = usersByEmail.get(spec.email.toLowerCase()) ?? null;

      if (!userId) {
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: spec.email,
          password: pw,
          email_confirm: true,
          user_metadata: { display_name: spec.displayName },
        });
        if (cErr || !created.user) continue;
        userId = created.user.id;
      } else {
        // Ensure password matches the documented demo password (idempotent reset).
        await admin.auth.admin.updateUserById(userId, { password: pw });
      }

      // Customers don't belong to a restaurant tenant — only staff do.
      if (spec.role !== 'customer') {
        await admin
          .from('restaurant_members')
          .upsert(
            { user_id: userId, restaurant_id: restaurant.id },
            { onConflict: 'user_id,restaurant_id' },
          );
      }

      // Role
      await admin
        .from('user_roles')
        .upsert(
          { user_id: userId, role: spec.role as any },
          { onConflict: 'user_id,role' },
        );

      provisioned.push({ role: spec.role, email: spec.email, userId });
    }

    return new Response(
      JSON.stringify({
        success: true,
        restaurantId: restaurant.id,
        accounts: provisioned,
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
