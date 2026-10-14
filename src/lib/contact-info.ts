/**
 * Shared helpers for displaying restaurant contact details (phone + address)
 * consistently across the public website: homepage templates, CTA sections
 * and the footer.
 *
 * Resolution order is always: homepage editor content → restaurant settings →
 * the restaurant record itself. Blank strings are treated as missing so a
 * cleared field falls through to the next source instead of rendering empty.
 */

export type ContactSource = {
  phone?: string | null;
  address?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  email?: string | null;
};

export type ResolvedContact = {
  /** Formatted, display-ready phone number (or undefined). */
  phone?: string;
  /** `tel:` href for the phone number (or undefined). */
  phoneHref?: string;
  /** Dialable phone number (digits with optional leading `+`), for structured data. */
  phoneDial?: string;
  /** Full address on one line. */
  address?: string;
  /** Address split into display lines. */
  addressLines: string[];
  /** Google Maps link for the address. */
  mapsHref?: string;
  email?: string;
  emailHref?: string;
};

/** schema.org PostalAddress shape. */
export type PostalAddressLd = {
  '@type': 'PostalAddress';
  streetAddress?: string;
  addressLocality?: string;
  addressRegion?: string;
  postalCode?: string;
  addressCountry?: string;
};


/** Trim a value and treat blanks as missing. */
export function clean(value?: string | null): string | undefined {
  const t = typeof value === 'string' ? value.trim() : '';
  return t.length > 0 ? t : undefined;
}

/** First non-blank value from the provided candidates. */
export function firstFilled(...values: Array<string | null | undefined>): string | undefined {
  for (const v of values) {
    const c = clean(v);
    if (c) return c;
  }
  return undefined;
}

/**
 * Normalise a phone number for display: collapse whitespace, keep a leading
 * `+`, and drop stray separators so numbers entered in different formats all
 * render the same way.
 */
export function formatPhoneDisplay(value?: string | null): string | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  const compact = raw.replace(/\s+/g, ' ').replace(/\s*([-().])\s*/g, '$1').trim();
  const digits = compact.replace(/[^\d]/g, '');
  const plus = compact.trim().startsWith('+');

  // US/CA style 10-digit numbers get the familiar grouping.
  if (!plus && digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  // Bangladeshi mobile numbers (01XXXXXXXXX).
  if (!plus && digits.length === 11 && digits.startsWith('01')) {
    return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (plus && digits.length > 6) {
    return `+${digits.slice(0, digits.length - 6)} ${digits.slice(-6, -3)} ${digits.slice(-3)}`;
  }
  return compact;
}

/** `tel:` href with only dialable characters. */
export function phoneHref(value?: string | null): string | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  const dial = (raw.startsWith('+') ? '+' : '') + raw.replace(/[^\d]/g, '');
  return dial.length > 1 ? `tel:${dial}` : undefined;
}

/** Dialable form of a phone number (`+` plus digits), for schema.org telephone. */

export function phoneDial(value?: string | null): string | undefined {
  const raw = clean(value);
  if (!raw) return undefined;
  const dial = (raw.startsWith('+') ? '+' : '') + raw.replace(/[^\d]/g, '');
  return dial.replace(/[^\d]/g, '').length > 4 ? dial : undefined;
}

/**
 * Split a free-text address into a schema.org PostalAddress. Users type a
 * single line, so we infer parts from comma-separated segments and look for a
 * trailing postal code / region in the last locality segment.
 */
export function toPostalAddress(address?: string | null): PostalAddressLd | undefined {
  const full = clean(address);
  if (!full) return undefined;

  const parts = full
    .split(/\r?\n|,/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  const out: PostalAddressLd = { '@type': 'PostalAddress' };

  // A short final segment with no digits is most likely a country.
  const last = parts[parts.length - 1];
  if (parts.length >= 3 && !/\d/.test(last) && last.length <= 40) {
    out.addressCountry = last;
    parts.pop();
  }

  out.streetAddress = parts.shift();

  if (parts.length > 0) {
    let locality = parts.shift() as string;
    // Trailing postal code, e.g. "Dhaka 1207" or "Springfield IL 62704".
    const zip = locality.match(/\s([A-Z0-9][A-Z0-9\- ]{2,9})$/i);
    if (zip && /\d/.test(zip[1])) {
      out.postalCode = zip[1].trim();
      locality = locality.slice(0, zip.index).trim();
    }
    const region = locality.match(/\s([A-Z]{2})$/);
    if (region) {
      out.addressRegion = region[1];
      locality = locality.slice(0, region.index).trim();
    }
    if (locality) out.addressLocality = locality;
  }

  if (parts.length > 0) {
    // Anything left over is region-ish detail.
    out.addressRegion = out.addressRegion || parts.join(', ');
  }

  return out;
}

/**
 * Split an address into display lines. Explicit line1/line2 win; otherwise a
 * single-field address is split on commas / newlines into at most two lines.
 */
export function formatAddressLines(source: ContactSource): string[] {
  const line1 = clean(source.address_line1);
  const line2 = clean(source.address_line2);
  if (line1 || line2) return [line1, line2].filter(Boolean) as string[];

  const full = clean(source.address);
  if (!full) return [];


  const parts = full
    .split(/\r?\n|,/)
    .map(p => p.trim())
    .filter(Boolean);
  if (parts.length <= 1) return [full];
  return [parts[0], parts.slice(1).join(', ')];
}

/** Whole address on a single line. */
export function formatAddress(source: ContactSource): string | undefined {
  const lines = formatAddressLines(source);
  return lines.length > 0 ? lines.join(', ') : undefined;
}

/** Google Maps search link for the address. */
export function mapsHref(address?: string | null): string | undefined {
  const a = clean(address);
  return a ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a)}` : undefined;
}

/**
 * Merge contact details from the homepage editor, restaurant settings and the
 * restaurant record into one display-ready object.
 */
export function resolveContact(...sources: Array<ContactSource | null | undefined>): ResolvedContact {
  const list = sources.filter(Boolean) as ContactSource[];

  const rawPhone = firstFilled(...list.map(s => s.phone));
  const addressSource: ContactSource = {
    address_line1: firstFilled(...list.map(s => s.address_line1)),
    address_line2: firstFilled(...list.map(s => s.address_line2)),
    address: firstFilled(...list.map(s => s.address)),
  };
  // Only use the split lines when at least line1 exists; otherwise fall back
  // to the single-field address so a stray line2 never renders alone.
  if (!addressSource.address_line1) addressSource.address_line2 = undefined;

  const addressLines = formatAddressLines(addressSource);
  const address = addressLines.length > 0 ? addressLines.join(', ') : undefined;
  const email = firstFilled(...list.map(s => s.email));

  return {
    phone: formatPhoneDisplay(rawPhone),
    phoneHref: phoneHref(rawPhone),
    phoneDial: phoneDial(rawPhone),
    address,
    addressLines,

    mapsHref: mapsHref(address),
    email,
    emailHref: email ? `mailto:${email}` : undefined,
  };
}

/**
 * Validate a user-entered phone number. Returns an error message when the
 * value would produce a broken `tel:` link or invalid schema.org telephone.
 */
export function validatePhoneInput(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined; // optional field
  if (raw.length > 40) return 'Phone number is too long (max 40 characters).';
  if (/[^\d+()\-.\s]/.test(raw)) {
    return 'Phone number can only contain digits, spaces and + ( ) - . characters.';
  }
  if (raw.indexOf('+') > 0 || (raw.match(/\+/g) || []).length > 1) {
    return 'The + country prefix must appear once, at the start.';
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 6) return 'Phone number looks too short.';
  if (digits.length > 15) return 'Phone number looks too long.';
  return undefined;
}

/**
 * Validate a user-entered address. Keeps structured data sane by rejecting
 * empty-ish, overlong or markup-bearing values.
 */
export function validateAddressInput(value: string): string | undefined {
  const raw = value.trim();
  if (!raw) return undefined; // optional field
  if (raw.length < 5) return 'Address looks too short — add the street and city.';
  if (raw.length > 200) return 'Address is too long (max 200 characters).';
  if (/[<>{}]/.test(raw)) return 'Address cannot contain < > { } characters.';
  if (!/[a-zA-Z\u0080-\uFFFF]/.test(raw)) return 'Address must include the street or city name.';
  return undefined;
}

/** Tidy a phone number for storage: collapse spaces, drop duplicate separators. */
export function normalizePhoneInput(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/([-().])\1+/g, '$1').trim();
}

/** Tidy an address for storage: collapse whitespace and comma spacing. */
export function normalizeAddressInput(value: string): string {
  return value
    .replace(/\s*\n\s*/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/,\s*,+/g, ', ')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
}
