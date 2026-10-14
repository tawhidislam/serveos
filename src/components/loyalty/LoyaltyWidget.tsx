import { Star, Gift, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { useLoyaltySettings, useLoyaltyBalance, calculateRedemptionDiscount, getAvailableTiers, type LoyaltySettings } from '@/hooks/useLoyalty';

interface LoyaltyWidgetProps {
  userId: string | undefined;
  orderTotal: number;
  format: (n: number) => string;
  onRedeem: (points: number, discount: number) => void;
  onClearRedemption: () => void;
  redeemedPoints: number;
}

export default function LoyaltyWidget({
  userId, orderTotal, format, onRedeem, onClearRedemption, redeemedPoints,
}: LoyaltyWidgetProps) {
  const { data: settings } = useLoyaltySettings();
  const { data: balance = 0 } = useLoyaltyBalance(userId);
  const [expanded, setExpanded] = useState(false);

  if (!settings?.is_enabled || !userId || balance <= 0) return null;

  const canRedeem = balance >= (settings.min_redeem_points || 0);

  const handleFlexRedeem = (pts: number) => {
    const discount = calculateRedemptionDiscount(settings, pts);
    const cappedDiscount = Math.min(discount, orderTotal);
    const cappedPts = settings.redemption_type === 'flexible'
      ? Math.min(pts, Math.ceil(orderTotal / settings.point_value))
      : pts;
    onRedeem(cappedPts, cappedDiscount);
  };

  const handleTierRedeem = (tier: { points: number; discount: number }) => {
    const cappedDiscount = Math.min(tier.discount, orderTotal);
    onRedeem(tier.points, cappedDiscount);
  };

  const tiers = settings.redemption_type === 'tiers' ? getAvailableTiers(settings, balance) : [];

  return (
    <div className="bg-primary/5 rounded-xl p-3 border border-primary/10">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-primary" fill="currentColor" />
          <span className="text-sm font-semibold text-card-foreground">{balance} points</span>
        </div>
        <div className="flex items-center gap-1">
          {redeemedPoints > 0 && (
            <span className="text-xs text-primary font-medium">
              Redeeming {redeemedPoints} pts
            </span>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="pt-3 space-y-2">
              {redeemedPoints > 0 ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Using {redeemedPoints} points for {format(calculateRedemptionDiscount(settings, redeemedPoints))} off
                  </p>
                  <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onClearRedemption}>
                    Remove
                  </Button>
                </div>
              ) : !canRedeem ? (
                <p className="text-xs text-muted-foreground">
                  Need {settings.min_redeem_points} pts minimum to redeem (you have {balance})
                </p>
              ) : settings.redemption_type === 'flexible' ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Redeem points at {format(settings.point_value)} per point
                  </p>
                  <div className="flex gap-2">
                    {[
                      Math.min(balance, settings.min_redeem_points),
                      Math.min(balance, Math.floor(balance / 2)),
                      balance,
                    ].filter((v, i, a) => v > 0 && a.indexOf(v) === i).map(pts => (
                      <Button
                        key={pts}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => handleFlexRedeem(pts)}
                      >
                        <Gift className="h-3 w-3" />
                        {pts} pts ({format(calculateRedemptionDiscount(settings, pts))})
                      </Button>
                    ))}
                  </div>
                </div>
              ) : tiers.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Choose a reward tier:</p>
                  <div className="flex flex-wrap gap-2">
                    {tiers.map((tier, i) => (
                      <Button
                        key={i}
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => handleTierRedeem(tier)}
                      >
                        <Gift className="h-3 w-3" />
                        {tier.points} pts → {format(tier.discount)} off
                      </Button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No reward tiers available for your balance</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
