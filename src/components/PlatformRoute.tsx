import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';

interface PlatformRouteProps {
  children: ReactNode;
}

/**
 * Gate for the /platform super-admin panel.
 * Verifies via server-side `is_platform_admin()` that the email is in the allowlist.
 */
export default function PlatformRoute({ children }: PlatformRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { isPlatformAdmin, loading } = usePlatformAdmin();

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/platform/login" replace />;
  if (!isPlatformAdmin) return <Navigate to="/platform/login" replace />;

  return <>{children}</>;
}
