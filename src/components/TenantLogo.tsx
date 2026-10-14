import { useEffect, useState } from 'react';
import { useSettings } from '@/hooks/useSettings';

interface TenantLogoProps {
  /** Tailwind size for the square logo container, e.g. "h-9 w-9". */
  sizeClassName?: string;
  /** Tailwind classes for rounding (e.g. "rounded-lg"). */
  roundedClassName?: string;
  /** Background applied behind the image / fallback. */
  bgClassName?: string;
  /** Text color used for the initial fallback. */
  fallbackTextClassName?: string;
  /** Object-fit class for the <img>. */
  imgFitClassName?: string;
  /** Optional extra className on the wrapper. */
  className?: string;
  /** Loading strategy for the underlying <img>. Defaults to "eager" so above-the-fold logos
   * (e.g. nav) render instantly. Pass "lazy" for below-the-fold placements like the footer
   * to defer the network request and avoid late flashes during initial paint. */
  loading?: 'eager' | 'lazy';
  /** Fetch priority hint for the browser. Defaults to "high" for eager, "low" for lazy. */
  fetchPriority?: 'high' | 'low' | 'auto';
  /** Optional explicit Tailwind background for the loading skeleton. Defaults to a neutral
   * tone matching the final image container (`bg-secondary`) so there's no color flash when
   * the real logo arrives. Pass a custom value (e.g. the same as `bgClassName`) when the
   * fallback initial is more likely than an image. */
  skeletonBgClassName?: string;
}

/**
 * Renders the current tenant's logo with no flash:
 *   • While settings are loading → neutral skeleton (no initial, no swap).
 *   • If a logo URL exists      → the image (falls back to initial on load error).
 *   • Otherwise                 → the first letter of the restaurant name.
 *
 * Centralising this avoids the "initial flashes for a frame, then the real
 * logo appears" problem we previously had on the customer-facing website.
 */
export default function TenantLogo({
  sizeClassName = 'h-9 w-9',
  roundedClassName = 'rounded-lg',
  bgClassName = 'bg-amber-500',
  fallbackTextClassName = 'text-black text-sm font-bold',
  imgFitClassName = 'object-contain',
  className = '',
  loading = 'eager',
  fetchPriority,
  skeletonBgClassName = 'bg-secondary',
}: TenantLogoProps) {
  const { data: settings, isLoading, isError } = useSettings();
  const [imgFailed, setImgFailed] = useState(false);
  // Once a fetch error occurs we lock into the deterministic placeholder for the
  // lifetime of this component instance. This prevents a later retry success
  // from swapping the rendered "R" (or custom fallback) into the real logo and
  // causing a visible flash long after first paint.
  const [errorLocked, setErrorLocked] = useState(false);
  useEffect(() => {
    if (isError && !errorLocked) setErrorLocked(true);
  }, [isError, errorLocked]);

  const wrapperClass = `${sizeClassName} ${roundedClassName} ${className}`.trim();
  const resolvedFetchPriority = fetchPriority ?? (loading === 'lazy' ? 'low' : 'high');

  // Loading state — reserve the exact same box (size + rounding) and use the same
  // background tone as the final image container so swapping in the real logo
  // doesn't cause a color flash or layout shift. The pulse stays subtle.
  // If we already entered the error-locked state, skip the skeleton so the
  // placeholder remains stable across retries.
  if (isLoading && !errorLocked) {
    return (
      <div
        className={`${wrapperClass} ${skeletonBgClassName} animate-pulse`}
        aria-hidden="true"
      />
    );
  }

  // When error-locked, ignore any (possibly successful) settings payload so the
  // rendered output stays deterministic. Otherwise prefer the real logo URL,
  // falling back to the initial when the image itself fails to load.
  const logoUrl = !errorLocked && !isError && !imgFailed
    ? settings?.logo_url ?? null
    : null;
  const initial = (
    !errorLocked && settings?.restaurant_name ? settings.restaurant_name : 'R'
  ).trim().charAt(0).toUpperCase() || 'R';

  if (logoUrl) {
    return (
      <div className={`${wrapperClass} overflow-hidden bg-secondary flex items-center justify-center`}>
        <img
          src={logoUrl}
          alt=""
          className={`h-full w-full ${imgFitClassName}`}
          loading={loading}
          decoding="async"
          // `fetchpriority` is a valid HTML attribute; React 18+ accepts the camelCase form.
          // @ts-expect-error — typings lag the platform attribute in some React versions.
          fetchpriority={resolvedFetchPriority}
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`${wrapperClass} ${bgClassName} flex items-center justify-center`}>
      <span className={fallbackTextClassName}>{initial}</span>
    </div>
  );
}
