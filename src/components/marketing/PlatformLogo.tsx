import { forwardRef } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import defaultLogo from '@/assets/platform-logo.png';

interface PlatformLogoProps {
  /** Optional className applied to the wrapper. */
  className?: string;
  /** Whether to render the site name next to the mark. Default true.
   *  Ignored when the resolved logo is a wide wordmark (text already in image). */
  showName?: boolean;
  /** Override the icon size in pixels (square). Used as the *height* for wide logos. */
  size?: number;
}

/**
 * Shared SaaS marketing logo. Falls back to a bundled wordmark when no
 * custom logo has been uploaded by a platform admin. Wide (wordmark) logos
 * are rendered at their natural aspect ratio so text isn't squashed.
 *
 * forwardRef so parents (e.g. Radix Slot via asChild, tooltip triggers) can
 * attach a ref without React warning about function components.
 */
const PlatformLogo = forwardRef<HTMLSpanElement, PlatformLogoProps>(function PlatformLogo(
  { className = '', showName = false, size = 36 },
  ref,
) {
  const { logoUrl, siteName } = usePlatformBranding();

  // Prefer the admin-uploaded logo, otherwise fall back to the bundled wordmark.
  const resolvedLogo = logoUrl || defaultLogo;
  // Treat any resolved logo as a wordmark — our brand mark already contains the
  // site name, so we never render the text label beside it.
  const isWordmark = true;

  if (resolvedLogo) {
    return (
      <span ref={ref} className={`flex items-center gap-2.5 ${className}`}>
        <img
          src={resolvedLogo}
          alt={`${siteName} logo`}
          style={{ height: size, width: 'auto', maxWidth: size * 6 }}
          className="object-contain"
          loading="eager"
          decoding="async"
        />
        {showName && !isWordmark && (
          <span className="text-base font-semibold tracking-tight text-foreground">{siteName}</span>
        )}
      </span>
    );
  }

  return (
    <span ref={ref} className={`flex items-center gap-2.5 ${className}`}>
      <span
        style={{ height: size, width: size }}
        className="rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20"
      >
        <UtensilsCrossed className="text-primary-foreground" style={{ height: size * 0.55, width: size * 0.55 }} strokeWidth={2} />
      </span>
      {showName && (
        <span className="text-base font-semibold tracking-tight text-foreground">{siteName}</span>
      )}
    </span>
  );
});

export default PlatformLogo;
