import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

export interface CustomizationTag {
  id: string;
  name: string;
  category: string;
  emoji: string;
  color: string;
  is_active: boolean;
  sort_order: number;
}

export function useCustomizationTags() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['customization_tags', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customization_tags' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as CustomizationTag[];
    },
  });
}

export function useActiveCustomizationTags() {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  return useQuery({
    queryKey: ['customization_tags_active', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customization_tags' as any)
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .eq('is_active', true)
        .order('sort_order');
      if (error) throw error;
      return (data || []) as unknown as CustomizationTag[];
    },
  });
}

/** Group tags by category */
export function groupTagsByCategory(tags: CustomizationTag[]): Record<string, CustomizationTag[]> {
  return tags.reduce((acc, tag) => {
    if (!acc[tag.category]) acc[tag.category] = [];
    acc[tag.category].push(tag);
    return acc;
  }, {} as Record<string, CustomizationTag[]>);
}
