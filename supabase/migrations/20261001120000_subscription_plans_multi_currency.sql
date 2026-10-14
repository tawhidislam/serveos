-- Multi-currency pricing for subscription plans.
--
-- Adds a `prices` JSONB column that holds manually-authored prices per
-- currency code. The existing scalar columns (price_monthly, price_yearly,
-- original_price_monthly, original_price_yearly, currency) remain the
-- "base currency" fallback so any UI always has a number to render even
-- when a plan has no entry for the currently-selected currency.
--
-- Shape of `prices`:
--   {
--     "USD": { "monthly": 49, "yearly": 490, "original_monthly": 59, "original_yearly": 590 },
--     "BDT": { "monthly": 5900, "yearly": 59000, "original_monthly": null, "original_yearly": null },
--     ...
--   }
-- Any missing key inside a currency object is treated as "not set" and the
-- resolver falls back to the base-currency scalar columns.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS prices JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.subscription_plans.prices IS
  'Per-currency manually authored prices: { "<CODE>": { monthly, yearly, original_monthly, original_yearly } }. Base-currency scalar columns remain the fallback.';

-- Backfill: seed each plan''s `prices` with its current base currency so the
-- selected-currency path and the legacy path return identical numbers until
-- an admin authors additional currencies.
UPDATE public.subscription_plans
SET prices = jsonb_build_object(
  currency,
  jsonb_build_object(
    'monthly', price_monthly,
    'yearly', price_yearly,
    'original_monthly', original_price_monthly,
    'original_yearly', original_price_yearly
  )
)
WHERE prices = '{}'::jsonb OR prices IS NULL;
