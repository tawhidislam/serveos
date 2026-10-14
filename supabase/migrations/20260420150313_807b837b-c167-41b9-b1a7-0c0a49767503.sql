-- Mobile payment providers (bkash / nagad / rocket / future)
CREATE TABLE IF NOT EXISTS public.mobile_payment_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,            -- 'bkash' | 'nagad' | 'rocket'
  display_name TEXT NOT NULL,               -- 'bKash', 'Nagad', 'Rocket'
  receiver_number TEXT NOT NULL DEFAULT '',
  account_type TEXT NOT NULL DEFAULT 'personal',  -- merchant | personal | agent
  instructions TEXT,
  reference_prefix TEXT DEFAULT 'SUB',
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mobile_payment_provider_chk CHECK (provider IN ('bkash','nagad','rocket'))
);

ALTER TABLE public.mobile_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mobile payment settings readable by all authenticated"
ON public.mobile_payment_settings
FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Mobile payment settings readable by anon"
ON public.mobile_payment_settings
FOR SELECT TO anon
USING (is_enabled = true);

CREATE POLICY "Platform admins manage mobile payment settings"
ON public.mobile_payment_settings
FOR ALL TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_mobile_payment_settings_updated
BEFORE UPDATE ON public.mobile_payment_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed three providers, importing existing bKash row if present
INSERT INTO public.mobile_payment_settings (provider, display_name, receiver_number, account_type, instructions, reference_prefix, is_enabled, sort_order)
SELECT
  'bkash',
  'bKash',
  COALESCE(bs.merchant_number, ''),
  COALESCE(bs.account_type, 'personal'),
  COALESCE(bs.instructions, 'Send Money to the bKash number above, then submit the Transaction ID (TrxID) below. Your subscription will be activated within 24 hours after verification.'),
  COALESCE(bs.reference_prefix, 'SUB'),
  COALESCE(bs.is_enabled, true),
  10
FROM (SELECT * FROM public.bkash_settings LIMIT 1) bs
ON CONFLICT (provider) DO NOTHING;

-- If no bkash_settings row existed, still ensure a bkash row
INSERT INTO public.mobile_payment_settings (provider, display_name, receiver_number, account_type, instructions, reference_prefix, is_enabled, sort_order)
VALUES ('bkash', 'bKash', '', 'personal',
  'Send Money to the bKash number above, then submit the Transaction ID (TrxID) below. Your subscription will be activated within 24 hours after verification.',
  'SUB', false, 10)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO public.mobile_payment_settings (provider, display_name, receiver_number, account_type, instructions, reference_prefix, is_enabled, sort_order)
VALUES ('nagad', 'Nagad', '', 'personal',
  'Send Money to the Nagad number above, then submit the Transaction ID (TrxID) below. Your subscription will be activated within 24 hours after verification.',
  'SUB', false, 20)
ON CONFLICT (provider) DO NOTHING;

INSERT INTO public.mobile_payment_settings (provider, display_name, receiver_number, account_type, instructions, reference_prefix, is_enabled, sort_order)
VALUES ('rocket', 'Rocket', '', 'personal',
  'Send Money to the Rocket number above, then submit the Transaction ID (TrxID) below. Your subscription will be activated within 24 hours after verification.',
  'SUB', false, 30)
ON CONFLICT (provider) DO NOTHING;