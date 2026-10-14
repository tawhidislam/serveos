import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MarketingSection } from '@/lib/marketing-sections';

export function useMarketingSections(pageKey: string) {
  return useQuery<MarketingSection[]>({
    queryKey: ['marketing-sections', pageKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_page_sections')
        .select('*')
        .eq('page_key', pageKey)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarketingSection[];
    },
  });
}
