-- bKash global settings (single row, managed by platform admins)
CREATE TABLE public.bkash_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_number text NOT NULL DEFAULT '',
  account_type text NOT NULL DEFAULT 'merchant', -- 'merchant' | 'personal' | 'agent'
  instructions text DEFAULT 'Send Money to the bKash number above, then submit the Transaction ID (TrxID) below. Your subscription will be activated within 24 hours after verification.',
  is_enabled boolean NOT NULL DEFAULT true,
  reference_prefix text DEFAULT 'SUB',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bkash_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bKash settings readable by all authenticated"
  ON public.bkash_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins manage bKash settings"
  ON public.bkash_settings FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE TRIGGER trg_bkash_settings_updated
  BEFORE UPDATE ON public.bkash_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default row
INSERT INTO public.bkash_settings (merchant_number, account_type) VALUES ('', 'merchant');

-- Subscription payment submissions
CREATE TABLE public.subscription_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  submitted_by uuid,
  plan public.plan_tier NOT NULL,
  billing_cycle text NOT NULL DEFAULT 'monthly', -- 'monthly' | 'yearly'
  amount numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'BDT',
  payment_method text NOT NULL DEFAULT 'bkash',
  sender_number text NOT NULL,
  transaction_id text NOT NULL,
  reference_code text,
  notes text,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  admin_notes text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscription_payments_restaurant ON public.subscription_payments(restaurant_id);
CREATE INDEX idx_subscription_payments_status ON public.subscription_payments(status);
CREATE UNIQUE INDEX idx_subscription_payments_trxid ON public.subscription_payments(LOWER(transaction_id));

ALTER TABLE public.subscription_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins manage all subscription payments"
  ON public.subscription_payments FOR ALL
  TO authenticated
  USING (is_platform_admin())
  WITH CHECK (is_platform_admin());

CREATE POLICY "Tenant members view own subscription payments"
  ON public.subscription_payments FOR SELECT
  TO authenticated
  USING (restaurant_id = current_restaurant_id());

CREATE POLICY "Tenant members create subscription payments"
  ON public.subscription_payments FOR INSERT
  TO authenticated
  WITH CHECK (
    restaurant_id = current_restaurant_id()
    AND submitted_by = auth.uid()
    AND status = 'pending'
  );

CREATE TRIGGER trg_subscription_payments_updated
  BEFORE UPDATE ON public.subscription_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();