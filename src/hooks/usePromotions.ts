import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

export interface Promotion {
  id: string;
  name: string;
  description: string | null;
  type: string; // percentage, fixed, happy_hour, first_order
  discount_value: number;
  promo_code: string | null;
  min_order_amount: number;
  max_discount_amount: number | null;
  max_uses: number | null;
  used_count: number;
  max_uses_per_user: number | null;
  applies_to: string; // order, category, item
  applies_to_ids: string[] | null;
  happy_hour_start: string | null;
  happy_hour_end: string | null;
  happy_hour_days: number[] | null;
  is_first_order_only: boolean;
  is_active: boolean;
  starts_at: string;
  ends_at: string | null;
  branch_id: string | null;
  created_at: string;
  updated_at: string;
}

export function usePromotions() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['promotions', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotions' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Promotion[];
    },
  });
}

export function useActivePromotions() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['promotions_active', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('promotions' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .lte('starts_at', now)
        .order('created_at', { ascending: false });
      if (error) throw error;
      // Filter client-side for ends_at (could be null = no end)
      return ((data || []) as unknown as Promotion[]).filter(p =>
        !p.ends_at || new Date(p.ends_at) > new Date()
      );
    },
  });
}

export function isHappyHourActive(promo: Promotion): boolean {
  if (promo.type !== 'happy_hour') return true;
  const now = new Date();
  const day = now.getDay();
  if (promo.happy_hour_days && !promo.happy_hour_days.includes(day)) return false;
  if (!promo.happy_hour_start || !promo.happy_hour_end) return false;
  const timeStr = now.toTimeString().slice(0, 5);
  return timeStr >= promo.happy_hour_start.slice(0, 5) && timeStr <= promo.happy_hour_end.slice(0, 5);
}

export function calculateDiscount(promo: Promotion, orderTotal: number): number {
  if (orderTotal < (promo.min_order_amount || 0)) return 0;
  if (promo.max_uses && promo.used_count >= promo.max_uses) return 0;

  let discount = 0;
  if (promo.type === 'percentage' || promo.type === 'happy_hour' || promo.type === 'first_order') {
    discount = orderTotal * (promo.discount_value / 100);
    if (promo.max_discount_amount) discount = Math.min(discount, promo.max_discount_amount);
  } else if (promo.type === 'fixed') {
    discount = Math.min(promo.discount_value, orderTotal);
  }
  return Math.round(discount * 100) / 100;
}
