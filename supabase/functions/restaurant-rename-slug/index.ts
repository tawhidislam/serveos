// Renames a restaurant's slug (= subdomain). Only the restaurant owner can call this.
// Also rewrites the namespaced auth emails for every restaurant_customer
// (`local+<oldSlug>@domain` -> `local+<newSlug>@domain`) so existing customers
// can keep signing in after the rename.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Must stay in sync with src/lib/tenant-host.ts RESERVED_SUBDOMAINS.
const RESERVED_SLUGS = new Set<string>([
  'www', 'app', 'api', 'admin', 'staff', 'platform', 'system', 'root',
  'auth', 'login', 'logout', 'signup', 'signin', 'register', 'oauth', 'sso',
  'dashboard', 'settings', 'account', 'accounts', 'billing', 'payments', 'payment',
  'mail', 'email', 'smtp', 'imap', 'pop', 'pop3', 'mx', 'ns', 'ns1', 'ns2',
  'ftp', 'sftp', 'ssh', 'vpn',
  'marketing', 'blog', 'news', 'docs', 'doc', 'help', 'support', 'kb', 'faq',
  'about', 'contact', 'terms', 'privacy', 'legal', 'pricing',
  'status', 'health', 'metrics', 'monitor', 'logs',
  'cdn', 'assets', 'static', 'media', 'img', 'images', 'files', 'storage', 'uploads',
  'test', 'staging', 'preview', 'dev', 'beta', 'alpha', 'sandbox',
  'public', 'private', 'internal',
  'store', 'stores', 'shop', 'shops', 'order', 'orders', 'menu', 'menus',
  'qr', 'kitchen', 'waiter', 'server', 'pos', 'kds',
  'reservation', 'reservations', 'booking', 'bookings',
  'customer', 'customers', 'user', 'users', 'owner', 'owners',
  'analytics', 'reports',
]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Body {
  restaurantId: string;
  newSlug: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });

    // Verify caller
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json(401, { error: 'Not authenticated' });
    const userId = userRes.user.id;

    const raw = (await req.json()) as Body;
    const restaurantId = raw.restaurantId;
    const newSlug = (raw.newSlug ?? '').trim().toLowerCase();

    if (!restaurantId) return json(400, { error: 'restaurantId required' });
    if (!SLUG_RE.test(newSlug)) {
      return json(400, {
        error: 'Slug must be 2-60 chars, lowercase letters, numbers and dashes only',
      });
    }
    if (RESERVED_SLUGS.has(newSlug)) {
      return json(409, { error: `"${newSlug}" is reserved — please choose another` });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Confirm ownership and load current slug
    const { data: r, error: rErr } = await admin
      .from('restaurants')
      .select('id, slug, owner_id')
      .eq('id', restaurantId)
      .maybeSingle();
    if (rErr || !r) return json(404, { error: 'Restaurant not found' });

    // Allow platform admins to rename any restaurant; otherwise must be owner
    let isPlatformAdmin = false;
    try {
      const { data: pa } = await userClient.rpc('is_platform_admin');
      isPlatformAdmin = pa === true;
    } catch (_) { /* ignore */ }
    if (!isPlatformAdmin && r.owner_id !== userId) {
      return json(403, { error: 'Only the restaurant owner or a platform admin can rename' });
    }
    const oldSlug = r.slug;
    if (oldSlug === newSlug) return json(200, { ok: true, unchanged: true });

    // Uniqueness check
    const { data: clash } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', newSlug)
      .maybeSingle();
    if (clash) return json(409, { error: `"${newSlug}" is already taken` });

    // Rename the restaurant
    const { error: updErr } = await admin
      .from('restaurants')
      .update({ slug: newSlug })
      .eq('id', restaurantId);
    if (updErr) return json(500, { error: updErr.message });

    // Rewrite namespaced auth emails for this restaurant's customers.
    // Pattern: `<local>+<oldSlug>@<domain>` -> `<local>+<newSlug>@<domain>`
    const { data: customers } = await admin
      .from('restaurant_customers')
      .select('auth_user_id')
      .eq('restaurant_id', restaurantId);

    let updatedCustomers = 0;
    let failedCustomers = 0;
    if (customers && customers.length > 0) {
      for (const c of customers) {
        if (!c.auth_user_id) continue;
        try {
          const { data: u } = await admin.auth.admin.getUserById(c.auth_user_id);
          const email = u?.user?.email;
          if (!email) continue;
          const tag = `+${oldSlug}@`;
          const idx = email.indexOf(tag);
          if (idx === -1) continue;
          const newEmail = `${email.slice(0, idx)}+${newSlug}@${email.slice(idx + tag.length)}`;
          const { error: emailErr } = await admin.auth.admin.updateUserById(c.auth_user_id, {
            email: newEmail,
            email_confirm: true,
          });
          if (emailErr) {
            failedCustomers += 1;
            console.warn('[rename-slug] email update failed', c.auth_user_id, emailErr.message);
          } else {
            updatedCustomers += 1;
          }
        } catch (e) {
          failedCustomers += 1;
          console.warn('[rename-slug] customer rewrite error', e);
        }
      }
    }

    return json(200, {
      ok: true,
      oldSlug,
      newSlug,
      updatedCustomers,
      failedCustomers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json(500, { error: message });
  }
});
