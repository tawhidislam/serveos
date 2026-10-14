import { useSettings } from '@/hooks/useSettings';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CAD: 'CA$',
  AUD: 'A$',
  INR: '₹',
  BRL: 'R$',
  MXN: 'MX$',
  AED: 'د.إ',
  BDT: '৳',
};

/** Human-readable names for the supported currencies, used by the switcher UI. */
const CURRENCY_NAMES: Record<string, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  CAD: 'Canadian Dollar',
  AUD: 'Australian Dollar',
  INR: 'Indian Rupee',
  BRL: 'Brazilian Real',
  MXN: 'Mexican Peso',
  AED: 'UAE Dirham',
  BDT: 'Bangladeshi Taka',
};

export interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

/** The full list of platform-supported currencies for the marketing switcher. */
export const SUPPORTED_CURRENCIES: CurrencyOption[] = Object.keys(CURRENCY_SYMBOLS).map(
  (code) => ({ code, symbol: CURRENCY_SYMBOLS[code], name: CURRENCY_NAMES[code] ?? code }),
);

/** Default currency for the platform marketing site before the viewer picks one. */
export const DEFAULT_PLATFORM_CURRENCY = 'USD';

/** True when `code` is one of the platform-supported currencies. */
export function isSupportedCurrency(code: string | null | undefined): boolean {
  return !!code && code in CURRENCY_SYMBOLS;
}

/**
 * Format a plan price as a compact integer with the currency symbol
 * (e.g. "$1,200" / "৳1,200") — matches the marketing pricing style.
 */
export function formatPlanPrice(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  const n = Number.isFinite(amount) ? amount : 0;
  return `${symbol}${Math.round(n).toLocaleString()}`;
}

export function getCurrencySymbol(code: string): string {
  return CURRENCY_SYMBOLS[code] ?? code;
}

/** Format a number as currency string */
export function formatPrice(amount: number, currencyCode: string): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}

/**
 * Format an amount using the given currency code's symbol.
 * Tolerates string/null/undefined inputs (defaults to 0) and
 * always renders with two decimal places. Use this for any
 * admin-facing money display tied to an entity's stored currency.
 */
export function formatMoney(
  currency: string,
  amount: number | string | null | undefined,
): string {
  const n = Number(amount ?? 0);
  return `${getCurrencySymbol(currency)}${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

/** Hook that returns a price formatter using current settings */
export function useCurrency() {
  const { data: settings } = useSettings();
  const code = settings?.currency ?? 'USD';
  const symbol = getCurrencySymbol(code);

  const format = (amount: number) => `${symbol}${amount.toFixed(2)}`;
  const formatInt = (amount: number) => `${symbol}${amount.toFixed(0)}`;

  return { symbol, code, format, formatInt };
}
