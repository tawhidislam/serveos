// Web staff creation uses the same tenant/role checks as the mobile API.
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type', 'Content-Type': 'application/json' };
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { headers });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
  const authorization = req.headers.get('Authorization');
  if (!authorization) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
  try {
    const body = await req.json();
    if (typeof body.restaurant_id !== 'string' || !/^[a-f0-9-]{36}$/i.test(body.restaurant_id)) return new Response(JSON.stringify({ error: 'restaurant_id is required' }), { status: 400, headers });
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/mobile-api/v1/restaurants/${body.restaurant_id}/staff`, { method: 'POST', headers: { Authorization: authorization, apikey: Deno.env.get('SUPABASE_ANON_KEY')!, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: body.email, password: body.password, display_name: body.display_name, role: body.role || 'waiter' }) });
    const result = await response.json();
    if (!response.ok) return new Response(JSON.stringify({ error: result.error?.message || 'Staff creation failed' }), { status: response.status, headers });
    return new Response(JSON.stringify({ user: { id: result.data.id, email: result.data.email } }), { headers });
  } catch { return new Response(JSON.stringify({ error: 'Could not create staff' }), { status: 500, headers }); }
});
