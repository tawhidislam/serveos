import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { ChefHat } from 'lucide-react';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';

export default function GalleryPage() {
  const { restaurantId } = useResolvedRestaurant();
  const { data: items, isLoading } = useQuery({
    queryKey: ['gallery-items', restaurantId ?? 'none'],
    queryFn: async () => {
      // Guard: never query without a resolved tenant, otherwise the public
      // SELECT on menu_items would return a mixed menu across all restaurants.
      if (!restaurantId) return [];
      const { data } = await supabase
        .from('menu_items')
        .select('id, name, image_url, categories(name)')
        .eq('is_available', true)
        .eq('restaurant_id', restaurantId)
        .order('sort_order');
      return (data || []).filter(i => i.image_url);
    },
    enabled: !!restaurantId,
  });

  return (
    <WebsiteLayout>
      {/* Hero */}
      <section className="relative pt-[72px] overflow-hidden">
        <div className="bg-[#070707] py-16 sm:py-24 px-6 sm:px-10 lg:px-16 relative">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.04] rounded-full blur-3xl" />
          <div className="relative z-10 max-w-6xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Visual Feast</p>
              <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-extrabold text-white leading-[0.95] tracking-tight mb-4">
                Gallery
              </h1>
              <p className="text-white/40 max-w-md mx-auto text-lg leading-relaxed">
                A glimpse into our culinary creations
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-16 bg-[#070707]">
        <div className="max-w-6xl mx-auto px-6 sm:px-10 lg:px-16">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : items && items.length > 0 ? (
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 space-y-5">
              {items.map((item, i) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: (i % 6) * 0.05, duration: 0.5 }}
                  className="break-inside-avoid rounded-2xl overflow-hidden group relative border border-white/[0.06] hover:border-primary/20 transition-all duration-500"
                >
                  <img
                    src={item.image_url!}
                    alt={item.name}
                    className="w-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <div className="absolute bottom-0 left-0 right-0 p-5">
                      <p className="text-primary/70 text-[11px] uppercase tracking-wider font-medium mb-1">{(item.categories as { name?: string } | null)?.name}</p>
                      <p className="text-sm font-semibold text-white">{item.name}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <ChefHat className="h-12 w-12 mx-auto mb-3 text-white/[0.08]" />
              <p className="text-white/30">Gallery images coming soon</p>
            </div>
          )}
        </div>
      </section>
    </WebsiteLayout>
  );
}
