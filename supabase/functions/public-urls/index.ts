// Backend-provided URL generator for QR codes, public menus, and table deep-links.
//
// Returns canonical URLs for a given restaurant so the frontend doesn't have to
// rely on `window.location.origin` (which differs between preview / staging /
// production / custom domains and would silently produce wrong QR links).
//
// Resolution order for the platform origin:
//   1. PUBLIC_BASE_URL env (override, e.g. "https://serveos.net")
//   2. The request's own forwarded origin (Origin / Referer header)
//   3. Hardcoded production fallback
//
// Per-restaurant URLs prefer a verified custom domain over the platform origin.
//
// Public endpoint: GET /functions/v1/public-urls?restaurant_id=...&table_ids=a,b,c
//                  GET /functions/v1/public-urls?slug=demo
//
// Response shape:
// {
//   origin: "https://serveos.net",
//   restaurant: {
//     id, slug, name, custom_domain, custom_domain_verified,
//     site_origin: "https://bellacucina.com" | "https://serveos.net",
//     menu_url: "https://.../r/demo/menu" | "https://bellacucina.com/menu",
//     menu_slug_path: "/menu",
//     order_history_url: ".../orders",
//   },
//   tables: [
//     { id, label, capacity, status, url: "https://.../table/<id>" }
//   ],
//   qr: {
//     menu: "https://api.qrserver.com/...",
//     tables: { "<id>": "https://api.qrserver.com/..." }
//   }
// }
//
// CORS: open to all origins (this is public, read-only data).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const PRODUCTION_FALLBACK_ORIGIN = 'https://serveos.net';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  let v = value.trim();
  if (!v) return null;
  // If it's only a host, prepend https://
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const u = new URL(v);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function resolvePlatformOrigin(req: Request): string {
  // 1. Explicit override
  const env = normalizeOrigin(Deno.env.get('PUBLIC_BASE_URL') ?? null);
  if (env) return env;

  // 2. Request-derived origin (only trust if it looks like a real public host,
  //    not a sandbox / localhost — those should fall through to the fallback)
  const headerOrigin =
    normalizeOrigin(req.headers.get('origin')) ??
    normalizeOrigin(req.headers.get('referer'));
  if (headerOrigin) {
    try {
      const u = new URL(headerOrigin);
      const host = u.hostname;
      const isLocal =
        host === 'localhost' ||
        host.endsWith('.local') ||
        host.startsWith('127.') ||
        host.startsWith('192.168.') ||
        host.endsWith('.lovableproject.com') ||
        host.includes('id-preview--');
      if (!isLocal) return headerOrigin;
    } catch {
      // ignore
    }
  }

  // 3. Hardcoded production fallback
  return PRODUCTION_FALLBACK_ORIGIN;
}

function joinUrl(origin: string, path: string): string {
  const o = origin.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

function qrSrc(url: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=0&data=${encodeURIComponent(url)}`;
}

interface RestaurantRow {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  custom_domain_verified: boolean;
  page_slugs: Record<string, unknown> | null;
}

interface TableRow {
  id: string;
  label: string;
  capacity: number;
  status: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(req.url);
    const restaurantId = url.searchParams.get('restaurant_id');
    const slug = url.searchParams.get('slug');
    const tableIdsParam = url.searchParams.get('table_ids');
    const includeAllTables =
      url.searchParams.get('include_tables') === 'true' ||
      url.searchParams.get('include_tables') === '1';
    const qrSizeRaw = parseInt(url.searchParams.get('qr_size') ?? '220', 10);
    const qrSize = Number.isFinite(qrSizeRaw)
      ? Math.min(Math.max(qrSizeRaw, 64), 1024)
      : 220;

    const platformOrigin = resolvePlatformOrigin(req);

    if (!restaurantId && !slug) {
      // Bare-metadata response — useful for the frontend to bootstrap a
      // canonical origin without targeting a restaurant.
      return new Response(
        JSON.stringify({ origin: platformOrigin }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=60',
          },
        },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const restaurantQuery = supabase
      .from('restaurants')
      .select(
        'id, slug, name, custom_domain, custom_domain_verified, page_slugs',
      )
      .limit(1);

    const { data: restaurantRows, error: rErr } = restaurantId
      ? await restaurantQuery.eq('id', restaurantId)
      : await restaurantQuery.eq('slug', slug!);

    if (rErr) throw rErr;
    const restaurant = (restaurantRows?.[0] ?? null) as RestaurantRow | null;

    if (!restaurant) {
      return new Response(
        JSON.stringify({
          error: 'Restaurant not found',
          origin: platformOrigin,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Build per-tenant origin: prefer a verified custom domain.
    const customDomain = normalizeOrigin(restaurant.custom_domain);
    const useCustomDomain =
      restaurant.custom_domain_verified && !!customDomain;
    const tenantOrigin = useCustomDomain ? customDomain! : platformOrigin;

    // Pick the right path scheme:
    //  - Verified custom domain -> /menu, /table/<id>
    //  - Platform host -> /r/<slug>/menu, /table/<id> (table route is global)
    const pageSlugs = restaurant.page_slugs ?? {};
    const menuSlug =
      typeof (pageSlugs as Record<string, unknown>).menu === 'string' &&
      ((pageSlugs as Record<string, string>).menu as string).trim()
        ? ((pageSlugs as Record<string, string>).menu as string)
            .trim()
            .toLowerCase()
        : 'menu';

    const menuPath = useCustomDomain
      ? `/${menuSlug}`
      : `/r/${restaurant.slug}/${menuSlug}`;
    const orderHistoryPath = useCustomDomain
      ? '/orders'
      : `/r/${restaurant.slug}/orders`;

    const menuUrl = joinUrl(tenantOrigin, menuPath);
    const orderHistoryUrl = joinUrl(tenantOrigin, orderHistoryPath);

    // Resolve tables (optional)
    let tables: Array<TableRow & { url: string }> = [];
    const qrTables: Record<string, string> = {};

    const wantsTables = includeAllTables || !!tableIdsParam;
    if (wantsTables) {
      let tableQuery = supabase
        .from('restaurant_tables')
        .select('id, label, capacity, status')
        .eq('restaurant_id', restaurant.id);

      if (tableIdsParam) {
        const ids = tableIdsParam
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        if (ids.length > 0) tableQuery = tableQuery.in('id', ids);
      }

      const { data: tableRows, error: tErr } = await tableQuery.order('label', {
        ascending: true,
      });
      if (tErr) throw tErr;

      const sorted = ((tableRows ?? []) as TableRow[]).sort((a, b) => {
        const an = parseInt(a.label.replace(/\D/g, ''), 10) || 0;
        const bn = parseInt(b.label.replace(/\D/g, ''), 10) || 0;
        return an - bn;
      });

      tables = sorted.map((t) => {
        const tableUrl = joinUrl(tenantOrigin, `/table/${t.id}`);
        qrTables[t.id] = qrSrc(tableUrl, qrSize);
        return { ...t, url: tableUrl };
      });
    }

    const body = {
      origin: platformOrigin,
      restaurant: {
        id: restaurant.id,
        slug: restaurant.slug,
        name: restaurant.name,
        custom_domain: restaurant.custom_domain,
        custom_domain_verified: restaurant.custom_domain_verified,
        site_origin: tenantOrigin,
        menu_url: menuUrl,
        menu_slug_path: menuPath,
        order_history_url: orderHistoryUrl,
      },
      tables,
      qr: {
        menu: qrSrc(menuUrl, qrSize),
        tables: qrTables,
      },
    };

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        // Short cache: domains/slugs change rarely, tables more often.
        'Cache-Control': 'public, max-age=30',
      },
    });
  } catch (err) {
    console.error('[public-urls] error:', err);
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
