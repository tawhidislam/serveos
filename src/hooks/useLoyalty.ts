import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

export interface LoyaltySettings {
  id: string;
  is_enabled: boolean;
  earn_type: 'per_order' | 'per_currency';
  points_per_order: number;
  points_per_currency: number;
  redemption_type: 'flexible' | 'tiers';
  point_value: number;
  min_redeem_points: number;
  redemption_tiers: { points: number; discount: number }[];
  expiry_enabled: boolean;
  expiry_days: number;
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  points: number;
  type: 'earn' | 'redeem' | 'expire' | 'adjust';
  order_id: string | null;
  description: string | null;
  expires_at: string | null;
  created_at: string;
}

export function useLoyaltySettings() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['loyalty_settings', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_settings' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as LoyaltySettings;
    },
  });
}

export function useLoyaltyBalance(userId: string | undefined) {
  // Points are earned and redeemed per restaurant, so show the balance for the
  // restaurant being viewed (all restaurants when there isn't one).
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id ?? null;
  return useQuery({
    queryKey: ['loyalty_balance', userId, restaurantId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_loyalty_balance', {
        _user_id: userId!,
        _restaurant_id: restaurantId,
      });
      if (error) throw error;
      return (data ?? 0) as number;
    },
    enabled: !!userId,
  });
}

export function useLoyaltyTransactions(userId: string | undefined) {
  return useQuery({
    queryKey: ['loyalty_transactions', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_transactions' as any)
        .select('*')
        .eq('user_id', userId!)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as LoyaltyTransaction[];
    },
    enabled: !!userId,
  });
}

/** Calculate points earned for a given order total */
export function calculateEarnedPoints(settings: LoyaltySettings, orderTotal: number): number {
  if (!settings.is_enabled) return 0;
  if (settings.earn_type === 'per_order') return settings.points_per_order;
  return Math.floor(orderTotal * settings.points_per_currency);
}

/** Calculate discount for a given number of points being redeemed */
export function calculateRedemptionDiscount(settings: LoyaltySettings, points: number): number {
  if (!settings.is_enabled) return 0;
  if (settings.redemption_type === 'flexible') {
    return Math.round(points * settings.point_value * 100) / 100;
  }
  // Tiers: find best tier that user can afford
  const sortedTiers = [...settings.redemption_tiers].sort((a, b) => b.points - a.points);
  const tier = sortedTiers.find(t => points >= t.points);
  return tier ? tier.discount : 0;
}

/** Get available redemption tiers the user can afford */
export function getAvailableTiers(settings: LoyaltySettings, balance: number) {
  if (settings.redemption_type !== 'tiers') return [];
  return settings.redemption_tiers
    .filter(t => balance >= t.points)
    .sort((a, b) => b.points - a.points);
}
