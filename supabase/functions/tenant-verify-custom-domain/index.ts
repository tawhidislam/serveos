// Custom domain lifecycle for restaurants: verify, remove, and (platform admin)
// set verified. Every change goes through here so Cloudflare for SaaS stays in
// sync with `restaurant_custom_domains`.
//
// Actions (POST body):
//   { action: 'verify', domainId }                 tenant member or platform admin
//   { action: 'remove', domainId }                 tenant member or platform admin
//   { action: 'set_verified', domainId, verified } platform admin only
//
// Verification (action 'verify'):
//   1) TXT  _serveos-verify.<domain>  contains the row's `verification_token`
//      (legacy `_lovable-verify` is still accepted). Proves ownership.
//   2) With Cloudflare configured: the domain is registered as a Cloudflare
//      custom hostname, and it's verified once Cloudflare reports both the
//      hostname and its SSL certificate as active — i.e. traffic really flows.
//      Without Cloudflare (local dev): a DNS check that the domain CNAMEs to
//      CUSTOM_DOMAIN_CNAME_TARGET (or has an A record in VERIFY_TARGET_IPS).
//
// Secrets:
//   CLOUDFLARE_API_TOKEN        token with "SSL and Certificates: Edit" on the zone
//   CLOUDFLARE_ZONE_ID          zone of the platform root domain
//   CUSTOM_DOMAIN_CNAME_TARGET  optional override; defaults to platform_settings.custom_domain_cname_target
//   VERIFY_TARGET_IPS           optional, comma-separated, for the non-Cloudflare DNS check

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

type Action = 'verify' | 'remove' | 'set_verified';

interface Body {
  action?: Action;
  domainId: string;
  verified?: boolean;
}

interface DomainRow {
  id: string;
  domain: string;
  verification_token: string;
  restaurant_id: string;
}

const TXT_PREFIXES = ['_serveos-verify', '_lovable-verify'];

const CF_TOKEN = Deno.env.get('CLOUDFLARE_API_TOKEN') ?? '';
const CF_ZONE = Deno.env.get('CLOUDFLARE_ZONE_ID') ?? '';
const CF_ENABLED = !!(CF_TOKEN && CF_ZONE);

const normHost = (h: string | null | undefined) => (h ?? '').trim().toLowerCase().replace(/\.$/, '');

/** The host restaurants CNAME to: secret override, else the platform setting. */
async function resolveCnameTarget(admin: SupabaseClient): Promise<string> {
  const fromEnv = normHost(Deno.env.get('CUSTOM_DOMAIN_CNAME_TARGET'));
  if (fromEnv) return fromEnv;
  const { data } = await admin
    .from('platform_settings')
    .select('custom_domain_cname_target')
    .limit(1)
    .maybeSingle();
  return normHost((data as { custom_domain_cname_target?: string } | null)?.custom_domain_cname_target);
}

const TARGET_IPS = (Deno.env.get('VERIFY_TARGET_IPS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

// ── DNS ─────────────────────────────────────────────────────────────────────

async function safeResolve(name: string, kind: 'A' | 'CNAME' | 'TXT'): Promise<string[]> {
  try {
    // deno-lint-ignore no-explicit-any
    const res: any = await (Deno as any).resolveDns(name, kind);
    if (kind === 'TXT') {
      // resolveDns returns string[][] for TXT
      return (res as string[][]).map((parts) => parts.join(''));
    }
    return res as string[];
  } catch {
    return [];
  }
}

async function verifyTxt(domain: string, token: string): Promise<{ ok: boolean; reason?: string }> {
  for (const prefix of TXT_PREFIXES) {
    const records = await safeResolve(`${prefix}.${domain}`, 'TXT');
    if (records.some((t) => t.trim() === token)) return { ok: true };
  }
  const name = `${TXT_PREFIXES[0]}.${domain}`;
  return { ok: false, reason: `TXT record at ${name} is missing or doesn't match the verification token` };
}

/** DNS-only routing check, used when Cloudflare isn't configured. */
async function verifyRoutingDns(domain: string, cnameTarget: string): Promise<{ ok: boolean; reason?: string }> {
  if (!cnameTarget && TARGET_IPS.length === 0) {
    return { ok: false, reason: 'Custom domains are not configured: set the CNAME target in Platform → Settings' };
  }
  const [aRecords, cnameRecords] = await Promise.all([
    safeResolve(domain, 'A'),
    safeResolve(domain, 'CNAME'),
  ]);
  if (aRecords.some((ip) => TARGET_IPS.includes(ip))) return { ok: true };
  if (cnameTarget && cnameRecords.some((c) => normHost(c) === cnameTarget)) {
    return { ok: true };
  }
  if (aRecords.length === 0 && cnameRecords.length === 0) {
    return { ok: false, reason: `No CNAME record found for ${domain}` };
  }
  return {
    ok: false,
    reason: `${domain} does not point to ${cnameTarget || 'this app'} (got CNAME=[${cnameRecords.join(',')}] A=[${aRecords.join(',')}])`,
  };
}

// ── Cloudflare for SaaS ─────────────────────────────────────────────────────

interface CfHostname {
  id: string;
  hostname: string;
  status: string;
  ssl?: { status?: string; validation_errors?: { message: string }[] };
  verification_errors?: string[];
}

async function cf<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${CF_ZONE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${CF_TOKEN}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  // deno-lint-ignore no-explicit-any
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const msg = data?.errors?.map((e: { message: string }) => e.message).join('; ') || `HTTP ${res.status}`;
    throw new Error(`Cloudflare: ${msg}`);
  }
  return data.result as T;
}

async function cfFind(hostname: string): Promise<CfHostname | null> {
  const list = await cf<CfHostname[]>('GET', `/custom_hostnames?hostname=${encodeURIComponent(hostname)}`);
  return list.find((h) => h.hostname === hostname) ?? null;
}

async function cfEnsure(hostname: string): Promise<CfHostname> {
  const existing = await cfFind(hostname);
  if (existing) return existing;
  return await cf<CfHostname>('POST', '/custom_hostnames', {
    hostname,
    ssl: { method: 'http', type: 'dv', settings: { min_tls_version: '1.2' } },
  });
}

async function cfRemove(hostname: string): Promise<void> {
  const existing = await cfFind(hostname);
  if (existing) await cf('DELETE', `/custom_hostnames/${existing.id}`);
}

function cfStatus(h: CfHostname, cnameTarget: string): { ok: boolean; reason?: string } {
  const sslStatus = h.ssl?.status ?? 'unknown';
  if (h.status === 'active' && sslStatus === 'active') return { ok: true };
  const details = [
    ...(h.verification_errors ?? []),
    ...(h.ssl?.validation_errors ?? []).map((e) => e.message),
  ].filter(Boolean);
  return {
    ok: false,
    reason:
      `Waiting for Cloudflare (domain: ${h.status}, certificate: ${sslStatus}). ` +
      `Make sure ${h.hostname} has a CNAME to ${cnameTarget || 'the platform target'}.` +
      (details.length ? ` ${details.join('; ')}` : ''),
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────

async function loadAuthorizedRow(
  userClient: SupabaseClient,
  admin: SupabaseClient,
  domainId: string,
  isPlatformAdmin: boolean,
): Promise<DomainRow | null> {
  // Platform admins can act on any row; tenants only on rows RLS lets them see.
  const client = isPlatformAdmin ? admin : userClient;
  const { data } = await client
    .from('restaurant_custom_domains')
    .select('id, domain, verification_token, restaurant_id')
    .eq('id', domainId)
    .maybeSingle();
  return (data as DomainRow | null) ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json(401, { error: 'Missing Authorization header' });

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) return json(401, { error: 'Not authenticated' });

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const raw = (await req.json()) as Body;
    const action: Action = raw.action ?? 'verify';
    const domainId = (raw.domainId ?? '').trim();
    if (!domainId) return json(400, { error: 'domainId required' });
    if (!['verify', 'remove', 'set_verified'].includes(action)) {
      return json(400, { error: 'Unknown action' });
    }

    const { data: adminFlag } = await userClient.rpc('is_platform_admin');
    const isPlatformAdmin = adminFlag === true;
    if (action === 'set_verified' && !isPlatformAdmin) {
      return json(403, { error: 'Only platform admins can change verification manually' });
    }

    const row = await loadAuthorizedRow(userClient, admin, domainId, isPlatformAdmin);
    if (!row) return json(404, { error: 'Domain not found or access denied' });

    // ── remove ──
    if (action === 'remove') {
      if (CF_ENABLED) await cfRemove(row.domain);
      const { error } = await admin.from('restaurant_custom_domains').delete().eq('id', row.id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true, removed: true });
    }

    // ── set_verified (platform admin override) ──
    if (action === 'set_verified') {
      const verified = raw.verified === true;
      if (CF_ENABLED) {
        if (verified) await cfEnsure(row.domain);
        else await cfRemove(row.domain);
      }
      const { error } = await admin
        .from('restaurant_custom_domains')
        .update({
          verified,
          verified_at: verified ? new Date().toISOString() : null,
          last_check_at: new Date().toISOString(),
          last_check_error: null,
        })
        .eq('id', row.id);
      if (error) return json(500, { error: error.message });
      return json(200, { ok: true, verified });
    }

    // ── verify ──
    const cnameTarget = await resolveCnameTarget(admin);
    const txt = await verifyTxt(row.domain, row.verification_token);
    let routing: { ok: boolean; reason?: string };
    if (!txt.ok) {
      routing = { ok: false };
    } else if (CF_ENABLED) {
      // Only register with Cloudflare once ownership is proven.
      routing = cfStatus(await cfEnsure(row.domain), cnameTarget);
    } else {
      routing = await verifyRoutingDns(row.domain, cnameTarget);
    }

    const ok = txt.ok && routing.ok;
    const reason = ok
      ? null
      : [txt.ok ? null : txt.reason, routing.ok ? null : routing.reason].filter(Boolean).join(' · ');

    await admin
      .from('restaurant_custom_domains')
      .update({
        verified: ok,
        verified_at: ok ? new Date().toISOString() : null,
        last_check_at: new Date().toISOString(),
        last_check_error: reason,
      })
      .eq('id', row.id);

    return json(200, {
      ok,
      verified: ok,
      reason,
      checks: {
        txt: { ok: txt.ok, reason: txt.reason ?? null, host: `${TXT_PREFIXES[0]}.${row.domain}` },
        routing: { ok: routing.ok, reason: routing.reason ?? null, via: CF_ENABLED ? 'cloudflare' : 'dns' },
      },
      target: { cname: cnameTarget || null },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return json(500, { error: message });
  }
});
