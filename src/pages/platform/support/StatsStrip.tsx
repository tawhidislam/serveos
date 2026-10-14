import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

const median = (values: number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const minutes = (value: number | null) => value == null ? '—' : value < 1 ? '<1 min' : value < 60 ? `${Math.round(value)} min` : `${(value / 60).toFixed(1)} h`;
export default function StatsStrip({ refreshKey }: { refreshKey: unknown }) {
  const { data } = useQuery({ queryKey: ['support-stats', refreshKey], queryFn: async () => {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const [open, unassigned, week] = await Promise.all([
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }).in('status', ['open', 'pending', 'bot']),
      supabase.from('support_conversations').select('id', { count: 'exact', head: true }).is('assigned_admin_id', null).in('status', ['open', 'pending', 'bot']),
      supabase.from('support_conversations').select('created_at, first_response_at, rating').gte('created_at', since),
    ]);
    if (open.error || unassigned.error || week.error) throw open.error ?? unassigned.error ?? week.error;
    const responses = (week.data ?? []).filter(conversation => conversation.first_response_at).map(conversation => (Date.parse(conversation.first_response_at!) - Date.parse(conversation.created_at)) / 60000);
    const rated = (week.data ?? []).filter(conversation => conversation.rating);
    return { open: open.count ?? 0, unassigned: unassigned.count ?? 0, firstReply: median(responses), satisfaction: rated.length ? Math.round(rated.filter(conversation => conversation.rating === 'good').length / rated.length * 100) : null };
  }, staleTime: 30_000 });
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[
    { label: 'Open conversations', value: data ? String(data.open) : '—' },
    { label: 'Unassigned', value: data ? String(data.unassigned) : '—' },
    { label: 'Median first reply · 7 days', value: data ? minutes(data.firstReply) : '—' },
    { label: 'Positive ratings · 7 days', value: data?.satisfaction != null ? `${data.satisfaction}%` : '—' },
  ].map(item => <div key={item.label} className="rounded-xl border bg-card px-4 py-3"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{item.value}</p></div>)}</div>;
}
