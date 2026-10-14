import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

export default function FreeTrialBanner() {
  const { data } = useSubscriptionStatus();
  if (data?.plan !== 'trial' || data.isExpired || !data.currentPeriodEnd) return null;
  const days = Math.max(0, Math.ceil((Date.parse(data.currentPeriodEnd) - Date.now()) / 86400000));
  return <div className="flex flex-wrap items-center justify-between gap-3 border-b border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"><p><strong>7-day free trial</strong> · {days} day{days === 1 ? '' : 's'} left. No automatic charge.</p><Button size="sm" variant="outline" asChild><Link to="/admin/subscription">Choose a paid package</Link></Button></div>;
}
