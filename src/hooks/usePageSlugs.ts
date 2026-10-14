import { useMemo } from 'react';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

/**
 * Custom URL slugs the restaurant admin has chosen for their public static
 * pages. The originals (`/menu`, `/about`, `/gallery`, `/contact`) always keep
 * working — these are *additional* aliases that resolve to the same component.
 *
 * Stored on `restaurants.page_slugs` as a free-form JSON object so we can
 * extend it without another migration:
 *   { "menu": "our-food", "about": "story", "gallery": "photos", "contact": "visit" }
 */
export type PageKey = 'menu' | 'about' | 'gallery' | 'contact';

export const PAGE_KEYS: PageKey[] = ['menu', 'about', 'gallery', 'contact'];

export const DEFAULT_PAGE_PATHS: Record<PageKey, string> = {
  menu: 'menu',
  about: 'about',
  gallery: 'gallery',
  contact: 'contact',
};

export interface PageSlugs {
  menu?: string;
  about?: string;
  gallery?: string;
  contact?: string;
}

function sanitize(raw: unknown): PageSlugs {
  if (!raw || typeof raw !== 'object') return {};
  const out: PageSlugs = {};
  for (const key of PAGE_KEYS) {
    const v = (raw as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) {
      out[key] = v.trim().toLowerCase();
    }
  }
  return out;
}

/** Resolves the active restaurant's custom static-page slugs (if any). */
export function usePageSlugs() {
  const { data: restaurant } = useCurrentRestaurant();
  const slugs = useMemo<PageSlugs>(
    () => sanitize((restaurant as any)?.page_slugs),
    [restaurant],
  );
  return { slugs, restaurant };
}

/** Path the admin should advertise for a given canonical page (without leading /). */
export function publicPathFor(page: PageKey, slugs: PageSlugs): string {
  return slugs[page] || DEFAULT_PAGE_PATHS[page];
}
