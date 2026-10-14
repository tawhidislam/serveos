import { RESERVED_SLUGS } from '../_shared/restaurant-slug.ts';
// Platform admin: create a new restaurant tenant (auth user + restaurant + owner link).
// Gated by `is_platform_admin()` on the calling JWT. Uses service role to perform writes.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface Body {
  restaurantName: string;
  slug: string;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is a platform admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminErr } = await userClient.rpc(
      'is_platform_admin',
    );
    if (adminErr || isAdmin !== true) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: not a platform admin' }),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Parse + validate body
    const raw = await req.json().catch(() => null) as Body | null;
    if (!raw || typeof raw !== 'object' || [raw.restaurantName, raw.ownerEmail, raw.ownerPassword].some(value => typeof value !== 'string') ||
        (raw.slug !== undefined && typeof raw.slug !== 'string')) {
      return new Response(JSON.stringify({ error: 'Invalid restaurant creation details' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const restaurantName = (raw.restaurantName ?? '').trim();
    const slugRaw = (raw.slug ?? '').trim();
    const ownerEmail = (raw.ownerEmail ?? '').trim().toLowerCase();
    const ownerPassword = raw.ownerPassword ?? '';
    const ownerDisplayName = typeof raw.ownerDisplayName === 'string' ? raw.ownerDisplayName.trim() || null : null;

    if (restaurantName.length < 2 || restaurantName.length > 80) {
      return new Response(
        JSON.stringify({ error: 'Restaurant name must be 2-80 chars' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const slug = slugify(slugRaw || restaurantName);
    if (slug.length < 2 || RESERVED_SLUGS.has(slug)) {
      return new Response(
        JSON.stringify({ error: 'Public URL must have at least 2 characters and cannot use a reserved name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      return new Response(
        JSON.stringify({ error: 'Invalid owner email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    if (ownerPassword.length < 8) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 8 chars' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false },
    });

    // Slug uniqueness
    const { data: existing, error: lookupError } = await admin
      .from('restaurants')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) {
      return new Response(
        JSON.stringify({ error: `Slug "${slug}" is already taken` }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // Find or create owner auth user
    let ownerId: string | null = null;
    let found: { id: string; email?: string } | undefined;
    for (let page = 1; !found; page++) {
      const { data: usersList, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      found = usersList.users.find(user => user.email?.toLowerCase() === ownerEmail);
      if (usersList.users.length < 200) break;
    }
    if (found) {
      ownerId = found.id;
      const { data: linked, error: membershipError } = await admin.from('restaurant_members').select('id').eq('user_id', found.id).limit(1);
      if (membershipError) throw membershipError;
      if (linked?.length) return new Response(JSON.stringify({ error: 'This owner already belongs to a restaurant. Use a different owner email.' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    } else {
      const { data: created, error: createErr } =
        await admin.auth.admin.createUser({
          email: ownerEmail,
          password: ownerPassword,
          email_confirm: true,
          user_metadata: { display_name: ownerDisplayName ?? ownerEmail },
        });
      if (createErr || !created.user) {
        return new Response(
          JSON.stringify({ error: createErr?.message ?? 'Failed to create user' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        );
      }
      ownerId = created.user.id;
    }

    // Create restaurant — handle_new_restaurant trigger will create branch + owner role + member link
    const { data: restaurant, error: restErr } = await admin
      .from('restaurants')
      .insert({
        name: restaurantName,
        slug,
        owner_id: ownerId,
      })
      .select('id, name, slug')
      .single();

    if (restErr || !restaurant) {
      // A failed provisioning attempt must not leave an unusable owner account.
      if (!found && ownerId) {
        const { error: cleanupError } = await admin.auth.admin.deleteUser(ownerId);
        if (cleanupError) console.error('Owner cleanup failed:', cleanupError.message);
      }
      return new Response(
        JSON.stringify({ error: restErr?.message ?? 'Failed to create restaurant' }),
        { status: restErr?.code === '23505' ? 409 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        restaurant,
        ownerId,
        ownerCreated: !found,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error || (typeof err === 'object' && err !== null && 'message' in err) ? String(err.message) : 'Unexpected error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
