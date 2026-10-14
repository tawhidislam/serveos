import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Lock, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { usePlan } from '@/hooks/usePlan';

const SESSION_KEY = 'admin:upgrade-prompt-dismissed';

/**
 * One-time-per-session upgrade nudge for free-tier admins. Sits in the admin
 * layout so every admin page can surface it without duplicating logic.
 */
export default function UpgradePromptDialog() {
  const navigate = useNavigate();
  const { data: plan, isLoading } = usePlan();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isLoading || !plan) return;
    if (plan.tier !== 'free') return;
    if (sessionStorage.getItem(SESSION_KEY) === '1') return;
    // Slight delay so it doesn't flash before the page paints.
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
  }, [plan, isLoading]);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setOpen(false);
  };

  const upgrade = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setOpen(false);
    navigate('/admin/subscription');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpen(true) : dismiss())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Unlock the full restaurant suite
          </DialogTitle>
          <DialogDescription className="text-center">
            You're on the Free plan. Upgrade to Premium to run day-to-day operations and grow your business.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2 py-2 text-sm">
          {[
            'Orders, POS, Kitchen Display & Billing',
            'Tables, Floor Plans & Reservations',
            'Accounting, Promotions & Loyalty',
            'Custom domain & unlimited menu items',
          ].map((label) => (
            <li key={label} className="flex items-start gap-2">
              <Check className="mt-0.5 h-4 w-4 text-primary shrink-0" />
              <span>{label}</span>
            </li>
          ))}
        </ul>

        <DialogFooter className="sm:justify-between gap-2">
          <Button variant="ghost" onClick={dismiss} className="gap-2">
            <Lock className="h-4 w-4" />
            Maybe later
          </Button>
          <Button onClick={upgrade} className="gap-2">
            <Sparkles className="h-4 w-4" />
            Upgrade to Premium
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
