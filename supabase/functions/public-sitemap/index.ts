// Public, crawler-accessible sitemap for tenant pages on the platform host.
//
// • GET /public-sitemap            → sitemap *index* listing every active restaurant
// • GET /public-sitemap?slug=...   → urlset for a single tenant (`/r/:slug/...`)
//
// No auth required. Reads only public, RLS-allowed data:
//   - restaurants  (anon SELECT where is_active = true)
//   - menu_items   (anon SELECT where is_available = true)
//
// Designed to be referenced from /robots.txt so search engines can discover
// every tenant page hosted under /r/:slug.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

const PLATFORM_ORIGIN = Deno.env.get('PLATFORM_ORIGIN') || 'https://serveos.net';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

const TENANT_STATIC: Array<{ key: string; def: string; changefreq: string; priority: number }> = [
  { key: 'menu',    def: 'menu',    changefreq: 'daily',   priority: 0.95 },
  { key: 'about',   def: 'about',   changefreq: 'monthly', priority: 0.5 },
  { key: 'gallery', def: 'gallery', changefreq: 'monthly', priority: 0.5 },
  { key: 'contact', def: 'contact', changefreq: 'monthly', priority: 0.6 },
];

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function joinUrl(origin: string, path: string): string {
  const o = origin.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${o}${p}`;
}

interface UrlEntry { loc: string; lastmod?: string | null; changefreq?: string; priority?: number }

function renderUrlset(urls: UrlEntry[]): string {
  const body = urls.map((u) => {
    const parts = [`    <loc>${escapeXml(u.loc)}</loc>`];
    if (u.lastmod) {
      const d = new Date(u.lastmod);
      if (!isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
    }
    if (u.changefreq) parts.push(`    <changefreq>${u.changefreq}</changefreq>`);
    if (typeof u.priority === 'number') parts.push(`    <priority>${u.priority.toFixed(2)}</priority>`);
    return `  <url>\n${parts.join('\n')}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function renderIndex(entries: Array<{ loc: string; lastmod?: string | null }>): string {
  const body = entries.map((e) => {
    const parts = [`    <loc>${escapeXml(e.loc)}</loc>`];
    if (e.lastmod) {
      const d = new Date(e.lastmod);
      if (!isNaN(d.getTime())) parts.push(`    <lastmod>${d.toISOString().slice(0, 10)}</lastmod>`);
    }
    return `  <sitemap>\n${parts.join('\n')}\n  </sitemap>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</sitemapindex>\n`;
}

function xmlResponse(xml: string) {
  return new Response(xml, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=3600',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'GET') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const slug = url.searchParams.get('slug')?.trim().toLowerCase();
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });

  try {
    // ---------- Sitemap INDEX ----------
    if (!slug) {
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('slug, updated_at')
        .eq('is_active', true)
        .not('slug', 'is', null)
        .order('updated_at', { ascending: false })
        .limit(5000);
      if (error) throw error;

      const fnUrl = `${SUPABASE_URL}/functions/v1/public-sitemap`;
      const entries = (restaurants ?? []).map((r: any) => ({
        loc: `${fnUrl}?slug=${encodeURIComponent(r.slug)}`,
        lastmod: r.updated_at,
      }));
      return xmlResponse(renderIndex(entries));
    }

    // ---------- Per-tenant URLSET ----------
    const { data: rest, error: rErr } = await supabase
      .from('restaurants')
      .select('id, slug, updated_at, page_slugs')
      .eq('slug', slug)
      .eq('is_active', true)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!rest) {
      return new Response('Not found', { status: 404, headers: corsHeaders });
    }

    const pageSlugs = (rest.page_slugs as Record<string, unknown>) ?? {};
    const urls: UrlEntry[] = [];

    // Home
    urls.push({
      loc: joinUrl(PLATFORM_ORIGIN, `/r/${rest.slug}`),
      lastmod: rest.updated_at,
      changefreq: 'weekly',
      priority: 0.9,
    });

    // Static tenant pages (with custom slug overrides)
    for (const sp of TENANT_STATIC) {
      const raw = pageSlugs[sp.key];
      const custom = typeof raw === 'string' && raw.trim() ? raw.trim().toLowerCase() : null;
      const path = `/r/${rest.slug}/${custom ?? sp.def}`;
      urls.push({ loc: joinUrl(PLATFORM_ORIGIN, path), changefreq: sp.changefreq, priority: sp.priority });
    }

    // Menu items
    const { data: items, error: mErr } = await supabase
      .from('menu_items')
      .select('id, custom_slug, updated_at')
      .eq('restaurant_id', rest.id)
      .eq('is_available', true)
      .order('updated_at', { ascending: false })
      .limit(10000);
    if (mErr) throw mErr;

    for (const it of items ?? []) {
      const seg = (it as any).custom_slug || (it as any).id;
      urls.push({
        loc: joinUrl(PLATFORM_ORIGIN, `/r/${rest.slug}/menu/${seg}`),
        lastmod: (it as any).updated_at,
        changefreq: 'weekly',
        priority: 0.7,
      });
    }

    return xmlResponse(renderUrlset(urls));
  } catch (err) {
    console.error('public-sitemap failed', err);
    return new Response('Sitemap generation failed', { status: 500, headers: corsHeaders });
  }
});
