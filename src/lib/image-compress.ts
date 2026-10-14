/**
 * Client-side image resizing / compression.
 *
 * Downscales large images and re-encodes them before upload so we send far
 * fewer bytes to storage. Photos are converted to WebP (typically 25–35%
 * smaller than JPEG and far smaller than PNG photos); logos and favicons keep
 * their original type because they're embedded in PDFs and browser tabs.
 * Unsupported formats (SVG, ICO, GIF…) are passed through untouched.
 *
 * When the output type changes, the returned File's name gets the matching
 * extension; uploadWithProgress() aligns the storage path to it.
 */

const COMPRESSIBLE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export interface CompressOptions {
  /** Max width in px (default 1920) */
  maxWidth?: number;
  /** Max height in px (default 1920) */
  maxHeight?: number;
  /** Encoder quality for lossy formats (default 0.82) */
  quality?: number;
  /** Skip files already smaller than this (bytes, default 100KB) */
  skipUnder?: number;
  /** 'webp' converts to WebP when the browser can encode it; 'original' keeps the type (default) */
  format?: 'webp' | 'original';
}

/** Presets for common upload surfaces. */
export const COMPRESS_PRESETS = {
  /** Hero / full-bleed website imagery */
  hero: { maxWidth: 1920, maxHeight: 1280, quality: 0.8, format: 'webp' },
  /** Menu items, gallery photos, content images */
  content: { maxWidth: 1400, maxHeight: 1400, quality: 0.8, format: 'webp' },
  /** Small preview images */
  thumbnail: { maxWidth: 480, maxHeight: 480, quality: 0.72, skipUnder: 0, format: 'webp' },
  /** Avatars and logos — original type (used in invoice PDFs) */
  avatar: { maxWidth: 512, maxHeight: 512, quality: 0.9 },
  /** Floor plan blueprints — keep detail */
  blueprint: { maxWidth: 2400, maxHeight: 2400, quality: 0.88, format: 'webp' },
} as const satisfies Record<string, CompressOptions>;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

/**
 * Returns a compressed File, or the original when compression isn't
 * possible/beneficial. Never throws — falls back to the original file.
 */
export async function compressImage(file: File, options: CompressOptions = {}): Promise<File> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.82,
    skipUnder = 100 * 1024,
    format = 'original',
  } = options;

  const type = (file.type || '').toLowerCase();
  if (!COMPRESSIBLE_TYPES.includes(type)) return file;
  if (file.size <= skipUnder) return file;

  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;

    const scale = Math.min(1, maxWidth / w, maxHeight / h);
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const originalType = type === 'image/jpg' ? 'image/jpeg' : type;
    const encode = (mime: string) =>
      new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));

    let blob: Blob | null = null;
    if (format === 'webp') {
      blob = await encode('image/webp');
      // Browsers without a WebP encoder silently return PNG — ignore that.
      if (blob && blob.type !== 'image/webp') blob = null;
    }
    if (!blob) blob = await encode(originalType);
    if (!blob) return file;

    if (blob.size >= file.size) return file;

    const outType = blob.type || originalType;
    const ext = outType === 'image/webp' ? 'webp' : outType === 'image/png' ? 'png' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(url);
  }
}
