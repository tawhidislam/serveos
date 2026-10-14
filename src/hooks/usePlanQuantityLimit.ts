import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { usePlan } from '@/hooks/usePlan';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

export type QuantityLimitKey = 'maxMenuItems' | 'maxBranches' | 'maxStaff';

const TABLE_BY_KEY: Record<QuantityLimitKey, 'menu_items' | 'branches' | 'restaurant_members'> = {
  maxMenuItems: 'menu_items',
  maxBranches: 'branches',
  maxStaff: 'restaurant_members',
};

export interface QuantityLimitResult {
  /** Current count for this restaurant (null while loading). */
  current: number | null;
  /** Allowed maximum (null means unlimited). */
  limit: number | null;
  /** True when caller is allowed to create another row. */
  canCreate: boolean;
  /** True while we don't yet know — callers should treat as "wait". */
  isLoading: boolean;
}

/**
 * Counts existing rows for the current tenant and compares against the
 * resolved plan + add-on limits. Use to gate "Create" actions in the UI.
 */
export function usePlanQuantityLimit(key: QuantityLimitKey): QuantityLimitResult {
  const { data: plan, isLoading: planLoading } = usePlan();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const table = TABLE_BY_KEY[key];

  const { data: count, isLoading: countLoading } = useQuery({
    queryKey: ['plan-limit-count', table, restaurantId],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 15_000,
  });

  const limit = (plan?.limits[key] as number | null | undefined) ?? null;
  const isLoading = planLoading || countLoading || count == null;
  const current = count ?? null;
  const canCreate = isLoading
    ? true // optimistic: never block while still resolving
    : limit == null
      ? true
      : (current ?? 0) < limit;

  return { current, limit, canCreate, isLoading };
}