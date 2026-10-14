import type { Json } from '@/integrations/supabase/types';
import type { SectionContent } from '@/lib/marketing-sections';

/**
 * Recursively check that a value is a valid Supabase `Json` value.
 * Returns the dotted path of the first invalid leaf, or null when OK.
 *
 * Disallows: undefined, functions, symbols, bigints, NaN, Infinity, Dates,
 * class instances, Maps, Sets — anything that won't survive JSONB round-trip.
 */
export function findInvalidJsonPath(value: unknown, path = '$'): string | null {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return null;
  if (t === 'number') return Number.isFinite(value as number) ? null : path;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const bad = findInvalidJsonPath(value[i], `${path}[${i}]`);
      if (bad) return bad;
    }
    return null;
  }
  if (t === 'object') {
    // Reject non-plain objects (Date, Map, Set, class instances, etc.)
    const proto = Object.getPrototypeOf(value as object);
    if (proto !== Object.prototype && proto !== null) return path;
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v === undefined) return `${path}.${k}`;
      const bad = findInvalidJsonPath(v, `${path}.${k}`);
      if (bad) return bad;
    }
    return null;
  }
  // undefined, function, symbol, bigint
  return path;
}

export interface ValidationResult {
  ok: boolean;
  /** User-facing message; empty string when ok. */
  message: string;
}

/** Validate that the content blob is a JSON object compatible with Supabase. */
export function validateSectionContent(content: unknown): ValidationResult {
  if (content === null || typeof content !== 'object' || Array.isArray(content)) {
    return { ok: false, message: 'Content must be a JSON object (e.g. { "title": "..." }).' };
  }
  const bad = findInvalidJsonPath(content);
  if (bad) {
    return {
      ok: false,
      message: `Invalid value at ${bad}. Only strings, numbers, booleans, arrays, and plain objects are allowed.`,
    };
  }
  return { ok: true, message: '' };
}

/** Narrow + assert that a value is a `SectionContent` (object of Json values). */
export function assertSectionContent(value: unknown): SectionContent {
  const result = validateSectionContent(value);
  if (!result.ok) throw new Error(result.message);
  return value as Record<string, Json>;
}
