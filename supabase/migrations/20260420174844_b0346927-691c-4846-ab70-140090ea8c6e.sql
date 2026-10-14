ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS custom_domain_a_record_ip text NOT NULL DEFAULT '76.76.21.21';