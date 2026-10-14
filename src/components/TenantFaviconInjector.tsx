import { useEffect } from 'react';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';

function guessFaviconMime(url: string): string {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

/**
 * Swaps the document favicon to the tenant restaurant's `favicon_url` while
 * mounted, restoring whatever icons existed before on unmount. Renders nothing.
 *
 * Pass `source="resolved"` on public website routes (uses the /r/:slug param)
 * and the default `source="current"` on authenticated tenant surfaces (admin,
 * owner, waiter).
 */
export default function TenantFaviconInjector({
  source = 'current',
}: {
  source?: 'current' | 'resolved';
}) {
  return source === 'resolved' ? <ResolvedFavicon /> : <CurrentFavicon />;
}

function CurrentFavicon() {
  const { data } = useCurrentRestaurant();
  return <Apply url={data?.favicon_url ?? null} />;
}

function ResolvedFavicon() {
  const { restaurant } = useResolvedRestaurant();
  return <Apply url={restaurant?.favicon_url ?? null} />;
}

/** Default favicon shipped in `index.html` — used when no tenant icon is set
 *  and as a fallback if the tenant icon fails to load (404, CORS, etc.). */
const DEFAULT_FAVICON = '/favicon.png';
const MANAGED_ID = 'tenant-managed-favicon';

function setManagedFavicon(href: string) {
  const head = document.head;
  // Hide any author-defined icons so the browser uses ours instead of stacking.
  Array.from(
    head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"]'),
  )
    .filter(el => el.id !== MANAGED_ID)
    .forEach(el => el.setAttribute('data-tenant-hidden', 'true'));
  Array.from(
    head.querySelectorAll<HTMLLinkElement>('link[data-tenant-hidden="true"]'),
  ).forEach(el => el.remove());

  let link = head.querySelector<HTMLLinkElement>(`#${MANAGED_ID}`);
  if (!link) {
    link = document.createElement('link');
    link.id = MANAGED_ID;
    link.rel = 'icon';
    head.appendChild(link);
  }
  link.type = guessFaviconMime(href);
  link.href = href;
}

function Apply({ url }: { url: string | null }) {
  useEffect(() => {
    // Snapshot existing icons so we can restore them on unmount.
    const head = document.head;
    const original = Array.from(
      head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"]'),
    ).filter(el => el.id !== MANAGED_ID);

    if (!url) {
      // No tenant favicon configured → leave the page's default icon in place.
      return;
    }

    setManagedFavicon(url);

    // Probe the tenant URL; if it fails to load, fall back to the default
    // favicon so users never see a broken/blank tab icon.
    const probe = new Image();
    probe.onerror = () => setManagedFavicon(DEFAULT_FAVICON);
    probe.src = url;

    return () => {
      head.querySelector(`#${MANAGED_ID}`)?.remove();
      original.forEach(el => {
        el.removeAttribute('data-tenant-hidden');
        head.appendChild(el);
      });
    };
  }, [url]);
  return null;
}
