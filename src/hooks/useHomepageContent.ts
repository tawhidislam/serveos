import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HomepageContent {
  hero: {
    overline: string;
    heading_line1: string;
    heading_line2: string;
    description: string;
    cta_primary_text: string;
    cta_primary_link: string;
    cta_secondary_text: string;
    cta_secondary_link: string;
    show_rating: boolean;
    show_stats: boolean;
  };
  stats: {
    items: { value: string; label: string; icon: string }[];
  };
  story: {
    overline: string;
    heading_line1: string;
    heading_line2: string;
    paragraph1: string;
    paragraph2: string;
    cta_text: string;
    cta_link: string;
    badge_value: string;
    badge_label: string;
  };
  cta: {
    overline: string;
    heading_line1: string;
    heading_line2: string;
    description: string;
    cta_primary_text: string;
    cta_primary_link: string;
    cta_secondary_text: string;
    cta_secondary_link: string;
  };
}

export function useHomepageContent(restaurantId?: string | null) {
  return useQuery({
    queryKey: ['homepage-content', restaurantId ?? 'none'],
    queryFn: async () => {
      // Never query without a tenant scope. `homepage_content` has a public
      // SELECT policy, so an unfiltered query would return rows from every
      // restaurant and mix their section_keys together (last write wins).
      if (!restaurantId) return {} as HomepageContent;

      const { data, error } = await supabase
        .from('homepage_content')
        .select('section_key, content')
        .eq('restaurant_id', restaurantId);
      if (error) throw error;

      const content: Record<string, unknown> = {};
      for (const row of data || []) {
        content[row.section_key] = row.content;
      }
      return content as unknown as HomepageContent;
    },
    enabled: !!restaurantId,
  });
}
