import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function useKitchenUpdates(restaurantId: string | undefined, orderIds: string[]) {
  const client = useQueryClient();
  const ids = [...orderIds].sort();
  const query = useQuery({
    queryKey: ['kitchen_updates', restaurantId, ids.join(',')],
    enabled: !!restaurantId && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('kitchen_updates').select('*').eq('restaurant_id', restaurantId!).in('order_id', ids).order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
    refetchInterval: 5000,
  });
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase.channel(`kitchen-messages-${restaurantId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'kitchen_updates', filter: `restaurant_id=eq.${restaurantId}` }, () => {
      void client.invalidateQueries({ queryKey: ['kitchen_updates', restaurantId] });
      void client.invalidateQueries({ queryKey: ['kitchen_thread', restaurantId] });
    }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [client, restaurantId]);
  const messages = query.data;
  const latest = useMemo(() => {
    const result = new Map<string, NonNullable<typeof messages>[number]>();
    for (const message of messages ?? []) if (!result.has(message.order_id)) result.set(message.order_id, message);
    return result;
  }, [messages]);
  return { ...query, latest };
}
