import { Star } from 'lucide-react';
import { useLoyaltySettings, useLoyaltyBalance, calculateEarnedPoints } from '@/hooks/useLoyalty';

interface LoyaltyBadgeProps {
  userId: string | undefined;
  orderTotal?: number;
  variant?: 'balance' | 'earn-preview';
}

export default function LoyaltyBadge({ userId, orderTotal = 0, variant = 'balance' }: LoyaltyBadgeProps) {
  const { data: settings } = useLoyaltySettings();
  const { data: balance = 0 } = useLoyaltyBalance(userId);

  if (!settings?.is_enabled || !userId) return null;

  if (variant === 'earn-preview' && orderTotal > 0) {
    const points = calculateEarnedPoints(settings, orderTotal);
    if (points <= 0) return null;
    return (
      <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
        <Star className="h-3 w-3" fill="currentColor" />
        Earn {points} pts
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
      <Star className="h-3 w-3" fill="currentColor" />
      {balance} pts
    </span>
  );
}
