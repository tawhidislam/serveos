-- Platform-wide settings for the SaaS (managed by platform admins)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  custom_domain_cname_target TEXT NOT NULL DEFAULT 'serve-joy.lovable.app',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read the public CNAME target so the setup guide works for tenants
CREATE POLICY "Platform settings readable by all"
ON public.platform_settings
FOR SELECT
USING (true);

-- Only platform admins can modify
CREATE POLICY "Platform admins manage platform settings"
ON public.platform_settings
FOR ALL
TO authenticated
USING (is_platform_admin())
WITH CHECK (is_platform_admin());

CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed the single settings row
INSERT INTO public.platform_settings (custom_domain_cname_target)
VALUES ('serve-joy.lovable.app')
ON CONFLICT DO NOTHING;