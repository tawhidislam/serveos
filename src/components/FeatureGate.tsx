import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { ReactNode, useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Lock, Sparkles, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePlan } from '@/hooks/usePlan';
import { useActiveAddonFeatureKeys } from '@/hooks/useAddons';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import type { PlanLimits } from '@/lib/plans';

interface FeatureGateProps {
  feature: keyof PlanLimits;
  children: ReactNode;
  /** Optional friendly name shown in the upgrade prompt */
  featureName?: string;
}

/** Where to send the user after they finish upgrading. */
export const PENDING_FEATURE_REDIRECT_KEY = 'admin:pending-feature-redirect';
/** How long a stored pending redirect stays valid (ms). */
export const PENDING_FEATURE_REDIRECT_TTL_MS = 30 * 60 * 1000; // 30 min

export interface PendingFeatureRedirect {
  path: string;
  ts: number;
}

/** Safe setter — never throw, never store loop-prone paths. */
export function setPendingFeatureRedirect(path: string) {
  if (!path || path.startsWith('/admin/subscription')) return;
  try {
    const payload: PendingFeatureRedirect = { path, ts: Date.now() };
    sessionStorage.setItem(PENDING_FEATURE_REDIRECT_KEY, JSON.stringify(payload));
  } catch {
    /* noop */
  }
}

/** Read + validate. Removes the key if expired or malformed. */
export function readPendingFeatureRedirect(): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_FEATURE_REDIRECT_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    // Back-compat: old code stored the bare path string.
    if (raw.startsWith('/')) {
      return raw;
    }
    const parsed = JSON.parse(raw) as PendingFeatureRedirect;
    if (!parsed?.path || typeof parsed.ts !== 'number') {
      clearPendingFeatureRedirect();
      return null;
    }
    if (Date.now() - parsed.ts > PENDING_FEATURE_REDIRECT_TTL_MS) {
      clearPendingFeatureRedirect();
      return null;
    }
    return parsed.path;
  } catch {
    clearPendingFeatureRedirect();
    return null;
  }
}

export function clearPendingFeatureRedirect() {
  try {
    sessionStorage.removeItem(PENDING_FEATURE_REDIRECT_KEY);
  } catch {
    /* noop */
  }
}

/**
 * Wraps content that requires a specific plan feature.
 * - If unlocked → renders children.
 * - If locked → shows an upgrade card AND auto-opens a popup that lets
 *   the user jump straight to checkout. We remember the path they tried
 *   to open so the app can return them to it once their plan upgrades.
 */
export default function FeatureGate({ feature, children, featureName }: FeatureGateProps) {
  const { data, isLoading, isError, refetch } = usePlan();
  const { data: subscriptionStatus } = useSubscriptionStatus();
  const addonFeatures = useActiveAddonFeatureKeys();
  const { hasAnyRole } = useAuth();
  const { isPlatformAdmin } = usePlatformAdmin();
  const canManageSubscription = hasAnyRole(['owner', 'admin', 'manager']) || isPlatformAdmin;
  const location = useLocation();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const value = data?.limits[feature];
  const planAllowed = typeof value === 'boolean' ? value : true;
  const addonAllowed = addonFeatures.has(feature as string);
  const allowed = !!data?.isActive && !subscriptionStatus?.isExpired && (planAllowed || addonAllowed);

  // Auto-open the popup whenever the user lands on a locked page.
  useEffect(() => {
    if (!isLoading && data && !allowed && canManageSubscription) {
      setDialogOpen(true);
    }
  }, [isLoading, data, allowed, canManageSubscription]);

  if (isError) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center p-6">
        <Card role="alert" className="max-w-md w-full p-8 text-center space-y-4">
          <h2 className="text-xl font-bold">Could not check feature access</h2>
          <p className="text-sm text-muted-foreground">We could not load your restaurant’s subscription. Try again to check access to {featureName?.toLowerCase() ?? 'this feature'}.</p>
          <Button onClick={() => refetch()}>Try again</Button>
        </Card>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (subscriptionStatus?.isExpired && location.pathname.startsWith('/admin/') && canManageSubscription) return <Navigate to="/admin/subscription/expired" replace />;

  if (allowed) return <>{children}</>;

  if (!canManageSubscription) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <Lock className="h-8 w-8 text-primary mx-auto" />
          <h2 className="text-xl font-bold">{subscriptionStatus?.isExpired ? 'Restaurant subscription expired' : `${featureName ?? 'This feature'} is locked`}</h2>
          <p className="text-sm text-muted-foreground">{subscriptionStatus?.isExpired
            ? 'Ask your restaurant owner or manager to renew the subscription to restore access.'
            : 'Ask your restaurant owner or manager to check the plan and subscription status to enable this feature.'}</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Go back</Button>
        </Card>
      </div>
    );
  }

  const targetPath = location.pathname + location.search;
  const goUpgrade = () => {
    setPendingFeatureRedirect(targetPath);
    setDialogOpen(false);
    navigate(`/admin/subscription?next=${encodeURIComponent(targetPath)}`);
  };

  return (
    <>
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mx-auto">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold">
              {featureName ?? 'This feature'} is locked
            </h2>
            <p className="text-sm text-muted-foreground">
              Upgrade your plan or activate the matching add-on to unlock {featureName?.toLowerCase() ?? 'this feature'}.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button variant="outline" onClick={goUpgrade}>
              <Sparkles className="mr-2 h-4 w-4" />
              View plans
            </Button>
            <Button asChild>
              <Link to="/admin/subscription">
                <Plus className="mr-2 h-4 w-4" />
                Browse add-ons
              </Link>
            </Button>
          </div>
        </Card>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 mb-2">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <DialogTitle className="text-center text-xl">
              Upgrade to unlock {featureName ?? 'this feature'}
            </DialogTitle>
            <DialogDescription className="text-center">
              You're on the Free plan. Upgrade to Premium to access {featureName?.toLowerCase() ?? 'this feature'} and the rest of the restaurant suite.
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
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="gap-2">
              <Lock className="h-4 w-4" />
              Maybe later
            </Button>
            <Button onClick={goUpgrade} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Upgrade to Premium
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
