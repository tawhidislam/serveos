import { supabase } from '@/integrations/supabase/client';

// The CNAME target is the platform setting `custom_domain_cname_target`
// (Platform → Settings); read it with useCustomDomainCnameTarget().

/** TXT record name (without the domain) proving domain ownership. */
export const DOMAIN_VERIFY_TXT_PREFIX = '_serveos-verify';

type DomainAction =
  | { action: 'verify'; domainId: string }
  | { action: 'remove'; domainId: string }
  | { action: 'set_verified'; domainId: string; verified: boolean };

export interface DomainActionResult {
  ok: boolean;
  verified?: boolean;
  reason?: string | null;
}

/**
 * Verify, remove, or (platform admin) force-verify a custom domain. Goes
 * through the edge function so the Cloudflare custom hostname stays in sync —
 * never write `verified` or delete rows directly.
 */
export async function customDomainAction(body: DomainAction): Promise<DomainActionResult> {
  const { data, error } = await supabase.functions.invoke('tenant-verify-custom-domain', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data as DomainActionResult;
}
