import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { QrCode, Search, Users, ArrowRight, Utensils } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { Input } from '@/components/ui/input';

/**
 * Dine-in entry point: customers pick (or scan) their table before the order
 * flow starts. Selecting a table routes to `/table/:tableId`, the same page a
 * QR scan lands on, so the ordering experience stays identical.
 */
export default function DineInPage() {
  const { restaurantId } = useResolvedRestaurant();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: tables = [], isLoading } = useQuery({
    queryKey: ['dine-in-tables', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, label, capacity, status')
        .eq('restaurant_id', restaurantId!)
        .order('label');
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(t => (t.label || '').toLowerCase().includes(q));
  }, [tables, query]);

  return (
    <WebsiteLayout>
      <section className="relative pt-[72px] bg-[#070707]">
        <div className="py-16 sm:py-20 px-6 sm:px-10 lg:px-16 relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/[0.05] rounded-full blur-3xl" />
          <div className="relative z-10 max-w-3xl mx-auto text-center">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <p className="text-primary text-sm font-semibold uppercase tracking-wider mb-3">Dine-in</p>
              <h1 className="text-4xl sm:text-5xl font-display font-extrabold text-white tracking-tight mb-4">
                Select your table
              </h1>
              <p className="text-white/40 text-lg leading-relaxed">
                Scan the QR code on your table, or pick your table number below to start ordering.
              </p>
            </motion.div>

            <div className="mt-8 flex items-center justify-center gap-2 text-white/40 text-sm">
              <QrCode className="h-4 w-4 text-primary" />
              Already scanned a code? You're in the right place.
            </div>
          </div>
        </div>
      </section>

      <section className="bg-[#070707] pb-20 px-6 sm:px-10 lg:px-16">
        <div className="max-w-4xl mx-auto">
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search table number…"
              className="pl-9 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30"
            />
          </div>

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-24 rounded-xl bg-white/[0.04] animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 border border-white/10 rounded-2xl">
              <Utensils className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-white/60">
                {tables.length === 0
                  ? 'No tables are available for self-ordering yet. Please ask a member of staff.'
                  : 'No table matches that search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(table => (
                <button
                  key={table.id}
                  onClick={() => navigate(`/table/${table.id}`)}
                  className="group text-left rounded-xl border border-white/10 bg-white/[0.03] hover:border-primary/60 hover:bg-primary/[0.06] transition-colors p-4"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-white font-display text-xl font-bold">{table.label}</span>
                    <ArrowRight className="h-4 w-4 text-white/20 group-hover:text-primary transition-colors" />
                  </div>
                  {table.capacity ? (
                    <span className="mt-2 flex items-center gap-1.5 text-xs text-white/40">
                      <Users className="h-3.5 w-3.5" /> Seats {table.capacity}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </WebsiteLayout>
  );
}
