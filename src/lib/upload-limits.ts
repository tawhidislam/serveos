import { toast } from 'sonner';

/** Centralised image upload size limits (in bytes). */
export const IMAGE_SIZE_LIMITS = {
  /** Icons / favicons */
  favicon: 512 * 1024,
  /** Logos */
  logo: 2 * 1024 * 1024,
  /** Standard content images (menu, gallery, website, branding) */
  image: 5 * 1024 * 1024,
  /** Large assets such as floor plan blueprints */
  large: 10 * 1024 * 1024,
} as const;

export type ImageSizeLimitKey = keyof typeof IMAGE_SIZE_LIMITS;

/** Supported image formats for standard content uploads. */
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'] as const;
/** Value for an <input type="file" accept="..."> attribute. */
export const ACCEPT_IMAGE_ATTR = 'image/jpeg,image/png,image/webp';
/** Human-readable hint, e.g. "JPG, PNG or WebP" */
export const IMAGE_FORMAT_HINT = 'JPG, PNG or WebP';

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)}MB`;
  }
  return `${Math.round(bytes / 1024)}KB`;
}

/**
 * Validates an image file's format (JPG, PNG, WebP).
 * Shows a toast and returns false when the format is unsupported.
 */
export function validateImageType(file: File): boolean {
  const type = file.type.toLowerCase();
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const ok =
    (ACCEPTED_IMAGE_TYPES as readonly string[]).includes(type) ||
    (!type && (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext));
  if (!ok) {
    const label = type || ext ? `"${type || `.${ext}`}"` : 'This file';
    toast.error(`${label} is not a supported image format — please upload ${IMAGE_FORMAT_HINT}.`);
    return false;
  }
  return true;
}

/**
 * Validates an image file against a size limit.
 * Shows a toast and returns false when the file is too large.
 */
export function validateImageSize(
  file: File,
  limit: ImageSizeLimitKey | number = 'image',
): boolean {
  const max = typeof limit === 'number' ? limit : IMAGE_SIZE_LIMITS[limit];
  if (file.size > max) {
    toast.error(`"${file.name}" is ${formatBytes(file.size)} — images must be under ${formatBytes(max)}`);
    return false;
  }
  return true;
}

/** Validates both format and size. Shows a toast on the first failure. */
export function validateImageFile(
  file: File,
  limit: ImageSizeLimitKey | number = 'image',
): boolean {
  return validateImageType(file) && validateImageSize(file, limit);
}

/** Human-readable hint, e.g. "JPG, PNG or WebP · Max 5MB" */
export function maxSizeHint(limit: ImageSizeLimitKey | number = 'image'): string {
  const max = typeof limit === 'number' ? limit : IMAGE_SIZE_LIMITS[limit];
  return `Max ${formatBytes(max)}`;
}

/** Combined format + size hint. */
export function imageUploadHint(limit: ImageSizeLimitKey | number = 'image'): string {
  return `${IMAGE_FORMAT_HINT} · ${maxSizeHint(limit)}`;
}

/** Safe file extension derived from the real image type (never from user input). */
export const EXTENSION_FOR_IMAGE_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export function safeImageExtension(file: File, sniffed?: string | null): string {
  const type = (sniffed || file.type || '').toLowerCase();
  if (EXTENSION_FOR_IMAGE_TYPE[type]) return EXTENSION_FOR_IMAGE_TYPE[type];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return (ACCEPTED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext === 'jpeg' ? 'jpg' : ext) : 'jpg';
}

/**
 * Reads the file's magic bytes to determine its true image type.
 * Returns null when the signature doesn't match a supported format —
 * this catches renamed files (e.g. script.js saved as photo.png).
 */
export async function sniffImageMime(file: File): Promise<string | null> {
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const at = (i: number) => head[i];
  if (at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff) return 'image/jpeg';
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return 'image/png';
  const ascii = (start: number, len: number) =>
    String.fromCharCode(...Array.from(head.slice(start, start + len)));
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') return 'image/webp';
  return null;
}

export interface ImageValidationResult {
  ok: boolean;
  /** Real MIME type detected from the file contents. */
  mime?: string;
  reason?: string;
}

/**
 * Full validation for a single upload: non-empty, declared type, size limit,
 * real content signature, and decodable pixels with sane dimensions.
 * Silent (no toast) so callers can batch-report results.
 */
export async function inspectImageFile(
  file: File,
  limit: ImageSizeLimitKey | number = 'image',
  opts: { minDimension?: number; maxDimension?: number } = {},
): Promise<ImageValidationResult> {
  const { minDimension = 32, maxDimension = 12000 } = opts;
  const max = typeof limit === 'number' ? limit : IMAGE_SIZE_LIMITS[limit];

  if (file.size === 0) return { ok: false, reason: 'the file is empty' };
  if (file.size > max) return { ok: false, reason: `it is ${formatBytes(file.size)} (max ${formatBytes(max)})` };

  const declared = file.type.toLowerCase();
  if (declared && !(ACCEPTED_IMAGE_TYPES as readonly string[]).includes(declared)) {
    return { ok: false, reason: `"${declared}" is not a supported format (${IMAGE_FORMAT_HINT})` };
  }

  let mime: string | null = null;
  try {
    mime = await sniffImageMime(file);
  } catch {
    return { ok: false, reason: 'the file could not be read' };
  }
  if (!mime) return { ok: false, reason: `it is not a valid ${IMAGE_FORMAT_HINT} image` };

  const dims = await new Promise<{ w: number; h: number } | null>(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve({ w: img.naturalWidth, h: img.naturalHeight }); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
  if (!dims) return { ok: false, reason: 'the image appears to be corrupted' };
  if (dims.w < minDimension || dims.h < minDimension) {
    return { ok: false, reason: `it is only ${dims.w}×${dims.h}px (minimum ${minDimension}px)` };
  }
  if (dims.w > maxDimension || dims.h > maxDimension) {
    return { ok: false, reason: `it is ${dims.w}×${dims.h}px (maximum ${maxDimension}px)` };
  }

  return { ok: true, mime };
}
