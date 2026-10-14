// Owner-scoped, per-tenant sitemap.xml generator.
//
// Security model
// ----------------
// • Caller MUST send a valid Supabase JWT (Authorization: Bearer <token>).
// • Caller MUST pass ?restaurant_id=<uuid>.
// • Data is fetched through SECURITY DEFINER RPCs that internally check
//   `restaurants.owner_id = auth.uid()`. If the JWT user does not own the
//   requested restaurant, the RPCs return zero rows and we respond 403.
//
// This means a sitemap can ONLY ever expose URLs for the restaurant whose
// owner is currently signed in. No cross-tenant enumeration is possible,
// even if someone discovers another tenant's UUID.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const PLATFORM_ORIGIN = 'https://serveos.net';

const TENANT_STATIC: Array<{ key: string; def: string; changefreq: string; priority: number }> = [
  { key: 'menu',    def: 'menu',    changefreq: 'daily',   priority: 0.95 },
  { key: 'about',   def: 'about',   changefreq: 'monthly', priority: 0.5 },
  { key: 'gallery', def: 'gallery', changefreq: 'monthly', priority: 0.5 },
  { key: 'contact', def: 'contact', changefreq: 'monthly', priority: 0.6 },
];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function joinUrl(origin: string, path: string): string {
  const o = origin.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

interface HreflangAlternate { hreflang: string; href: string }
interface UrlEntry {
  loc: string;
  lastmod?: string | null;
  changefreq?: string;
  priority?: number;
  alternates?: HreflangAlternate[];
}

function renderXml(urls: UrlEntry[]): string {
  const body = urls
    .map((u) => {
      const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
      if (u.lastmod) {
        const d = new Date(u.lastmod);
        if (!isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
      }
      if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
      if (typeof u.priority === 'number') parts.push(`    <priority>${u.priority.toFixed(2)}</priority>`);
      for (const alt of u.alternates ?? []) {
        parts.push(
          `    <xhtml:link rel="alternate" hreflang="${escapeXml(alt.hreflang)}" href="${escapeXml(alt.href)}" />`,
        );
      }
      return `  <url>\n${parts.join('\n')}\n  </url>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET')     return jsonError(405, 'Method not allowed');

  // 1. Require a valid Supabase JWT
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonError(401, 'Missing or invalid Authorization header');
  }

  // 2. Require restaurant_id query param
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get('restaurant_id');
  if (!restaurantId || !UUID_RE.test(restaurantId)) {
    return jsonError(400, 'Missing or invalid restaurant_id query parameter');
  }

  try {
    // Use anon key + the caller's JWT so PostgREST sees auth.uid() = caller.
    // The owner check happens inside the SECURITY DEFINER RPCs.
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    // Verify the JWT explicitly so we can return 401 vs 403 cleanly.
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userErr } = await supabase.auth.getUser(token);
    if (userErr || !userData?.user) {
      return jsonError(401, 'Unauthorized');
    }

    const [{ data: restaurants, error: rErr }, { data: items, error: mErr }] = await Promise.all([
      supabase.rpc('get_owner_sitemap_restaurant', { _restaurant_id: restaurantId }),
      supabase.rpc('get_owner_sitemap_menu_items',  { _restaurant_id: restaurantId }),
    ]);

    if (rErr) throw rErr;
    if (mErr) throw mErr;

    const rest = (restaurants ?? [])[0];
    if (!rest) {
      // Either the restaurant doesn't exist, or the caller is not its owner.
      // Don't leak the difference.
      return jsonError(403, 'Not authorized for this restaurant');
    }

    const slug = rest.slug as string | null;
    const customDomain = rest.custom_domain as string | null;
    const verified = !!rest.custom_domain_verified;
    const pageSlugs = (rest.page_slugs as Record<string, unknown>) ?? {};
    const tenantOrigin = verified && customDomain ? `https://${customDomain}` : null;

    const DEFAULT_LANG = 'en';
    const buildAlts = (canonical: string, legacy?: string | null): HreflangAlternate[] => {
      const out: HreflangAlternate[] = [
        { hreflang: DEFAULT_LANG, href: canonical },
        { hreflang: 'x-default', href: canonical },
      ];
      if (legacy && legacy !== canonical) {
        out.push({ hreflang: `${DEFAULT_LANG}-legacy`, href: legacy });
      }
      return out;
    };

    const staticPages: Array<{ path: string; canonicalPath: string; changefreq: string; priority: number }> = [
      { path: '/', canonicalPath: '/', changefreq: 'weekly', priority: 0.9 },
    ];
    for (const sp of TENANT_STATIC) {
      const raw = pageSlugs[sp.key];
      const custom = typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : null;
      const canonical = `/${custom ?? sp.def}`;
      staticPages.push({
        path: canonical,
        canonicalPath: canonical,
        changefreq: sp.changefreq,
        priority: sp.priority,
      });
      if (custom && custom !== sp.def) {
        staticPages.push({
          path: `/${sp.def}`,
          canonicalPath: canonical,
          changefreq: sp.changefreq,
          priority: Math.max(0.1, sp.priority - 0.2),
        });
      }
    }

    const urls: UrlEntry[] = [];

    if (tenantOrigin) {
      for (const r of staticPages) {
        const canonical = joinUrl(tenantOrigin, r.canonicalPath);
        const loc = joinUrl(tenantOrigin, r.path);
        const legacy = slug
          ? joinUrl(PLATFORM_ORIGIN, r.path === '/' ? `/r/${slug}` : `/r/${slug}${r.path}`)
          : null;
        urls.push({
          loc,
          lastmod: r.path === '/' ? rest.updated_at : undefined,
          changefreq: r.changefreq,
          priority: r.priority,
          alternates: buildAlts(canonical, legacy),
        });
      }
      for (const it of items ?? []) {
        const path = it.custom_slug ? `/menu/${it.custom_slug}` : `/menu/${it.id}`;
        const canonical = joinUrl(tenantOrigin, path);
        const legacy = joinUrl(PLATFORM_ORIGIN, `/menu/${it.id}`);
        urls.push({
          loc: canonical,
          lastmod: it.updated_at,
          changefreq: 'weekly',
          priority: 0.7,
          alternates: buildAlts(canonical, legacy),
        });
      }
    }

    if (slug) {
      for (const r of staticPages) {
        if (r.path !== r.canonicalPath) continue;
        const loc = joinUrl(PLATFORM_ORIGIN, r.path === '/' ? `/r/${slug}` : `/r/${slug}${r.path}`);
        const canonical = tenantOrigin ? joinUrl(tenantOrigin, r.canonicalPath) : loc;
        urls.push({
          loc,
          lastmod: r.path === '/' ? rest.updated_at : undefined,
          changefreq: r.changefreq,
          priority: tenantOrigin ? Math.max(0.1, r.priority - 0.4) : r.priority - 0.1,
          alternates: buildAlts(canonical, loc),
        });
      }
      if (!tenantOrigin) {
        for (const it of items ?? []) {
          const path = it.custom_slug ? `/menu/${it.custom_slug}` : `/menu/${it.id}`;
          const loc = joinUrl(PLATFORM_ORIGIN, path);
          urls.push({
            loc,
            lastmod: it.updated_at,
            changefreq: 'weekly',
            priority: 0.6,
            alternates: buildAlts(loc),
          });
        }
      }
    }

    const xml = renderXml(urls);

    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
        // Per-owner data: never share across users via shared caches.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    console.error('sitemap generation failed', err);
    return jsonError(500, 'Sitemap generation failed');
  }
});
