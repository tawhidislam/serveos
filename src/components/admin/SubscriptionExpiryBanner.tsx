import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { AlertTriangle, X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { differenceInDays, format } from 'date-fns';

interface ExpiryNotice {
  id: string;
  notice_type: 'warning_7d' | 'expired';
  period_end: string | null;
  plan: string | null;
  acknowledged: boolean;
}

/** Surfaces unacknowledged subscription expiry warnings & downgrades to restaurant owners. */
export default function SubscriptionExpiryBanner() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: restaurant } = useCurrentRestaurant();

  const { data: notices = [] } = useQuery({
    queryKey: ['subscription-expiry-notices', restaurant?.id ?? 'none'],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_expiry_notices')
        .select('id, notice_type, period_end, plan, acknowledged')
        .eq('restaurant_id', restaurant!.id)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ExpiryNotice[];
    },
    staleTime: 30_000,
  });

  const dismiss = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from('subscription_expiry_notices')
        .update({ acknowledged: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscription-expiry-notices'] }),
  });

  const notice = notices[0];
  if (!notice) return null;

  const isExpired = notice.notice_type === 'expired';
  const daysLeft = notice.period_end
    ? Math.max(0, differenceInDays(new Date(notice.period_end), new Date()))
    : null;

  return (
    <div
      className={`px-4 lg:px-6 py-2.5 flex items-center gap-3 border-b text-sm ${
        isExpired
          ? 'bg-destructive/10 border-destructive/30 text-destructive'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400'
      }`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <p className="flex-1 min-w-0 truncate">
        {isExpired ? (
          <>
            Your <strong className="capitalize">{notice.plan}</strong> subscription expired
            {notice.period_end && ` on ${format(new Date(notice.period_end), 'MMM d, yyyy')}`}.
            You've been moved to the Free plan — renew to restore features.
          </>
        ) : (
          <>
            Your <strong className="capitalize">{notice.plan}</strong> subscription expires in{' '}
            <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'}</strong>
            {notice.period_end && ` (${format(new Date(notice.period_end), 'MMM d')})`}. Renew now to avoid downgrade.
          </>
        )}
      </p>
      <Button
        size="sm"
        variant={isExpired ? 'destructive' : 'default'}
        className="h-7 text-xs gap-1 shrink-0"
        onClick={() => navigate('/admin/subscription')}
      >
        {isExpired ? 'Renew' : 'Upgrade'}
        <ArrowRight className="h-3 w-3" />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={() => dismiss.mutate(notice.id)}
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
