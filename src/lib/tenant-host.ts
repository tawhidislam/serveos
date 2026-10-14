/**
 * Subdomain-based tenant resolver (Shopify-style).
 *
 * When the app is hosted under one of the configured platform root domains
 * (e.g. `serveos.net`), any first-level subdomain that is NOT in the
 * reserved list is treated as a tenant slug. So:
 *
 *   fryhubt.serveos.net       -> tenant slug "fryhubt"
 *   www.serveos.net           -> platform (marketing)
 *   admin.serveos.net         -> platform (reserved)
 *   serveos.net               -> platform root
 *   fryhubt.com               -> NOT a subdomain match; falls through to the
 *                                existing verified custom-domain lookup
 *
 * The default root is `serveos.net`. Override via `VITE_PLATFORM_ROOT_DOMAIN`
 * (comma-separated for multi-root setups, e.g. `serveos.net,serveos.app`).
 */

const DEFAULT_ROOTS = 'serveos.net';
const RAW_ROOTS = ((import.meta.env.VITE_PLATFORM_ROOT_DOMAIN as string | undefined) ?? DEFAULT_ROOTS);

export const PLATFORM_ROOT_DOMAINS: string[] = RAW_ROOTS
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

/** Subdomains that must NEVER be interpreted as a tenant slug. */
/**
 * Subdomains that must NEVER be interpreted as a tenant slug.
 * Keep in sync with `RESERVED_SLUGS` in:
 *   - supabase/functions/restaurant-signup/index.ts
 *   - supabase/functions/restaurant-rename-slug/index.ts
 */
export const RESERVED_SUBDOMAINS = new Set<string>([
  // platform / infra
  'www', 'app', 'api', 'admin', 'staff', 'platform', 'system', 'root',
  'auth', 'login', 'logout', 'signup', 'signin', 'register', 'oauth', 'sso',
  'dashboard', 'settings', 'account', 'accounts', 'billing', 'payments', 'payment',
  // mail / dns
  'mail', 'email', 'smtp', 'imap', 'pop', 'pop3', 'mx', 'ns', 'ns1', 'ns2',
  'ftp', 'sftp', 'ssh', 'vpn',
  // content / docs
  'marketing', 'blog', 'news', 'docs', 'doc', 'help', 'support', 'kb', 'faq',
  'about', 'contact', 'terms', 'privacy', 'legal', 'pricing',
  // ops / monitoring
  'status', 'health', 'metrics', 'monitor', 'logs',
  // assets / cdn
  'cdn', 'assets', 'static', 'media', 'img', 'images', 'files', 'storage', 'uploads',
  // app / product surfaces (must not collide with tenant routes)
  'test', 'staging', 'preview', 'dev', 'beta', 'alpha', 'sandbox',
  'public', 'private', 'internal',
  'store', 'stores', 'shop', 'shops', 'order', 'orders', 'menu', 'menus',
  'qr', 'kitchen', 'waiter', 'server', 'pos', 'kds',
  'reservation', 'reservations', 'booking', 'bookings',
  'customer', 'customers', 'user', 'users', 'owner', 'owners',
  'analytics', 'reports',
]);

/** Returns the matching root domain for `hostname`, or null. */
export function matchPlatformRoot(hostname: string | null): string | null {
  if (!hostname) return null;
  const h = hostname.toLowerCase();
  for (const root of PLATFORM_ROOT_DOMAINS) {
    if (h === root || h.endsWith(`.${root}`)) return root;
  }
  return null;
}

/**
 * If `hostname` is `<sub>.<root>` where root is a configured platform root
 * and `<sub>` is not reserved, returns `<sub>` as the candidate tenant slug.
 * Otherwise returns null.
 */
export function getSubdomainTenantSlug(hostname: string | null): string | null {
  const root = matchPlatformRoot(hostname);
  if (!root || !hostname) return null;
  if (hostname === root) return null; // bare root
  const sub = hostname.slice(0, -1 * (root.length + 1)); // strip ".<root>"
  if (!sub || sub.includes('.')) return null; // only single-level subdomains
  if (RESERVED_SUBDOMAINS.has(sub)) return null;
  if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(sub)) return null;
  return sub;
}

/**
 * True when the hostname is the platform root or a reserved subdomain
 * (i.e. NOT a tenant subdomain). Custom domains return false here — they
 * are handled by the verified-custom-domain lookup.
 */
export function isPlatformRootOrReserved(hostname: string | null): boolean {
  const root = matchPlatformRoot(hostname);
  if (!root || !hostname) return false;
  if (hostname === root) return true;
  const sub = hostname.slice(0, -1 * (root.length + 1));
  if (!sub || sub.includes('.')) return false;
  return RESERVED_SUBDOMAINS.has(sub);
}

/** Primary platform root domain to use for building tenant URLs (or null if not configured). */
export function getPlatformRootDomain(): string | null {
  return PLATFORM_ROOT_DOMAINS[0] ?? null;
}

/** True if subdomain tenancy is configured for this deployment. */
export function isSubdomainTenancyEnabled(): boolean {
  return PLATFORM_ROOT_DOMAINS.length > 0;
}

/** True if `slug` is reserved (cannot be used as a tenant subdomain). */
export function isReservedSlug(slug: string): boolean {
  return RESERVED_SUBDOMAINS.has(slug.toLowerCase());
}

/**
 * Returns the public origin for a tenant. When subdomain tenancy is enabled,
 * returns `https://<slug>.<root>`; otherwise falls back to the current origin
 * with the legacy `/r/<slug>` prefix baked into `buildTenantUrl`.
 */
export function getTenantOrigin(slug: string): string | null {
  const root = getPlatformRootDomain();
  if (!root) return null;
  return `https://${slug}.${root}`;
}

/**
 * Builds a full URL for a tenant page. Uses the subdomain when subdomain
 * tenancy is enabled, otherwise the legacy `/r/<slug><path>` form on the
 * current origin.
 */
export function buildTenantUrl(slug: string, path: string = '/'): string {
  const normPath = path.startsWith('/') ? path : `/${path}`;
  const origin = getTenantOrigin(slug);
  if (origin) return `${origin}${normPath === '/' ? '' : normPath}`;
  if (typeof window === 'undefined') return `/r/${slug}${normPath === '/' ? '' : normPath}`;
  return `${window.location.origin}/r/${slug}${normPath === '/' ? '' : normPath}`;
}

