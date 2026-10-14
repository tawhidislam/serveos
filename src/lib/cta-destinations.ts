/**
 * Configurable call-to-action destinations for tenant homepages.
 * Values are stored as plain paths/URLs in `homepage_content`, so any legacy
 * value keeps working — the presets simply make the common order flows one click.
 */
export type CtaDestination = {
  value: string;
  label: string;
  hint?: string;
};

export const CTA_DESTINATIONS: CtaDestination[] = [
  { value: '/menu', label: 'Browse menu', hint: 'Full menu page' },
  { value: '/menu?order=delivery', label: 'Order delivery', hint: 'Menu with delivery pre-selected' },
  { value: '/menu?order=pickup', label: 'Order pickup', hint: 'Menu with pickup pre-selected' },
  { value: '/dine-in', label: 'Dine-in / table order', hint: 'Pick or scan a table first, then order' },
  { value: '/menu?order=dinein', label: 'Dine-in menu (skip table step)', hint: 'Menu in dine-in mode, no table selection' },
  { value: '/contact#reserve', label: 'Reserve a table', hint: 'Jumps to the reservation form' },
  { value: '/account', label: 'My orders / account', hint: 'Customer portal' },
  { value: '/gallery', label: 'Gallery', hint: 'Photo gallery page' },
  { value: '/about', label: 'About us', hint: 'Story page' },
  { value: '/contact', label: 'Contact', hint: 'Contact page' },
];

export const CTA_CUSTOM = '__custom__';

export function isPresetDestination(value?: string | null) {
  return !!value && CTA_DESTINATIONS.some(d => d.value === value);
}

/** External / non-router destinations that must render as a plain anchor. */
export function isExternalHref(href: string) {
  return /^(https?:|tel:|mailto:)/i.test(href);
}

/**
 * Resolve a stored CTA value into a href, keeping tenant `/r/:slug` scoping.
 * `withPrefix` comes from `useWebsitePrefix()`.
 */
export function resolveCtaHref(
  value: string | undefined | null,
  fallback: string,
  withPrefix: (p: string) => string,
) {
  const raw = (value ?? '').trim() || fallback;
  if (isExternalHref(raw)) return raw;
  if (raw.startsWith('#')) return raw;
  return withPrefix(raw.startsWith('/') ? raw : `/${raw}`);
}

export type CtaValidation = {
  level: 'ok' | 'warning' | 'error';
  message?: string;
};

/**
 * Validate a custom/external CTA link entered in the homepage editor.
 * Errors block obviously broken links; warnings flag likely mistakes.
 */
export function validateCtaDestination(raw: string | undefined | null): CtaValidation {
  const value = (raw ?? '').trim();
  if (!value) return { level: 'error', message: 'Link is empty — this button will not go anywhere.' };
  if (/\s/.test(value)) return { level: 'error', message: 'Link contains spaces. Remove them or use %20.' };

  if (/^(tel:|mailto:)/i.test(value)) {
    const target = value.replace(/^(tel:|mailto:)/i, '').trim();
    if (!target) return { level: 'error', message: 'Missing phone number or email address after the prefix.' };
    if (/^mailto:/i.test(value) && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(target)) {
      return { level: 'warning', message: 'This does not look like a valid email address.' };
    }
    return { level: 'ok' };
  }

  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
        return { level: 'error', message: 'External link has an invalid domain name.' };
      }
      if (url.protocol === 'http:') {
        return { level: 'warning', message: 'Uses insecure http:// — prefer https:// so browsers do not warn visitors.' };
      }
      return { level: 'ok' };
    } catch {
      return { level: 'error', message: 'This is not a valid URL.' };
    }
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
    return { level: 'error', message: 'Unsupported link type. Use https://, tel:, mailto:, or a path starting with /.' };
  }

  if (value.startsWith('#')) {
    return value.length > 1
      ? { level: 'ok' }
      : { level: 'error', message: 'Anchor link is missing a section id.' };
  }

  if (value.startsWith('//')) {
    return { level: 'error', message: 'Protocol-relative links are not supported. Use https:// instead.' };
  }

  if (!value.startsWith('/')) {
    return { level: 'warning', message: 'Internal links should start with “/” — it will be added automatically.' };
  }

  if (/^\/r\//i.test(value)) {
    return { level: 'warning', message: 'Remove the “/r/your-slug” prefix — tenant links are scoped automatically.' };
  }

  return { level: 'ok' };
}

export type CtaDestinationType =
  | 'menu' | 'order' | 'dine_in' | 'reserve' | 'account' | 'content' | 'external' | 'contact_channel' | 'other';

export type CtaFulfillment = 'delivery' | 'pickup' | 'dine_in' | 'reserve' | 'none';

export const CTA_TYPE_LABELS: Record<CtaDestinationType, string> = {
  menu: 'Menu',
  order: 'Order (delivery/pickup)',
  dine_in: 'Dine-in / table',
  reserve: 'Reservation',
  account: 'Customer account',
  content: 'Content page',
  external: 'External link',
  contact_channel: 'Phone / email',
  other: 'Other',
};

export const CTA_FULFILLMENT_LABELS: Record<CtaFulfillment, string> = {
  delivery: 'Delivery',
  pickup: 'Pickup',
  dine_in: 'Dine-in',
  reserve: 'Reservation',
  none: 'No fulfillment intent',
};

/** Classify a stored CTA destination into a reporting type + fulfillment intent. */
export function classifyCtaDestination(raw: string | undefined | null): {
  type: CtaDestinationType;
  fulfillment: CtaFulfillment;
} {
  const value = (raw ?? '').trim().toLowerCase();
  if (!value) return { type: 'other', fulfillment: 'none' };

  if (/^(tel:|mailto:)/.test(value)) return { type: 'contact_channel', fulfillment: 'none' };
  if (/^https?:\/\//.test(value)) return { type: 'external', fulfillment: 'none' };

  const [path, queryPart] = value.split('?');
  const query = queryPart ? `?${queryPart}` : '';
  const order = /(?:order|fulfillment|type)=([a-z-]+)/.exec(query)?.[1] ?? '';

  const fulfillment: CtaFulfillment =
    /^(delivery|deliver)$/.test(order) ? 'delivery'
      : /^(pickup|takeaway|takeout|collection)$/.test(order) ? 'pickup'
        : /^(dinein|dine-in|dine_in|table)$/.test(order) ? 'dine_in'
          : /reserve|booking/.test(value) ? 'reserve'
            : path.startsWith('/dine-in') ? 'dine_in'
              : 'none';

  if (path.startsWith('/dine-in')) return { type: 'dine_in', fulfillment: 'dine_in' };
  if (/reserve|booking/.test(value)) return { type: 'reserve', fulfillment: 'reserve' };
  if (path.startsWith('/menu')) {
    return { type: fulfillment === 'delivery' || fulfillment === 'pickup' ? 'order' : fulfillment === 'dine_in' ? 'dine_in' : 'menu', fulfillment };
  }
  if (path.startsWith('/account') || path.startsWith('/orders')) return { type: 'account', fulfillment: 'none' };
  if (/^\/(about|gallery|contact)/.test(path)) return { type: 'content', fulfillment: 'none' };
  return { type: 'other', fulfillment };
}
