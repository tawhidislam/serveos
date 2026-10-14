/**
 * Route-level prefetching for the marketing site.
 *
 * Each entry is a thunk that dynamically imports the page chunk. Vite
 * de-duplicates dynamic imports, so calling the same loader multiple times
 * is free after the first call (the module + its CSS stay in cache).
 *
 * We prefetch on user *intent* signals only:
 *   - pointerenter (mouse/pen hover)
 *   - touchstart   (mobile press)
 *   - focusin      (keyboard tab)
 *
 * This keeps the first paint untouched and only pulls in the next chunk
 * a few hundred ms before the user actually clicks.
 */

type Loader = () => Promise<unknown>;

const loaders: Record<string, Loader> = {
  '/': () => import('@/pages/marketing/MarketingHome'),
  '/features': () => import('@/pages/marketing/MarketingFeatures'),
  '/pricing': () => import('@/pages/marketing/MarketingPricing'),
  '/demo': () => import('@/pages/marketing/MarketingDemo'),
  '/about': () => import('@/pages/marketing/MarketingAbout'),
  '/contact': () => import('@/pages/marketing/MarketingContact'),
  '/login': () => import('@/pages/marketing/MarketingLogin'),
  '/signup': () => import('@/pages/marketing/MarketingSignup'),
  '/terms': () => import('@/pages/marketing/MarketingTerms'),
  '/privacy': () => import('@/pages/marketing/MarketingPrivacy'),
  '/refund-policy': () => import('@/pages/marketing/MarketingRefund'),
  '/refunds': () => import('@/pages/marketing/MarketingRefund'),
  '/privacy-policy': () => import('@/pages/marketing/MarketingPrivacy'),
};

// Track which paths we've already kicked off so repeated hovers don't even
// allocate a microtask. Vite caches the module either way; this is just tidy.
const fired = new Set<string>();

export function prefetchMarketingRoute(path: string): void {
  if (!path) return;
  // Strip query/hash so /pricing?plan=pro still maps cleanly.
  const clean = path.split('?')[0].split('#')[0];
  if (fired.has(clean)) return;
  const loader = loaders[clean];
  if (!loader) return;
  fired.add(clean);
  // Fire and forget. Errors are surfaced when the user actually navigates.
  loader().catch(() => {
    // If the prefetch fails (network), let the user retry on real navigation.
    fired.delete(clean);
  });
}

/**
 * Returns the set of intent handlers to spread onto an <a>/<Link>. These
 * are no-ops on routes we don't know about.
 */
export function prefetchHandlers(path: string) {
  const trigger = () => prefetchMarketingRoute(path);
  return {
    onPointerEnter: trigger,
    onTouchStart: trigger,
    onFocus: trigger,
  };
}
