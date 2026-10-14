// Platform admin: manage existing tenants.
// Supported actions:
//   - reset_owner_password { tenantId, newPassword }
//   - change_plan { tenantId, plan: configured package tier, status }
//   - list_members { tenantId } -> [{ userId, email, displayName, roles[], isOwner, joinedAt }]
//   - remove_member { tenantId, userId }
//   - transfer_ownership { tenantId, newOwnerEmail }
// Gated by `is_platform_admin()` on the calling JWT.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json({ error: 'Missing token' }, 401);

    // Verify caller is platform admin
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: isAdmin, error: adminErr } = await userClient.rpc('is_platform_admin');
    if (adminErr || isAdmin !== true) return json({ error: 'Forbidden: not a platform admin' }, 403);

    const body = await req.json().catch(() => ({}));
    const action = String(body?.action ?? '');
    const tenantId = String(body?.tenantId ?? '');
    if (!tenantId) return json({ error: 'tenantId is required' }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    // Fetch tenant
    const { data: tenant, error: tErr } = await admin
      .from('restaurants')
      .select('id, name, owner_id')
      .eq('id', tenantId)
      .maybeSingle();
    if (tErr) return json({ error: tErr.message }, 500);
    if (!tenant) return json({ error: 'Restaurant not found' }, 404);

    switch (action) {
      case 'set_active': {
        if (typeof body.isActive !== 'boolean') return json({ error: 'Restaurant status is required' }, 400);
        const { data, error } = await admin.from('restaurants').update({ is_active: body.isActive }).eq('id', tenantId).select('id, is_active').single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true, restaurant: data });
      }
      case 'delete_tenant': {
        const { error } = await admin.from('restaurants').delete().eq('id', tenantId).select('id').single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case 'assign_theme': {
        const themeId = body.themeId;
        if (themeId !== null && (typeof themeId !== 'string' || !/^[a-f0-9-]{36}$/i.test(themeId))) return json({ error: 'Invalid theme' }, 400);
        if (themeId) {
          const { data: theme, error } = await admin.from('platform_themes').select('id').eq('id', themeId).eq('is_active', true).maybeSingle();
          if (error) return json({ error: error.message }, 500);
          if (!theme) return json({ error: 'Theme is unavailable' }, 400);
        }
        const { error } = await admin.from('restaurants').update({ theme_id: themeId }).eq('id', tenantId).select('id').single();
        if (error) return json({ error: error.message }, 500);
        return json({ success: true });
      }
      case 'reset_owner_password': {
        const newPassword = String(body?.newPassword ?? '');
        if (newPassword.length < 8) return json({ error: 'Password must be ≥ 8 chars' }, 400);
        if (!tenant.owner_id) return json({ error: 'Tenant has no owner assigned' }, 400);
        const { error } = await admin.auth.admin.updateUserById(tenant.owner_id, {
          password: newPassword,
        });
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case 'change_plan': {
        const plan = String(body?.plan ?? '');
        const status = body?.status ? String(body.status) : 'active';
        const { data: configuredPlan, error: planError } = await admin.from('subscription_plans').select('tier').eq('tier', plan).maybeSingle();
        if (planError) return json({ error: planError.message }, 500);
        if (!configuredPlan && plan !== 'free') return json({ error: 'Choose a configured package' }, 400);
        if (!['active', 'trialing', 'past_due', 'canceled', 'expired'].includes(status))
          return json({ error: 'Invalid status' }, 400);

        // Optional: explicit expiry date (ISO string) or null to clear
        let periodEnd: string | null | undefined = undefined;
        if (Object.prototype.hasOwnProperty.call(body ?? {}, 'currentPeriodEnd')) {
          const raw = body.currentPeriodEnd;
          if (raw === null || raw === '') {
            periodEnd = null;
          } else {
            const d = new Date(String(raw));
            if (isNaN(d.getTime())) return json({ error: 'Invalid currentPeriodEnd' }, 400);
            periodEnd = d.toISOString();
          }
        }

        const payload: Record<string, unknown> = { plan, status: plan === 'trial' && status === 'active' ? 'trialing' : status };
        if (periodEnd !== undefined) payload.current_period_end = periodEnd;

        const { data: existing, error: subscriptionError } = await admin
          .from('subscriptions')
          .select('id, plan')
          .eq('restaurant_id', tenantId)
          .maybeSingle();

        if (subscriptionError) return json({ error: subscriptionError.message }, 500);
        if (plan === 'trial' && existing?.plan !== 'trial') return json({ error: 'The free trial is only assigned automatically to new restaurants' }, 400);
        if (existing) {
          const { error } = await admin
            .from('subscriptions')
            .update(payload)
            .eq('restaurant_id', tenantId);
          if (error) return json({ error: error.message }, 400);
        } else {
          const { error } = await admin
            .from('subscriptions')
            .insert({ restaurant_id: tenantId, ...payload });
          if (error) return json({ error: error.message }, 400);
        }
        return json({ success: true, plan, status, current_period_end: periodEnd });
      }

      case 'list_members': {
        const { data: members, error: mErr } = await admin
          .from('restaurant_members')
          .select('user_id, created_at')
          .eq('restaurant_id', tenantId);
        if (mErr) return json({ error: mErr.message }, 400);

        const userIds = (members ?? []).map((m) => m.user_id);
        if (userIds.length === 0) return json({ members: [] });

        const { data: profiles, error: profileError } = await admin
          .from('profiles')
          .select('user_id, display_name')
          .in('user_id', userIds);
        const { data: roles, error: rolesError } = await admin
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', userIds);

        if (profileError || rolesError) return json({ error: profileError?.message ?? rolesError?.message }, 500);

        // Fetch emails via admin auth (paginate up to 1000)
        const emailMap = new Map<string, string>();
        let page = 1;
        while (true) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          for (const u of data?.users ?? []) {
            if (userIds.includes(u.id) && u.email) emailMap.set(u.id, u.email);
          }
          if (!data?.users || data.users.length < 200) break;
          page++;
          if (page > 5) break;
        }

        const result = (members ?? []).map((m) => ({
          userId: m.user_id,
          joinedAt: m.created_at,
          email: emailMap.get(m.user_id) ?? null,
          displayName: profiles?.find((p) => p.user_id === m.user_id)?.display_name ?? null,
          roles: (roles ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role),
          isOwner: m.user_id === tenant.owner_id,
        }));

        return json({ members: result });
      }

      case 'remove_member': {
        const userId = String(body?.userId ?? '');
        if (!userId) return json({ error: 'userId required' }, 400);
        if (userId === tenant.owner_id)
          return json({ error: 'Cannot remove the owner; transfer ownership first' }, 400);
        const { error } = await admin
          .from('restaurant_members')
          .delete()
          .eq('restaurant_id', tenantId)
          .eq('user_id', userId);
        if (error) return json({ error: error.message }, 400);
        return json({ success: true });
      }

      case 'transfer_ownership': {
        const newOwnerEmail = String(body?.newOwnerEmail ?? '').trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newOwnerEmail))
          return json({ error: 'Invalid email' }, 400);

        // Find user by email
        let newOwnerId: string | null = null;
        let page = 1;
        while (true) {
          const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
          const found = data?.users?.find((u) => u.email?.toLowerCase() === newOwnerEmail);
          if (found) { newOwnerId = found.id; break; }
          if (!data?.users || data.users.length < 200) break;
          page++;
          if (page > 5) break;
        }
        if (!newOwnerId) return json({ error: 'No user found with that email' }, 404);

        // Update owner_id
        const { error: updErr } = await admin
          .from('restaurants')
          .update({ owner_id: newOwnerId })
          .eq('id', tenantId);
        if (updErr) return json({ error: updErr.message }, 400);

        // Ensure membership + owner role
        await admin.from('restaurant_members').upsert(
          { restaurant_id: tenantId, user_id: newOwnerId },
          { onConflict: 'restaurant_id,user_id', ignoreDuplicates: true },
        );
        await admin.from('user_roles').upsert(
          { user_id: newOwnerId, role: 'owner' },
          { onConflict: 'user_id,role', ignoreDuplicates: true },
        );

        return json({ success: true, newOwnerId });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err: any) {
    return json({ error: err?.message ?? 'Unexpected error' }, 500);
  }
});
