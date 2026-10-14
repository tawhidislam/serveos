// Tenant onboarding provisioning.
// Auth required (owner/admin/manager). Persists details + creates sample menu, tables, QR settings.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

interface Body {
  restaurantId: string;
  details: {
    cuisineType?: string;
    phone?: string;
    address?: string;
    tagline?: string;
    currency?: string;
    taxPercentage?: number;
    primaryColor?: string;
    accentColor?: string;
  };
  menu: {
    template: 'cafe' | 'fastfood' | 'finedining' | 'bakery' | 'bar' | 'custom';
    customItems?: Array<{ category: string; name: string; price: number; description?: string }>;
  };
  tables: {
    count: number;
    defaultCapacity?: number;
    prefix?: string;
  };
  qr: {
    template?: string;
    enabled?: boolean;
    primaryColor?: string;
    backgroundColor?: string;
  };
}

const MENU_TEMPLATES: Record<string, Array<{ category: string; items: Array<{ name: string; price: number; description?: string }> }>> = {
  cafe: [
    { category: 'Coffee', items: [
      { name: 'Espresso', price: 3.5, description: 'Single shot of rich espresso' },
      { name: 'Cappuccino', price: 4.5, description: 'Espresso with steamed milk foam' },
      { name: 'Latte', price: 4.75, description: 'Smooth espresso with steamed milk' },
      { name: 'Americano', price: 3.75 },
    ]},
    { category: 'Pastries', items: [
      { name: 'Croissant', price: 3.25 },
      { name: 'Blueberry Muffin', price: 3.5 },
      { name: 'Cinnamon Roll', price: 4.0 },
    ]},
    { category: 'Sandwiches', items: [
      { name: 'Avocado Toast', price: 8.5 },
      { name: 'Turkey Club', price: 10.5 },
    ]},
  ],
  fastfood: [
    { category: 'Burgers', items: [
      { name: 'Classic Cheeseburger', price: 8.99 },
      { name: 'Double Bacon Burger', price: 11.99 },
      { name: 'Veggie Burger', price: 8.5 },
    ]},
    { category: 'Sides', items: [
      { name: 'French Fries', price: 3.5 },
      { name: 'Onion Rings', price: 4.0 },
      { name: 'Chicken Nuggets (6pc)', price: 5.5 },
    ]},
    { category: 'Drinks', items: [
      { name: 'Soft Drink', price: 2.5 },
      { name: 'Milkshake', price: 4.99 },
    ]},
  ],
  finedining: [
    { category: 'Starters', items: [
      { name: 'Seared Scallops', price: 18.0 },
      { name: 'Beef Carpaccio', price: 16.5 },
      { name: 'Burrata Salad', price: 14.0 },
    ]},
    { category: 'Mains', items: [
      { name: 'Filet Mignon', price: 42.0 },
      { name: 'Pan-Seared Salmon', price: 32.0 },
      { name: 'Wild Mushroom Risotto', price: 26.0 },
    ]},
    { category: 'Desserts', items: [
      { name: 'Crème Brûlée', price: 12.0 },
      { name: 'Chocolate Fondant', price: 13.0 },
    ]},
  ],
  bakery: [
    { category: 'Breads', items: [
      { name: 'Sourdough Loaf', price: 6.5 },
      { name: 'Baguette', price: 4.0 },
      { name: 'Whole Wheat', price: 5.5 },
    ]},
    { category: 'Cakes', items: [
      { name: 'Chocolate Cake (slice)', price: 5.5 },
      { name: 'Cheesecake (slice)', price: 6.0 },
    ]},
    { category: 'Cookies', items: [
      { name: 'Chocolate Chip', price: 2.5 },
      { name: 'Oatmeal Raisin', price: 2.5 },
    ]},
  ],
  bar: [
    { category: 'Cocktails', items: [
      { name: 'Old Fashioned', price: 12.0 },
      { name: 'Margarita', price: 11.0 },
      { name: 'Mojito', price: 10.0 },
    ]},
    { category: 'Beer', items: [
      { name: 'Draft Lager', price: 6.0 },
      { name: 'IPA', price: 7.0 },
    ]},
    { category: 'Bites', items: [
      { name: 'Loaded Nachos', price: 9.5 },
      { name: 'Buffalo Wings', price: 10.5 },
    ]},
  ],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader.startsWith('Bearer ')) return json(401, { error: 'Missing auth' });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes.user) return json(401, { error: 'Invalid auth' });
    const userId = userRes.user.id;

    const body = await req.json().catch(() => null) as Body | null;
    if (!body?.restaurantId || !body.details || !body.menu || !body.tables || !body.qr) {
      return json(400, { error: 'Restaurant, details, menu, tables and QR settings are required' });
    }
    if (!Number.isInteger(body.tables.count) || !Number.isInteger(body.tables.defaultCapacity ?? 4)) {
      return json(400, { error: 'Table count and capacity must be whole numbers' });
    }
    if (body.menu.template !== 'custom' && !MENU_TEMPLATES[body.menu.template]) {
      return json(400, { error: 'Invalid menu template' });
    }
    if (body.menu.template === 'custom' && (!Array.isArray(body.menu.customItems) || body.menu.customItems.some(item =>
      !item || typeof item.category !== 'string' || !item.category.trim() || typeof item.name !== 'string' || !item.name.trim() || !Number.isFinite(item.price) || item.price < 0))) {
      return json(400, { error: 'Custom menu items need a category, name and nonnegative price' });
    }
    const groups = body.menu.template === 'custom' ? (() => {
      const map = new Map<string, Array<{ name: string; price: number; description?: string }>>();
      for (const item of body.menu.customItems ?? []) {
        const list = map.get(item.category) ?? [];
        list.push({ name: item.name, price: item.price, description: item.description });
        map.set(item.category, list);
      }
      return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
    })() : MENU_TEMPLATES[body.menu.template];

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data, error } = await admin.rpc('provision_restaurant_onboarding', {
      p_restaurant_id: body.restaurantId, p_actor_id: userId, p_details: body.details,
      p_groups: groups, p_tables: body.tables, p_qr: body.qr,
    });
    if (error) {
      const status = error.code === '42501' ? 403 : error.code === 'P0002' ? 404
        : ['22023', '22P02', '23502', '23514'].includes(error.code) ? 400 : 500;
      return json(status, { error: error.message });
    }
    return json(200, data);

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json(500, { error: message });
  }
});
