import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const KEY = 'impersonation';

interface ImpersonationState {
  restaurantId: string;
  restaurantName: string;
  startedAt: number;
}

interface ImpersonationContextValue {
  active: ImpersonationState | null;
  /**
   * Switch into a tenant. Resolves only after the React Query cache for
   * `current-restaurant` has been refreshed and every tenant-scoped query
   * has been invalidated, so callers can safely navigate without showing
   * data from the previous restaurant.
   */
  startImpersonation: (restaurantId: string, restaurantName: string) => Promise<void>;
  /** Exit impersonation; resolves once the cache has resynced. */
  stopImpersonation: () => Promise<void>;
  /** True while a switch is in flight — UI should disable triggers. */
  isSwitching: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextValue | undefined>(undefined);

function read(): ImpersonationState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    return null;
  }
}

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ImpersonationState | null>(() => read());
  const [isSwitching, setIsSwitching] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const onStorage = () => setActive(read());
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  /**
   * Drop every tenant-scoped query from the cache and force the
   * `current-restaurant` resolver to refetch. This guarantees that any
   * component using a `restaurant_id`-bound query won't render stale data
   * for the previous tenant after a switch.
   *
   * We `removeQueries` (not just invalidate) so that suspended/visible
   * components don't briefly paint cached results from the old tenant
   * before the refetch completes.
   */
  const resyncTenantCache = useCallback(async () => {
    // Wipe everything keyed off the previous restaurant context.
    qc.removeQueries({ queryKey: ['current-restaurant'] });
    qc.removeQueries({ queryKey: ['active-restaurant-id'] });
    // Invalidate the broader app cache so every dependent query refetches
    // once the new current-restaurant resolves. This is intentionally wide
    // because queries across the app derive `restaurantId` from the hook.
    await qc.invalidateQueries();
    // Wait for the new current-restaurant query to settle so the UI
    // doesn't navigate before the tenant id is observable.
    try {
      await qc.refetchQueries({ queryKey: ['current-restaurant'], type: 'active' });
    } catch {
      /* refetch failures will surface in the UI's normal error path */
    }
  }, [qc]);

  const startImpersonation = useCallback(
    async (restaurantId: string, restaurantName: string) => {
      if (isSwitching) return;
      setIsSwitching(true);
      try {
        const state: ImpersonationState = {
          restaurantId,
          restaurantName,
          startedAt: Date.now(),
        };
        sessionStorage.setItem(KEY, JSON.stringify(state));
        setActive(state);
        await resyncTenantCache();
      } finally {
        setIsSwitching(false);
      }
    },
    [isSwitching, resyncTenantCache],
  );

  const stopImpersonation = useCallback(async () => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      sessionStorage.removeItem(KEY);
      setActive(null);
      await resyncTenantCache();
    } finally {
      setIsSwitching(false);
    }
  }, [isSwitching, resyncTenantCache]);

  return (
    <ImpersonationContext.Provider
      value={{ active, startImpersonation, stopImpersonation, isSwitching }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const ctx = useContext(ImpersonationContext);
  if (!ctx) throw new Error('useImpersonation must be used within ImpersonationProvider');
  return ctx;
}
