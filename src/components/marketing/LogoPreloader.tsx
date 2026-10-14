import { useEffect } from 'react';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import defaultLogo from '@/assets/platform-logo.png';

/**
 * Adds a `<link rel="preload" as="image">` for the platform navbar logo so the
 * mark renders immediately on auth pages without a flicker on first load.
 * The tag is removed on unmount to avoid leaking unused preloads on other routes.
 */
export default function LogoPreloader() {
  const { logoUrl } = usePlatformBranding();
  const href = logoUrl || defaultLogo;

  useEffect(() => {
    if (!href) return;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    link.fetchPriority = 'high';
    document.head.appendChild(link);
    return () => {
      link.parentNode?.removeChild(link);
    };
  }, [href]);

  return null;
}
