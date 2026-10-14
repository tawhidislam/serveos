/**
 * Helpers for serving gallery images responsively.
 *
 * We only ever reference URLs we actually have (the uploaded original and,
 * when present, the generated thumbnail) so no broken/transformed URLs are
 * requested. Widths are the nominal sizes produced by the upload pipeline.
 */

export const THUMB_WIDTH = 400;
export const FULL_WIDTH = 1200;

export interface ResponsiveImageSources {
  src: string;
  srcSet?: string;
  sizes?: string;
}

/**
 * Build src/srcSet for an image that has an optional smaller thumbnail.
 * `preferThumb` picks the lightweight file as the default src (small tiles).
 */
export function buildImageSources(
  url: string,
  thumbUrl?: string,
  preferThumb = true,
): ResponsiveImageSources {
  if (!url) return { src: '' };
  if (!thumbUrl || thumbUrl === url) return { src: url };

  return {
    src: preferThumb ? thumbUrl : url,
    srcSet: `${thumbUrl} ${THUMB_WIDTH}w, ${url} ${FULL_WIDTH}w`,
  };
}

/**
 * `sizes` for a fluid grid of `columns` tiles inside a max-w-6xl (1152px)
 * container. Mobile always renders 2 columns.
 */
export function gridSizes(columns: number, featured = false): string {
  const cols = Math.min(6, Math.max(2, columns));
  const span = featured ? 2 : 1;
  const desktop = Math.round((1152 / cols) * span);
  const tablet = Math.round((768 / Math.min(cols, 3)) * span);
  const mobile = Math.round(50 * span);
  return `(min-width: 1152px) ${desktop}px, (min-width: 640px) ${tablet}px, ${Math.min(100, mobile)}vw`;
}
