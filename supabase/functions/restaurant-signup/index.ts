import { RESERVED_SLUGS } from '../_shared/restaurant-slug.ts';
// Public self-serve restaurant signup.
// Creates auth user + restaurant + owner role + default branch (via DB trigger) atomically.
// No JWT required — this is the equivalent of "Sign up your restaurant".

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  restaurantName: string;
  slug?: string;
  ownerEmail: string;
  ownerPassword: string;
  ownerDisplayName?: string;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
}

// Must stay in sync with src/lib/tenant-host.ts RESERVED_SUBDOMAINS.


const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const raw = await req.json().catch(() => null) as Body | null;
    if (!raw || typeof raw !== 'object') return json(400, { error: 'Invalid request body' });
    if ([raw.restaurantName, raw.ownerEmail, raw.ownerPassword].some(value => typeof value !== 'string') ||
        (raw.slug !== undefined && typeof raw.slug !== 'string')) {
      return json(400, { error: 'Restaurant name, email, password and public URL must be text' });
    }
    const restaurantName = (raw.restaurantName ?? '').trim();
    const ownerEmail = (raw.ownerEmail ?? '').trim().toLowerCase();
    const ownerPassword = raw.ownerPassword ?? '';
    const ownerDisplayName = typeof raw.ownerDisplayName === 'string' ? raw.ownerDisplayName.trim() || null : null;

    if (restaurantName.length < 2 || restaurantName.length > 80) {
      return json(400, { error: 'Restaurant name must be 2-80 characters' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return json(400, { error: 'Invalid email address' });
    }
    if (ownerPassword.length < 8) {
      return json(400, { error: 'Password must be at least 8 characters' });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    const requestedSlug = raw.slug?.trim().toLowerCase();
    if (requestedSlug && (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])$/.test(requestedSlug) || RESERVED_SLUGS.has(requestedSlug))) {
      return json(400, { error: 'Choose a public URL with 2-60 letters, numbers or hyphens, without a reserved name' });
    }

    // Slug assignment strategy:
    //   1. Try to claim the next available subdomain from the platform-managed pool (instant, pre-vetted).
    //   2. If the pool is empty, derive a slug from the restaurant name with -2, -3, … on collision.
    let slug: string | null = requestedSlug || null;
    let pooledEntryId: string | null = null;

    if (requestedSlug) {
      const { data: existing, error } = await admin.from('restaurants').select('id').eq('slug', requestedSlug).maybeSingle();
      if (error) throw error;
      if (existing) return json(409, { error: `Public URL "${requestedSlug}" is already taken` });
      const { data: poolEntry, error: poolError } = await admin.from('subdomain_pool').select('id, status').eq('subdomain', requestedSlug).maybeSingle();
      if (poolError) throw poolError;
      if (poolEntry && poolEntry.status !== 'available') return json(409, { error: 'This public URL is unavailable' });
      pooledEntryId = poolEntry?.id ?? null;
    } else {
      const { data: poolEntry, error: poolError } = await admin.from('subdomain_pool')
        .select('id, subdomain').eq('status', 'available').order('created_at', { ascending: true }).limit(1).maybeSingle();
      if (poolError) throw poolError;
      if (poolEntry?.subdomain && !RESERVED_SLUGS.has(poolEntry.subdomain)) {
        const { data: clash, error } = await admin.from('restaurants').select('id').eq('slug', poolEntry.subdomain).maybeSingle();
        if (error) throw error;
        if (!clash) { slug = poolEntry.subdomain; pooledEntryId = poolEntry.id; }
      }
    }

    if (!slug) {
      let baseSlug = slugify(restaurantName) || 'store';
      if (baseSlug.length < 2) baseSlug = 'store';
      if (RESERVED_SLUGS.has(baseSlug)) baseSlug = `${baseSlug}-store`;

      baseSlug = baseSlug.slice(0, 54).replace(/-+$/g, '');
      slug = baseSlug;
      let attempt = 1;
      while (true) {
        if (!RESERVED_SLUGS.has(slug)) {
          const { data: existing, error: lookupError } = await admin
            .from('restaurants')
            .select('id')
            .eq('slug', slug)
            .maybeSingle();
          if (lookupError) throw lookupError;
          if (!existing) break;
        }
        attempt += 1;
        if (attempt > 50) {
          slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;
          break;
        }
        slug = `${baseSlug}-${attempt}`;
      }
    }

    // Reject if email already exists (avoid hijacking another user's account)
    let found = false;
    for (let page = 1; !found; page++) {
      const { data: usersList, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      found = usersList.users.some(u => u.email?.toLowerCase() === ownerEmail);
      if (usersList.users.length < 200) break;
    }
    if (found) {
      return json(409, {
        error: 'This email is already registered. Please sign in instead.',
      });
    }

    // Create owner auth user (auto-confirmed so they can log in immediately)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
      user_metadata: { display_name: ownerDisplayName ?? ownerEmail },
    });
    if (createErr || !created.user) {
      return json(400, { error: createErr?.message ?? 'Failed to create account' });
    }
    const ownerId = created.user.id;

    // Create restaurant — DB trigger handles branch, owner role, member link
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .insert({ name: restaurantName, slug, owner_id: ownerId })
      .select('id, name, slug')
      .single();

    if (restErr || !restaurant) {
      // Roll back the auth user so they can retry
      await admin.auth.admin.deleteUser(ownerId).catch(() => null);
      return json(restErr?.code === '23505' ? 409 : 500, { error: restErr?.code === '23505' ? 'This public URL is already taken. Please choose another.' : restErr?.message ?? 'Failed to create restaurant' });
    }

    // Mark pooled subdomain as assigned (best-effort, non-blocking)
    if (pooledEntryId) {
      try {
        const { error: poolUpdateErr } = await admin
          .from('subdomain_pool')
          .update({
            status: 'assigned',
            assigned_restaurant_id: restaurant.id,
            assigned_at: new Date().toISOString(),
          })
          .eq('id', pooledEntryId);
        if (poolUpdateErr) {
          console.error('Pool tracking update failed:', poolUpdateErr);
        }
      } catch (e) {
        console.error('Pool tracking exception:', e);
      }
    }

    return json(200, { success: true, restaurant, ownerId });
  } catch (err) {
    const message = err instanceof Error || (typeof err === 'object' && err !== null && 'message' in err) ? String(err.message) : 'Unexpected error';
    return json(500, { error: message });
  }
});
