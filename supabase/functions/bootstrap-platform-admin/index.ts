// One-off: create or update a platform super-admin user with a given password.
//
// SECURITY: this grants platform super-admin and can reset any user's password,
// so it is disabled unless the PLATFORM_BOOTSTRAP_SECRET secret is set, and every
// call must send that value in the `x-bootstrap-secret` header. The anon key is
// public, so Supabase JWT verification alone does NOT protect this endpoint.
// Unset the secret again once bootstrapping is done.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Constant-time comparison so the secret can't be recovered via response timing.
function safeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const expected = Deno.env.get('PLATFORM_BOOTSTRAP_SECRET');
  const provided = req.headers.get('x-bootstrap-secret') ?? '';
  if (!expected || expected.length < 32 || !safeEqual(provided, expected)) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: 'email and password required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === String(email).toLowerCase());

    let userId: string;
    let action: string;
    if (existing) {
      const { error } = await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
      if (error) throw error;
      userId = existing.id;
      action = 'updated';
    } else {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      userId = data.user!.id;
      action = 'created';
    }

    await admin.from('platform_admins').upsert({ email: String(email).toLowerCase(), notes: 'Platform super-admin' }, { onConflict: 'email' });

    return new Response(JSON.stringify({ success: true, action, userId, email }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? 'error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
