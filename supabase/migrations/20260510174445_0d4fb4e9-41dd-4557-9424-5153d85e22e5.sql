
ALTER TABLE public.restaurant_custom_domains
  ADD COLUMN IF NOT EXISTS verification_token text NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  ADD COLUMN IF NOT EXISTS last_check_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_check_error text;

-- Make sure every row has a token (covers any pre-existing rows where DEFAULT didn't fire)
UPDATE public.restaurant_custom_domains
SET verification_token = encode(gen_random_bytes(16), 'hex')
WHERE verification_token IS NULL OR verification_token = '';
