-- Allow signed-in tenant users (restaurant admins, etc.) to view enabled mobile payment providers
-- so they can pick a payment method when buying a subscription.
DROP POLICY IF EXISTS "Mobile payment settings readable by anon" ON public.mobile_payment_settings;

CREATE POLICY "Enabled mobile payment settings readable by everyone"
ON public.mobile_payment_settings
FOR SELECT
TO anon, authenticated
USING (is_enabled = true);
