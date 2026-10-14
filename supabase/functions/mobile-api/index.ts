import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ADMIN_ROLES, SERVICE_ROLES, STAFF_ROLES, RESOURCES, ApiError, allowFields, canonicalJson, kitchenOrder, kitchenOrderItem, pagination, record, requireUuid, text, validateOrderItems, validateResourceBody, type StaffRole } from '../_shared/mobile-api.ts';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,idempotency-key,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' };
const response = (data: unknown, status = 200, meta?: unknown) => new Response(JSON.stringify({ data, ...(meta ? { meta } : {}) }), { status, headers: cors });
const digest = async (value: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(x => x.toString(16).padStart(2, '0')).join('');
function check(result: { data: unknown; error: { code?: string; message: string } | null }) {
  if (!result.error) return result.data;
  const e = result.error;
  if (e.code === '42501') throw new ApiError(403, 'FORBIDDEN', e.message);
  if (e.code === 'P0002' || e.code === 'PGRST116') throw new ApiError(404, 'NOT_FOUND', 'Record not found.');
  if (e.code === 'PT409' || e.code === '40001' || e.code === '23505') throw new ApiError(409, 'CONFLICT', e.code === '23505' ? 'A record with these values already exists.' : e.message);
  if (e.code?.startsWith('22') || e.code?.startsWith('23') || e.code === 'P0001') throw new ApiError(400, 'INVALID_INPUT', e.code === 'P0001' ? e.message : 'Invalid input or related record.');
  console.error('Mobile API database failure code:', e.code ?? 'transport');
  throw new ApiError(500, 'DATABASE_ERROR', 'Could not complete the request.');
}
async function bodyOf(req: Request) { const raw = await req.text(); if (new TextEncoder().encode(raw).byteLength > 65536) throw new ApiError(413, 'BODY_TOO_LARGE', 'JSON requests are limited to 64 KB.'); try { return record(JSON.parse(raw || '{}')); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError(400, 'INVALID_JSON', 'Invalid JSON request.'); } }

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
  const requestId = crypto.randomUUID();
  const url = new URL(req.url), route = url.pathname.split('/mobile-api/')[1]?.split('/').filter(Boolean) ?? [];
  const base = Deno.env.get('SUPABASE_URL')!, anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const backend = createClient(base, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const publicClient = createClient(base, anon, { auth: { persistSession: false } });
  const rate = async (key: string, limit: number) => { if (!check(await backend.rpc('mobile_api_rate_limit', { _key: key, _limit: limit }))) throw new ApiError(429, 'RATE_LIMITED', 'Too many requests. Try again in a minute.'); };
  try {
    if (route.length>6) throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.');
    if (route[0] !== 'v1') throw new ApiError(404, 'NOT_FOUND', 'Use the /mobile-api/v1 API.');
    if (route[1] === 'health' && req.method === 'GET') return response({ status: 'ok', version: 'v1' });
    if (route[1] === 'auth' && ['login', 'refresh'].includes(route[2]) && req.method === 'POST') {
      const body = await bodyOf(req);
      await rate(`auth:${await digest((req.headers.get('x-forwarded-for') ?? 'local') + ':' + String(body.email ?? body.refresh_token ?? '').toLowerCase())}`, 20);
      let result;
      if (route[2] === 'login') {
        allowFields(body, ['email', 'password']); const email = text(body.email, 'email', 254, true)!; text(body.password, 'password', 256, true); const password = body.password as string;
        result = await publicClient.auth.signInWithPassword({ email, password });
      } else { allowFields(body, ['refresh_token']); result = await publicClient.auth.refreshSession({ refresh_token: text(body.refresh_token, 'refresh_token', 4096, true)! }); }
      if (result.error || !result.data.session) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials or expired session.');
      const id = result.data.user!.id;
      const memberships = check(await backend.from('restaurant_members').select('restaurant_id').eq('user_id', id)) as { restaurant_id: string }[];
      const owned = check(await backend.from('restaurants').select('id').eq('owner_id', id)) as { id: string }[];
      let eligible = false;
      for (const restaurantId of [...new Set([...memberships.map(m => m.restaurant_id), ...owned.map(r => r.id)])]) { const { error } = await backend.rpc('mobile_api_context', { _actor: id, _restaurant: restaurantId }); if (!error) { eligible = true; break; } }
      if (!eligible) { await publicClient.auth.signOut(); throw new ApiError(403, 'STAFF_REQUIRED', 'A restaurant staff account is required.'); }
      return response({ access_token: result.data.session.access_token, refresh_token: result.data.session.refresh_token, expires_at: result.data.session.expires_at, expires_in: result.data.session.expires_in, token_type: 'Bearer', user: { id, email: result.data.user?.email } });
    }
    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) throw new ApiError(401, 'UNAUTHORIZED', 'A Bearer access token is required.');
    const caller = createClient(base, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await caller.auth.getUser();
    if (authError || !user) throw new ApiError(401, 'UNAUTHORIZED', 'Session expired. Refresh your access token.');
    await rate(`user:${user.id}`, 180);
    if (route[1] === 'auth' && route[2] === 'logout' && req.method === 'POST') {
      const { error } = await backend.auth.admin.signOut(authorization.slice(7), 'local'); if (error) throw new ApiError(400, 'LOGOUT_FAILED', 'Could not revoke the session.'); return response({ signed_out: true });
    }
    if (route[1] === 'auth' && route[2] === 'password' && req.method === 'POST') {
      const body = await bodyOf(req); allowFields(body, ['current_password', 'new_password']); text(body.current_password, 'current_password', 256, true); text(body.new_password, 'new_password', 256, true); if ((body.new_password as string).length < 8) throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters.');
      const { data, error } = await publicClient.auth.signInWithPassword({ email: user.email!, password: body.current_password as string }); if (error) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Current password is incorrect.');
      const changed = await publicClient.auth.updateUser({ password: body.new_password as string }); if (changed.error) throw new ApiError(400, 'PASSWORD_CHANGE_FAILED', 'Could not change password.'); await publicClient.auth.signOut({ scope: 'others' }); return response({ access_token: data.session!.access_token, refresh_token: data.session!.refresh_token, expires_at: data.session!.expires_at, expires_in: data.session!.expires_in, token_type: 'Bearer' });
    }
    if (route[1] === 'me' && route.length === 2) {
      if (req.method === 'GET') {
        const profile = check(await backend.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle());
        return response({ id: user.id, email: user.email, profile });
      }
      if (req.method === 'PATCH') {
        const body = await bodyOf(req); allowFields(body, ['display_name']);
        check(await backend.from('profiles').update({ display_name: text(body.display_name, 'display_name', 100, true) }).eq('user_id', user.id).select('user_id').single()); return response({ updated: true });
      }
    }
    if (route[1] !== 'restaurants') throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.');
    if (route.length === 2 && req.method === 'GET') {
      const memberRows = check(await backend.from('restaurant_members').select('restaurant_id').eq('user_id', user.id)) as { restaurant_id: string }[];
      const ownRows = check(await backend.from('restaurants').select('id').eq('owner_id', user.id)) as { id: string }[];
      const ids = [...new Set([...memberRows.map(m => m.restaurant_id), ...ownRows.map(r => r.id)])];
      const result = [];
      for (const id of ids) { const { data, error } = await backend.rpc('mobile_api_context', { _actor: user.id, _restaurant: id }); if (!error && data) result.push(data); }
      return response(result);
    }
    const restaurantId = requireUuid(route[2], 'restaurant_id');
    const context = check(await backend.rpc('mobile_api_context', { _actor: user.id, _restaurant: restaurantId })) as { restaurant: Record<string, unknown>; role: StaffRole; branch_ids: string[]; features: Record<string, boolean>; subscription: unknown; is_active: boolean; limits: Record<string, number | null> };
    const role = context.role, resourceName = route[3], id = route[4], actionName = route[5];
    const roles = (allowed: StaffRole[]) => { if (!allowed.includes(role)) throw new ApiError(403, 'ROLE_REQUIRED', 'Your staff role cannot perform this action.'); };
    const feature = (name?: string) => { if (name && !context.features[name]) throw new ApiError(403, 'FEATURE_UNAVAILABLE', `An active package with ${name} access is required.`); };
    const branch = (value: unknown) => { if (value == null) return; const branchId = requireUuid(value, 'branch_id'); if (context.branch_ids.length && !context.branch_ids.includes(branchId)) throw new ApiError(403, 'BRANCH_FORBIDDEN', 'Branch access denied.'); return branchId; };
    const scope = (query: any, withBranch = false) => { let q = query.eq('restaurant_id', restaurantId); if (withBranch && context.branch_ids.length) q = q.in('branch_id', context.branch_ids); const requested = url.searchParams.get('branch_id'); if (requested && withBranch) q = q.eq('branch_id', branch(requested)); return q; };
    const paged = async (query: any, transform?: (row: Record<string, unknown>) => unknown) => { const { limit, offset } = pagination(url.searchParams); const { data, error, count } = await query.range(offset, offset + limit - 1); check({ data, error }); return response(transform ? data?.map(transform) : data, 200, { limit, offset, total: count, request_id: requestId }); };
    const mutate = async (table: string, method: string, data: Record<string, unknown>, target?: string) => response(check(await backend.rpc('mobile_api_mutate', { _actor: user.id, _restaurant: restaurantId, _table: table, _method: method, _id: target ?? null, _data: data })), method === 'POST' ? 201 : 200);
    const action = async (name: string, data: Record<string, unknown>, target?: string) => response(check(await backend.rpc('mobile_api_action', { _actor: user.id, _restaurant: restaurantId, _action: name, _id: target ?? null, _data: data })), 200);
    if (resourceName === 'capabilities' && req.method === 'GET') return response({ role, features: context.features, limits: context.limits, branches: context.branch_ids, resources: Object.fromEntries(Object.entries(RESOURCES).map(([name, spec]) => [name, { read: spec.read.includes(role) && (!spec.feature || context.features[spec.feature]), write: !spec.readOnly && spec.write.includes(role) && (!spec.feature || context.features[spec.feature]) }])) });
    if (!resourceName && req.method === 'GET') return response(context);
    if (resourceName === 'branding' && req.method === 'PATCH') {
      roles(ADMIN_ROLES); const data = await bodyOf(req); allowFields(data, ['name', 'tagline', 'phone', 'address', 'cuisine_type', 'logo_url', 'primary_color', 'accent_color', 'theme_id', 'theme_overrides']); if (data.theme_id != null) requireUuid(data.theme_id, 'theme_id'); return await action('branding', data);
    }
    if (resourceName === 'events' && req.method === 'GET') {
      feature('operations'); const rawSince = url.searchParams.get('since'); if (!rawSince || !Number.isFinite(Date.parse(rawSince))) throw new ApiError(400, 'INVALID_DATE', 'A valid since timestamp is required.');
      const since = new Date(rawSince).toISOString(), after = url.searchParams.get('after_id'); if (after) requireUuid(after, 'after_id');
      let query = scope(backend.from('orders').select(role === 'kitchen' ? 'id,branch_id,status,updated_at' : 'id,branch_id,status,paid_at,total_amount,updated_at'), true);
      query = after ? query.or(`updated_at.gt.${since},and(updated_at.eq.${since},id.gt.${after})`) : query.gte('updated_at', since);
      const rows = check(await query.order('updated_at').order('id').limit(101)) as { id: string; updated_at: string }[]; const batch = rows.slice(0,100), last = batch[batch.length-1];
      return response(batch, 200, { next_cursor: last ? { since: last.updated_at, after_id: last.id } : { since, ...(after ? { after_id: after } : {}) }, has_more: rows.length>100, server_time: new Date().toISOString() });
    }
    if (resourceName === 'audit' && req.method === 'GET') {
      roles(ADMIN_ROLES); feature('accounting'); const {limit,offset}=pagination(url.searchParams), from=url.searchParams.get('from')??new Date(Date.now()-30*86400000).toISOString(), to=url.searchParams.get('to')??new Date().toISOString();
      if(!Number.isFinite(Date.parse(from))||!Number.isFinite(Date.parse(to))) throw new ApiError(400,'INVALID_DATE','Use ISO dates for from and to.');
      const result=check(await backend.rpc('mobile_api_audit',{_actor:user.id,_restaurant:restaurantId,_from:from,_to:to,_limit:limit,_offset:offset})) as {rows:unknown[];total:number};return response(result.rows,200,{limit,offset,total:result.total});
    }
    if (['dashboard', 'reports'].includes(resourceName) && req.method === 'GET') {
      roles(ADMIN_ROLES); if(resourceName==='reports') feature('accounting'); const from = url.searchParams.get('from') ?? new Date(Date.now() - 30 * 86400000).toISOString(), to = url.searchParams.get('to') ?? new Date().toISOString(); if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) throw new ApiError(400, 'INVALID_DATE', 'Use ISO dates for from and to.');
      const report = check(await backend.rpc('mobile_api_report', { _actor: user.id, _restaurant: restaurantId, _from: from, _to: to })) as Record<string, unknown>;
      if (resourceName === 'reports' && id === 'export') { const cell = (value: unknown) => `"${String(value ?? '').replace(/^([=+@-])/, "'$1").replace(/"/g, '""')}"`; const csv = [['metric','value'],...Object.entries(report).filter(([,value]) => !Array.isArray(value))].map(row => row.map(cell).join(',')).join('\r\n'); return new Response(csv, { headers: { ...cors, 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename=serveos-report.csv' } }); }
      return response(report);
    }
    if (resourceName === 'staff') {
      roles(['owner', 'admin']);
      if (req.method === 'GET') {
        const { limit, offset } = pagination(url.searchParams);
        const result = await backend.from('restaurant_members').select('user_id,role,created_at', { count: 'exact' }).eq('restaurant_id', restaurantId).order('created_at').order('user_id').range(offset,offset+limit-1);
        const members = check(result) as { user_id: string; role: string; created_at: string }[];
        if (!members.length) return response([],200,{limit,offset,total:result.count});
        const ids = members.map(member => member.user_id);
        const [profilesResult,branchesResult,rolesResult] = await Promise.all([backend.from('profiles').select('user_id,display_name').in('user_id',ids),backend.from('staff_branches').select('user_id,branch_id').eq('restaurant_id',restaurantId).in('user_id',ids),backend.from('user_roles').select('user_id,role').in('user_id',ids)]);
        const profiles=check(profilesResult) as {user_id:string;display_name:string}[],assigned=check(branchesResult) as {user_id:string;branch_id:string}[],existingRoles=check(rolesResult) as {user_id:string;role:string}[];
        const users=await Promise.all(ids.map(id=>backend.auth.admin.getUserById(id)));
        return response(members.map((member,index)=>({...member,role:member.user_id===context.restaurant.owner_id?'owner':member.role||['admin','manager','kitchen','waiter','server'].find(role=>existingRoles.some(row=>row.user_id===member.user_id&&row.role===role)),email:users[index].data.user?.email,profile:profiles.find(profile=>profile.user_id===member.user_id),branches:assigned.filter(row=>row.user_id===member.user_id).map(row=>row.branch_id)})),200,{limit,offset,total:result.count});
      }
      const body = req.method === 'DELETE' ? {} : await bodyOf(req);
      if (req.method === 'POST' && !id) {
        allowFields(body, ['email', 'password', 'display_name', 'role']); const email = text(body.email, 'email', 254, true)!; text(body.password, 'password', 256, true); const password = body.password as string; if (password.length < 8) throw new ApiError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters.');
        if (!['admin', 'manager', 'kitchen', 'waiter', 'server'].includes(String(body.role)) || (body.role === 'admin' && role !== 'owner')) throw new ApiError(403, 'ROLE_REQUIRED', 'Only the owner may create restaurant admins.');
        const { data, error } = await backend.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: text(body.display_name, 'display_name', 100) || email } }); if (error || !data.user) throw new ApiError(409, 'ACCOUNT_EXISTS', 'Could not create staff. Use a unique email address.');
        try { check(await backend.rpc('mobile_staff_change', { _actor: user.id, _restaurant: restaurantId, _user: data.user.id, _role: body.role, _remove: false })); } catch (error) { await backend.auth.admin.deleteUser(data.user.id); throw error; }
        return response({ id: data.user.id, email, role: body.role }, 201);
      }
      if (id && ['PATCH', 'DELETE'].includes(req.method)) {
        requireUuid(id, 'staff_id'); if (req.method === 'PATCH') allowFields(body, ['role']);
        const member = check(await backend.from('restaurant_members').select('role').eq('restaurant_id', restaurantId).eq('user_id', id).maybeSingle()) as { role: string } | null; if (!member) throw new ApiError(404, 'NOT_FOUND', 'Staff member not found.');
        check(await backend.rpc('mobile_staff_change', { _actor: user.id, _restaurant: restaurantId, _user: id, _role: req.method === 'PATCH' ? body.role : member.role || 'waiter', _remove: req.method === 'DELETE' })); return response({ updated: true });
      }
    }
    if (resourceName === 'orders' || resourceName === 'kitchen') {
      roles(STAFF_ROLES); feature('operations');
      if (req.method === 'GET') {
        if (actionName === 'receipt') roles(SERVICE_ROLES);
        let query = scope(backend.from('orders').select(role === 'kitchen' ? 'id,restaurant_id,branch_id,table_id,status,order_type,ticket_number,notes,created_at,updated_at,order_items(*,menu_items(name,prep_time_minutes)),restaurant_tables(label)' : '*,order_items(*,menu_items(name,price,prep_time_minutes)),restaurant_tables(label)', { count: 'exact' }), true);
        if (resourceName === 'kitchen') query = query.in('status', ['pending', 'confirmed', 'preparing', 'ready']);
        const status = url.searchParams.get('status'); if (status) query = query.eq('status', status);
        const since = url.searchParams.get('updated_since'); if (since) { if (!Number.isFinite(Date.parse(since))) throw new ApiError(400, 'INVALID_DATE', 'Invalid updated_since date.'); query = query.gte('updated_at', since); }
        if (id) { const order = check(await query.eq('id', requireUuid(id)).single()); if (actionName === 'receipt') { const settings = check(await backend.from('restaurant_settings').select('restaurant_name,address,contact_phone,currency,logo_url').eq('restaurant_id', restaurantId).single()); return response({ order, restaurant: settings }); } return response(role === 'kitchen' ? kitchenOrder(order as Record<string, unknown>) : order); }
        return await paged(query.order('created_at', { ascending: false }).order('id'), role === 'kitchen' ? kitchenOrder : undefined);
      }
      if (resourceName === 'orders' && req.method === 'POST' && !id) {
        roles(SERVICE_ROLES); const body = await bodyOf(req); allowFields(body, ['branch_id', 'table_id', 'order_type', 'customer_name', 'customer_phone', 'delivery_address', 'delivery_instructions', 'notes', 'items']);
        branch(requireUuid(body.branch_id, 'branch_id')); if (body.table_id != null) requireUuid(body.table_id, 'table_id');
        validateOrderItems(body.items);
        const key = req.headers.get('Idempotency-Key'); if (!key || key.length < 8 || key.length > 128) throw new ApiError(400, 'IDEMPOTENCY_REQUIRED', 'Provide an Idempotency-Key header of 8–128 characters.');
        return response(check(await backend.rpc('mobile_create_order', { _actor: user.id, _restaurant: restaurantId, _payload: body, _key: key, _hash: await digest(canonicalJson(body)) })), 201);
      }
      if (resourceName === 'orders' && id && !actionName && req.method === 'PATCH') {
        roles(SERVICE_ROLES); const body = await bodyOf(req); allowFields(body, ['expected_updated_at', 'notes', 'items']);
        if (typeof body.expected_updated_at !== 'string' || !Number.isFinite(Date.parse(body.expected_updated_at))) throw new ApiError(400, 'INVALID_DATE', 'expected_updated_at is required for editing.');
        if (!('notes' in body) && !('items' in body)) throw new ApiError(400, 'EMPTY_BODY', 'Provide notes or items to edit.');
        if (body.notes != null) text(body.notes, 'notes', 4000); if ('items' in body) validateOrderItems(body.items, true);
        return response(check(await backend.rpc('mobile_edit_order', { _actor: user.id, _restaurant: restaurantId, _order: requireUuid(id), _payload: body })));
      }
      if (resourceName === 'orders' && id && actionName && req.method === 'POST') {
        requireUuid(id, 'order_id'); const body = await bodyOf(req); const allowed: Record<string, string[]> = { status: ['status', 'expected_status'], payment: ['payment_method'], discount: ['discount_amount'], table: ['table_id'] }; if (!allowed[actionName]) throw new ApiError(404, 'NOT_FOUND', 'Order action not found.'); allowFields(body, allowed[actionName]); if (actionName === 'status') { text(body.expected_status, 'expected_status', 20, true); text(body.status, 'status', 20, true); } if(actionName==='payment') text(body.payment_method,'payment_method',30,true); if (actionName === 'discount' && (typeof body.discount_amount!=='number'||!Number.isFinite(body.discount_amount)||body.discount_amount<0)) throw new ApiError(400,'INVALID_INPUT','discount_amount must be a non-negative number.'); if (actionName === 'table') requireUuid(body.table_id, 'table_id');
        const result = check(await backend.rpc('mobile_order_action', { _actor: user.id, _restaurant: restaurantId, _order: id, _action: actionName, _payload: body })) as Record<string, unknown>;
        if (role === 'kitchen') return response(kitchenOrder(result)); return response(result);
      }
    }
    if (resourceName === 'tables' && id && ['status', 'qr'].includes(actionName)) {
      feature('operations');
      if (actionName === 'status' && req.method === 'POST') { roles(SERVICE_ROLES); const body = await bodyOf(req); allowFields(body, ['status']); return await action('table-status', body, requireUuid(id)); }
      if (actionName === 'qr' && req.method === 'GET') { const table = check(await scope(backend.from('restaurant_tables').select('id,label,qr_code_url'), true).eq('id', requireUuid(id)).single()) as Record<string, unknown>; const site = (Deno.env.get('PUBLIC_SITE_URL') || 'http://127.0.0.1:8080').replace(/\/$/,''); return response({ table_id: table.id, label: table.label, url: table.qr_code_url || `${site}/r/${context.restaurant.slug}/menu?table_id=${id}` }); }
    }
    if (resourceName === 'order-items' && id && actionName === 'status' && req.method === 'POST') { roles(STAFF_ROLES); feature('operations'); const body = await bodyOf(req); allowFields(body, ['status', 'expected_status']); text(body.status,'status',20,true); text(body.expected_status,'expected_status',20,true); const item=check(await backend.rpc('mobile_api_action',{_actor:user.id,_restaurant:restaurantId,_action:'order-item-status',_id:requireUuid(id),_data:body})) as Record<string,unknown>; return response(role==='kitchen'?kitchenOrderItem(item):item); }
    if (resourceName === 'waiter-calls') {
      roles(SERVICE_ROLES); feature('operations');
      if (req.method === 'GET') { let q = backend.from('waiter_calls').select('*,restaurant_tables!inner(label,branch_id)', { count: 'exact' }).eq('restaurant_id', restaurantId); if (context.branch_ids.length) q = q.in('restaurant_tables.branch_id', context.branch_ids); const status = url.searchParams.get('status'); if (status) q = q.eq('status', status); return await paged(q.order('created_at')); }
      if (req.method === 'POST' && id && actionName === 'resolve') return await action('waiter-call-resolve', {}, requireUuid(id));
    }
    if (resourceName === 'subscription' && req.method === 'GET') { roles(ADMIN_ROLES); return response({ subscription: context.subscription, features: context.features, limits: context.limits, is_active: context.is_active }); }
    if (['packages', 'addon-catalog', 'themes', 'payment-methods'].includes(resourceName) && req.method === 'GET') {
      roles(ADMIN_ROLES); const table = resourceName === 'packages' ? 'subscription_plans' : resourceName === 'addon-catalog' ? 'platform_addons' : resourceName === 'themes' ? 'platform_themes' : 'mobile_payment_settings'; let q = backend.from(table).select('*'); if (resourceName === 'payment-methods') q = q.eq('is_enabled', true); else q = q.eq('is_active', true); if (['packages', 'addon-catalog'].includes(resourceName)) q = q.eq('is_public', true); return response(check(await q.order(resourceName === 'themes' ? 'name' : 'sort_order')));
    }
    if (['subscription-payments', 'addon-requests', 'active-addons'].includes(resourceName)) {
      roles(ADMIN_ROLES); if (req.method === 'GET') { const table = resourceName === 'subscription-payments' ? 'subscription_payments' : resourceName === 'addon-requests' ? 'addon_purchase_requests' : 'restaurant_addons'; let q = backend.from(table).select(resourceName === 'subscription-payments' ? 'id,restaurant_id,plan,billing_cycle,amount,currency,payment_method,status,created_at,reviewed_at,notes,reference_code,transaction_id,coupon_code,discount_amount' : resourceName === 'addon-requests' ? 'id,restaurant_id,addon_id,quantity,amount,currency,billing_type,status,payment_method,payment_reference,notes,created_at,reviewed_at' : '*', { count: 'exact' }).eq('restaurant_id', restaurantId); if (resourceName === 'active-addons') q = q.eq('status', 'active').or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`); return await paged(q.order('created_at', { ascending: false })); }
      if (req.method === 'POST' && resourceName !== 'active-addons') { const body = await bodyOf(req); const fields = resourceName === 'subscription-payments' ? ['plan', 'currency', 'payment_method', 'sender_number', 'transaction_id', 'reference_code', 'notes', 'coupon_code'] : ['addon_id', 'quantity', 'payment_method', 'payment_reference', 'sender_number', 'transaction_id', 'reference_code', 'notes', 'coupon_code']; allowFields(body, fields); if (resourceName === 'addon-requests') { requireUuid(body.addon_id, 'addon_id'); if(body.quantity!=null&&!Number.isInteger(body.quantity)) throw new ApiError(400,'INVALID_QUANTITY','quantity must be an integer.'); } if(resourceName==='subscription-payments'){ text(body.sender_number,'sender_number',100,true); text(body.transaction_id,'transaction_id',100,true); } return await action(resourceName === 'subscription-payments' ? 'subscription-payment' : 'addon-request', body); }
    }
    if (resourceName === 'inventory' && ['receive', 'adjust'].includes(id) && req.method === 'POST') {
      roles(ADMIN_ROLES); feature('accounting'); const body = await bodyOf(req); allowFields(body, id === 'receive' ? ['branch_id', 'supplier_id', 'supplier_name', 'reference', 'received_date', 'notes', 'lines'] : ['branch_id', 'reason', 'notes', 'reference', 'lines']); if (body.branch_id) branch(body.branch_id); if (body.supplier_id) requireUuid(body.supplier_id, 'supplier_id'); if (!Array.isArray(body.lines)) throw new ApiError(400, 'INVALID_LINES', 'Inventory lines are required.'); for (const line of body.lines) { const data = record(line); allowFields(data, id === 'receive' ? ['item_id', 'quantity', 'unit_cost', 'expiry_date', 'batch_code'] : ['item_id', 'quantity_after', 'unit_cost']); requireUuid(data.item_id, 'item_id'); for (const field of ['quantity', 'quantity_after', 'unit_cost']) if (field in data && (typeof data[field] !== 'number' || !Number.isFinite(data[field]) || Number(data[field]) < 0)) throw new ApiError(400, 'INVALID_QUANTITY', `${field} must be a non-negative number.`); } return await action(id === 'receive' ? 'inventory-receive' : 'inventory-adjust', body);
    }
    if (resourceName === 'customers' && id && actionName === 'loyalty' && req.method === 'POST') { roles(ADMIN_ROLES); feature('loyalty'); const body = await bodyOf(req); allowFields(body, ['points', 'description']); if (!Number.isInteger(body.points)) throw new ApiError(400, 'INVALID_POINTS', 'Points must be an integer.'); return await action('loyalty-adjust', body, requireUuid(id)); }
    if (resourceName === 'support') {
      if (req.method === 'GET' && !id) { let query = backend.from('support_conversations').select('*',{count:'exact'}).eq('restaurant_id',restaurantId); if(url.searchParams.get('scope')==='restaurant') roles(['owner','admin']); else query=query.eq('requester_user_id',user.id); return await paged(query.order('last_message_at',{ascending:false})); }
      if (req.method === 'POST' && !id) { const body = await bodyOf(req); allowFields(body, ['body', 'category']); return await action('support-start', body); }
      if (id && actionName === 'messages') {
        let conversationQuery=backend.from('support_conversations').select('id').eq('id',requireUuid(id)).eq('restaurant_id',restaurantId); if(!['owner','admin'].includes(role)) conversationQuery=conversationQuery.eq('requester_user_id',user.id); const conv=check(await conversationQuery.maybeSingle()); if (!conv) throw new ApiError(404, 'NOT_FOUND', 'Support conversation not found.');
        if (req.method === 'GET') return await paged(backend.from('support_messages').select('id,conversation_id,sender_kind,body,attachments,created_at', { count: 'exact' }).eq('conversation_id', id).eq('is_internal', false).order('created_at'));
        if (req.method === 'POST') { const body = await bodyOf(req); allowFields(body, ['body']); return await action('support-message', body, id); }
      }
      if (id && actionName === 'rating' && req.method === 'POST') { let conversationQuery=backend.from('support_conversations').select('id').eq('id',requireUuid(id)).eq('restaurant_id',restaurantId); if(!['owner','admin'].includes(role)) conversationQuery=conversationQuery.eq('requester_user_id',user.id); const conv=check(await conversationQuery.maybeSingle()); if (!conv) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.'); const body = await bodyOf(req); allowFields(body, ['rating','comment']); if (!['good','bad'].includes(String(body.rating))) throw new ApiError(400, 'INVALID_RATING', 'rating must be good or bad.'); check(await caller.rpc('support_rate_conversation', { _conversation_id: id, _rating: body.rating, _comment: text(body.comment,'comment',400) })); return response({ rated: true }); }
      if (id && actionName === 'typing' && req.method === 'GET') { let conversationQuery=backend.from('support_conversations').select('id').eq('id',requireUuid(id)).eq('restaurant_id',restaurantId); if(!['owner','admin'].includes(role)) conversationQuery=conversationQuery.eq('requester_user_id',user.id); const conv=check(await conversationQuery.maybeSingle()); if (!conv) throw new ApiError(404, 'NOT_FOUND', 'Conversation not found.'); return response(check(await caller.rpc('support_typing_status', { _conversation_id: id }))); }
    }
    if (resourceName === 'uploads' && req.method === 'POST') {
      roles(ADMIN_ROLES); let body: Record<string, unknown>; let uploadedFile: File | null = null;
      if (req.headers.get('content-type')?.includes('multipart/form-data')) {
        if (Number(req.headers.get('content-length')) > 6 * 1024 * 1024) throw new ApiError(413, 'BODY_TOO_LARGE', 'Images are limited to 5 MB.');
        const form = await req.formData(); const file = form.get('file'); if (!(file instanceof File) || file.size > 5 * 1024 * 1024) throw new ApiError(400, 'INVALID_UPLOAD', 'A file of at most 5 MB is required.'); uploadedFile = file; body = { kind: form.get('kind'), content_type: file.type };
      } else { body = await bodyOf(req); allowFields(body, ['kind', 'content_type', 'base64']); } const bucket = body.kind === 'menu' ? 'menu-images' : body.kind === 'website' ? 'website-images' : body.kind === 'floor-plan' ? 'floor-plans' : null; if (!bucket) throw new ApiError(400, 'INVALID_UPLOAD', 'kind must be menu, website, or floor-plan.'); if (body.kind === 'floor-plan') feature('floorPlans');
      const contentType = text(body.content_type, 'content_type', 30, true)!; if (!['image/png', 'image/jpeg', 'image/webp'].includes(contentType)) throw new ApiError(400, 'INVALID_UPLOAD', 'Only PNG, JPEG, and WebP images are accepted.');
      let bytes: Uint8Array; try { bytes = uploadedFile ? new Uint8Array(await uploadedFile.arrayBuffer()) : Uint8Array.from(atob(text(body.base64, 'base64', 60000, true)!), c => c.charCodeAt(0)); } catch { throw new ApiError(400, 'INVALID_UPLOAD', 'Invalid base64 image.'); }
      const valid = contentType === 'image/png' ? bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 : contentType === 'image/jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'; if (!valid) throw new ApiError(400, 'INVALID_UPLOAD', 'Image contents do not match the file type.');
      const path = `${restaurantId}/mobile/${crypto.randomUUID()}.${contentType.split('/')[1]}`; const { error } = await backend.storage.from(bucket).upload(path, bytes, { contentType, upsert: false }); if (error) throw new ApiError(500, 'UPLOAD_FAILED', 'Could not upload image.'); return response({ bucket, path, url: backend.storage.from(bucket).getPublicUrl(path).data.publicUrl }, 201);
    }
    const config = RESOURCES[resourceName];
    if (config) {
      roles(req.method === 'GET' ? config.read : config.write); feature(config.feature);
      if (req.method === 'GET') { let q = scope(backend.from(config.table).select(config.select ?? '*', { count: 'exact' }), !!config.branch); if (resourceName === 'branches' && context.branch_ids.length) q = q.in('id', context.branch_ids); const search = url.searchParams.get('search'); const searchField = config.fields.includes('name') ? 'name' : resourceName === 'tables' ? 'label' : resourceName === 'reservations' ? 'guest_name' : resourceName === 'customers' ? 'display_name' : null; if (search && searchField) q = q.ilike(searchField, `%${search.slice(0,100)}%`);
        for (const field of [...config.fields, ...(config.filters ?? [])]) { if (!url.searchParams.has(field) || field === 'branch_id') continue; const value = url.searchParams.get(field)!; if (field.endsWith('_id')) requireUuid(value, field); q = q.eq(field, value); }
        const dateFields: Record<string,string>={'expenses':'expense_date','inventory-transactions':'transaction_date','inventory-adjustments':'created_at','stock-receipts':'received_date','shifts':'shift_date','tips':'tip_date','payroll':'period_start','qr-scans':'scanned_at','cta-clicks':'created_at','reservations':'reservation_date'};
        if(dateFields[resourceName]) for(const bound of ['from','to']) { const value=url.searchParams.get(bound); if(value){if(!Number.isFinite(Date.parse(value))) throw new ApiError(400,'INVALID_DATE',`Invalid ${bound} date.`);q=bound==='from'?q.gte(dateFields[resourceName],value):q.lt(dateFields[resourceName],value);} }
        const parents: Record<string, [string, string]> = { 'menu-addons': ['menu_items!inner(branch_id)', 'menu_items.branch_id'], 'menu-addon-options': ['menu_item_addons!inner(menu_items!inner(branch_id))', 'menu_item_addons.menu_items.branch_id'], 'menu-images': ['menu_items!inner(branch_id)', 'menu_items.branch_id'], 'menu-tags': ['menu_items!inner(branch_id)', 'menu_items.branch_id'], 'stock-receipt-lines': ['stock_receipts!inner(branch_id)', 'stock_receipts.branch_id'], 'qr-short-links': ['restaurant_tables!inner(branch_id)','restaurant_tables.branch_id'], 'qr-scans': ['qr_short_links!inner(restaurant_tables!inner(branch_id))','qr_short_links.restaurant_tables.branch_id'] };
        if (parents[resourceName] && (context.branch_ids.length || url.searchParams.has('branch_id'))) { q=q.select(`*,${parents[resourceName][0]}`,{count:'exact'}); if(context.branch_ids.length) q=q.in(parents[resourceName][1],context.branch_ids); if(url.searchParams.has('branch_id')) q=q.eq(parents[resourceName][1],branch(url.searchParams.get('branch_id'))); }
        if (id) return response(check(await q.eq('id', requireUuid(id)).single())); if (config.singleton) return response(check(await q.maybeSingle())); return await paged(q.order('id')); }
      if (config.readOnly) throw new ApiError(405, 'READ_ONLY', 'This resource is read-only. Use its documented action endpoints.');
      if (req.method === 'POST' && !id) { const data = validateResourceBody(config, await bodyOf(req), true); if (data.branch_id) branch(data.branch_id); return await mutate(config.table, 'POST', data); }
      if (req.method === 'PATCH') { const data = validateResourceBody(config, await bodyOf(req), false); if (data.branch_id) branch(data.branch_id); let target = id; if (config.singleton && !target) { const row = check(await backend.from(config.table).select('id').eq('restaurant_id', restaurantId).single()) as { id: string }; target = row.id; } return await mutate(config.table, 'PATCH', data, requireUuid(target)); }
      if (req.method === 'DELETE' && id && !config.singleton) { requireUuid(id); if (resourceName === 'custom-domains') { const own = check(await backend.from(config.table).select('id').eq('restaurant_id', restaurantId).eq('id', id).maybeSingle()); if (!own) throw new ApiError(404, 'NOT_FOUND', 'Domain not found.'); const { data, error } = await caller.functions.invoke('tenant-verify-custom-domain', { body: { action: 'remove', domainId: id } }); if (error) throw new ApiError(400, 'DOMAIN_ERROR', 'Could not remove custom domain.'); return response(data); } return await mutate(config.table, 'DELETE', {}, id); }
      if (resourceName === 'custom-domains' && id && actionName === 'verify' && req.method === 'POST') { const own = check(await backend.from(config.table).select('id').eq('restaurant_id', restaurantId).eq('id', requireUuid(id)).maybeSingle()); if (!own) throw new ApiError(404, 'NOT_FOUND', 'Domain not found.'); const { data, error } = await caller.functions.invoke('tenant-verify-custom-domain', { body: { action: 'verify', domainId: id } }); if (error) throw new ApiError(400, 'DOMAIN_ERROR', 'Could not verify domain.'); return response(data); }
    }
    throw new ApiError(404, 'NOT_FOUND', 'Endpoint not found.');
  } catch (error) {
    const failure = error instanceof ApiError ? error : new ApiError(500, 'INTERNAL_ERROR', 'Could not complete the request.');
    return new Response(JSON.stringify({ error: { code: failure.code, message: failure.message, request_id: requestId } }), { status: failure.status, headers: cors });
  }
});
