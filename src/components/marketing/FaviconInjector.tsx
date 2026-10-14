import { useEffect } from 'react';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';

/** Pick a sensible MIME type from the URL extension. */
function guessFaviconMime(url: string): string {
  const lower = url.split('?')[0].toLowerCase();
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  if (lower.endsWith('.ico')) return 'image/x-icon';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  return 'image/png';
}

/**
 * Swaps the document favicon to the platform-admin-uploaded URL when one is
 * configured, and restores the original on unmount. Renders nothing.
 *
 * Strategy: we keep ONE managed <link rel="icon"> element so repeated renders
 * don't pile up and we don't delete user-authored icons we didn't create.
 */
export default function FaviconInjector() {
  const { faviconUrl } = usePlatformBranding();

  useEffect(() => {
    if (!faviconUrl) return;

    const head = document.head;
    const MANAGED_ID = 'platform-managed-favicon';

    // Hide existing icons so the browser uses ours instead of stacking.
    const existing = Array.from(
      head.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="shortcut icon"]'),
    ).filter(el => el.id !== MANAGED_ID);
    existing.forEach(el => el.setAttribute('data-platform-hidden', 'true'));
    existing.forEach(el => el.remove());

    let link = head.querySelector<HTMLLinkElement>(`#${MANAGED_ID}`);
    if (!link) {
      link = document.createElement('link');
      link.id = MANAGED_ID;
      link.rel = 'icon';
      head.appendChild(link);
    }
    link.type = guessFaviconMime(faviconUrl);
    link.href = faviconUrl;

    return () => {
      // Remove our managed link and restore the originals we hid.
      const managed = head.querySelector(`#${MANAGED_ID}`);
      managed?.remove();
      existing.forEach(el => {
        el.removeAttribute('data-platform-hidden');
        head.appendChild(el);
      });
    };
  }, [faviconUrl]);

  return null;
}
