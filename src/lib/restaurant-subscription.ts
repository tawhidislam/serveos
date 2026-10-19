import { supabase } from '@/integrations/supabase/client';

/** Read the same restaurant entitlement for owners and staff, without billing data. */
export async function fetchRestaurantSubscription(restaurantId: string) {
  const { data, error } = await supabase.rpc('get_restaurant_subscription_access', {
    _restaurant_id: restaurantId,
  }).maybeSingle();
  if (error) throw error;
  return data;
}
