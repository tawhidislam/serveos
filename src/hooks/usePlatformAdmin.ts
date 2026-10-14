import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Returns whether the current authenticated user is a platform super-admin.
 * Backed by the server-side `is_platform_admin()` SQL function which checks
 * the `platform_admins` allowlist table by email.
 */
export function usePlatformAdmin() {
  const { user, loading: authLoading } = useAuth();

  const query = useQuery({
    queryKey: ['platform-admin', user?.id],
    enabled: !!user,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('is_platform_admin');
      if (error) throw error;
      return data === true;
    },
  });

  return {
    isPlatformAdmin: query.data === true,
    loading: authLoading || query.isLoading,
  };
}
