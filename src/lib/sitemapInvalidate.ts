/**
 * Sitemap cache invalidation with result feedback.
 *
 * The dynamic sitemap edge function re-queries Supabase on every request, so
 * its data is always live — but it sits behind a 5-minute CDN cache
 * (`s-maxage=300`). When an admin saves a slug change we want crawlers to see
 * it immediately on the *next* hit.
 *
 * Strategy: GET to the function with a unique `bust=<ts>` query param. CDNs
 * treat that as a distinct URL, so it bypasses the cached variant and forces
 * a fresh origin response which is then cached for the next bot.
 */
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;

export type InvalidationResult =
  | { type: 'success'; url: string }
  | { type: 'error'; reason: string }
  | { type: 'skipped'; reason: 'no_supabase_url' };

export async function invalidateSitemap(signal?: AbortSignal): Promise<InvalidationResult> {
  if (!SUPABASE_URL) {
    return { type: 'skipped', reason: 'no_supabase_url' };
  }

  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/functions/v1/sitemap?bust=${Date.now()}`;

  try {
    // Use no-cors to avoid preflight; we only care that the request went to the edge.
    await fetch(url, { method: 'GET', mode: 'no-cors', signal });
    return { type: 'success', url };
  } catch (err) {
    // If aborted, surface that specifically.
    if (signal?.aborted) {
      return { type: 'error', reason: 'Request aborted' };
    }
    return { type: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}
