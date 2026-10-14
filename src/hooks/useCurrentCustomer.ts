import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Resolves the current user's customer row in a specific restaurant.
 * Returns null if the user is not a customer of that restaurant.
 */
export function useCurrentCustomer(restaurantId: string | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['restaurant-customer', restaurantId, user?.id],
    enabled: !!restaurantId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_customers')
        .select('id, email, display_name, phone, restaurant_id')
        .eq('restaurant_id', restaurantId!)
        .eq('auth_user_id', user!.id)
        .maybeSingle();
      return data;
    },
  });
}
