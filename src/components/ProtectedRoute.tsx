import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useImpersonation } from '@/hooks/useImpersonation';
import { useAuth, AppRole } from '@/hooks/useAuth';

const STAFF_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server'];

interface ProtectedRouteProps {
  children: ReactNode;
  /** If provided, user must have at least one of these roles */
  allowedRoles?: AppRole[];
  /** Where to redirect if not authenticated (default: staff routes → /staff-login, else /auth) */
  authRedirect?: string;
  /** Where to redirect if authenticated but lacking role (default: /) */
  roleRedirect?: string;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  authRedirect,
  roleRedirect = '/',
}: ProtectedRouteProps) {
  const { user, loading, hasAnyRole } = useAuth();
  const { active, isSwitching } = useImpersonation();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const viewingAsOwner = !!active && isPlatformAdmin && !!allowedRoles?.includes('owner');
  const location = useLocation();

  if (loading || (user && active && platformLoading) || (isSwitching && isPlatformAdmin)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Staff-only routes (admin, kitchen, waiter, owner…) must send people to the
  // staff sign-in page — /auth is the per-restaurant *customer* login and will
  // fail with "No customer account for …".
  const isStaffRoute = !!allowedRoles?.some((r) => STAFF_ROLES.includes(r));

  // Keep the tenant in context: on /r/:slug/* routes the sign-in page must stay
  // slug-prefixed, otherwise the customer login loses the restaurant and shows
  // "No restaurant detected".
  const slugMatch = location.pathname.match(/^\/r\/([^/]+)/);
  const tenantPrefix = slugMatch ? `/r/${slugMatch[1]}` : '';
  const defaultFallback = isStaffRoute
    ? `${tenantPrefix}/staff-login`
    : `${tenantPrefix}${tenantPrefix ? '/login' : '/auth'}`;
  const fallback = authRedirect ?? defaultFallback;

  if (!user) {
    const redirect = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`${fallback}?redirect=${redirect}`} replace />;
  }


  if (allowedRoles && allowedRoles.length > 0 && !hasAnyRole(allowedRoles) && !viewingAsOwner) {
    return <Navigate to={roleRedirect} replace />;
  }

  return <>{children}</>;
}

