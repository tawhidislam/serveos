import { ReactNode } from 'react';
import { useCustomDomainRestaurant } from '@/hooks/useCustomDomainRestaurant';

interface Props {
  /** Rendered when the current hostname IS a verified tenant custom domain. */
  tenant: ReactNode;
  /** Rendered when the hostname is the platform/marketing/dev host (or no match). */
  platform: ReactNode;
  /** Optional fallback while the lookup is in flight on a non-platform host. */
  loading?: ReactNode;
}

/**
 * Routes the same path to either the tenant's site or the SaaS marketing site
 * based on the current hostname. Used to make `/`, `/about`, `/gallery`,
 * `/contact` resolve to the tenant when visited via their custom domain.
 */
export default function CustomDomainGate({ tenant, platform, loading }: Props) {
  const { data: restaurant, isLoading, isError, fetchStatus } = useCustomDomainRestaurant();

  // Query disabled on platform hosts → fetchStatus 'idle' + data undefined → render marketing.
  if (fetchStatus === 'idle' && restaurant === undefined) {
    return <>{platform}</>;
  }

  if (isLoading) {
    return (
      <>
        {loading ?? (
          <div className="min-h-screen flex items-center justify-center bg-background">
            <div className="h-8 w-8 rounded-full border-2 border-foreground border-t-transparent animate-spin" />
          </div>
        )}
      </>
    );
  }

  if (isError || !restaurant) return <>{platform}</>;
  return <>{tenant}</>;
}
