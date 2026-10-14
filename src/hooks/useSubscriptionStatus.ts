import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

export interface SubscriptionStatusResult {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  /**
   * True when the subscription should block access:
   * - status is 'expired' or 'canceled', OR
   * - the plan is paid (not 'free') and current_period_end is in the past
   */
  isExpired: boolean;
}

/** Fetches the current restaurant's subscription state and computes whether it has expired. */
export function useSubscriptionStatus() {
  const { data: restaurant } = useCurrentRestaurant();

  return useQuery<SubscriptionStatusResult>({
    queryKey: ['subscription-status', restaurant?.id ?? 'none'],
    enabled: !!restaurant?.id,
    staleTime: 30_000,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('restaurant_id', restaurant!.id)
        .maybeSingle();
      if (error) throw error;

      const plan = (data?.plan ?? 'free') as string;
      const status = (data?.status ?? 'trialing') as string;
      const currentPeriodEnd = (data?.current_period_end ?? null) as string | null;

      const explicitlyExpired = status === 'expired' || status === 'canceled';
      const periodLapsed =
        plan !== 'free' &&
        !!currentPeriodEnd &&
        new Date(currentPeriodEnd).getTime() <= Date.now();

      return {
        plan,
        status,
        currentPeriodEnd,
        isExpired: explicitlyExpired || periodLapsed,
      };
    },
  });
}