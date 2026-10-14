import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import {
  SUPPORTED_CURRENCIES,
  DEFAULT_PLATFORM_CURRENCY,
  isSupportedCurrency,
} from '@/lib/currency';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';

/**
 * Currencies the public plans are actually priced in: each plan's base
 * currency plus any currency with an authored price entry. The first entry
 * is the most common base currency (the sensible default).
 */
function pricedCurrencies(plans: SubscriptionPlan[] | undefined): string[] {
  const visible = (plans ?? []).filter((p) => p.is_public && p.is_active);
  const baseCounts = new Map<string, number>();
  const all = new Set<string>();
  for (const p of visible) {
    if (p.currency) {
      baseCounts.set(p.currency, (baseCounts.get(p.currency) ?? 0) + 1);
      all.add(p.currency);
    }
    for (const [code, entry] of Object.entries(p.prices ?? {})) {
      if (entry && (Number(entry.monthly) > 0 || Number(entry.yearly) > 0)) all.add(code);
    }
  }
  const base = [...baseCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const rest = [...all].filter((c) => c !== base && isSupportedCurrency(c)).sort();
  return base && isSupportedCurrency(base) ? [base, ...rest] : rest;
}

const STORAGE_KEY = 'platform-currency';

interface PlatformCurrencyContextValue {
  /** Currently selected ISO currency code (e.g. "USD"). */
  currency: string;
  /** Change the selected currency; persisted to localStorage. */
  setCurrency: (code: string) => void;
  /** The full list of supported currencies for rendering a switcher. */
  options: typeof SUPPORTED_CURRENCIES;
}

const PlatformCurrencyContext = createContext<PlatformCurrencyContextValue | null>(null);

function readStoredCurrency(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && isSupportedCurrency(stored)) return stored;
  } catch {
    /* ignore storage access errors */
  }
  return null;
}

/**
 * Provides the viewer-selected platform currency to marketing + billing UIs.
 * Selection is manual (no geolocation/FX) and persists across reloads.
 */
export function PlatformCurrencyProvider({ children }: { children: ReactNode }) {
  const [selected, setCurrencyState] = useState<string | null>(readStoredCurrency);
  const { data: plans } = useSubscriptionPlans();
  const priced = useMemo(() => pricedCurrencies(plans), [plans]);
  // Only offer currencies with real prices; otherwise fall back to the plans'
  // own currency so the switcher never claims a currency that isn't shown.
  const currency =
    priced.length === 0
      ? selected ?? DEFAULT_PLATFORM_CURRENCY
      : selected && priced.includes(selected) ? selected : priced[0];
  const options = useMemo(
    () => (priced.length === 0 ? SUPPORTED_CURRENCIES : SUPPORTED_CURRENCIES.filter((c) => priced.includes(c.code))),
    [priced],
  );

  const setCurrency = useCallback((code: string) => {
    if (!isSupportedCurrency(code)) return;
    setCurrencyState(code);
    try {
      window.localStorage.setItem(STORAGE_KEY, code);
    } catch {
      /* ignore storage write errors */
    }
  }, []);

  const value = useMemo<PlatformCurrencyContextValue>(
    () => ({ currency, setCurrency, options }),
    [currency, setCurrency, options],
  );

  return (
    <PlatformCurrencyContext.Provider value={value}>
      {children}
    </PlatformCurrencyContext.Provider>
  );
}

/**
 * Access the selected platform currency. Falls back to a safe default when
 * used outside the provider so non-marketing consumers never crash.
 */
export function usePlatformCurrency(): PlatformCurrencyContextValue {
  const ctx = useContext(PlatformCurrencyContext);
  if (ctx) return ctx;
  return {
    currency: DEFAULT_PLATFORM_CURRENCY,
    setCurrency: () => {},
    options: SUPPORTED_CURRENCIES,
  };
}
