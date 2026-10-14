import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { usePlan } from '@/hooks/usePlan';
import {
  clearPendingFeatureRedirect,
  readPendingFeatureRedirect,
} from '@/components/FeatureGate';

/**
 * After a free-tier admin upgrades to a paid plan, automatically take them
 * back to the locked feature page they originally tried to open.
 *
 * Loop-prevention safeguards:
 * - Only fires on a real free → paid transition (not initial load / refresh).
 * - Only fires once per mounted session (consumedRef).
 * - Ignores stale pending entries (TTL handled in readPendingFeatureRedirect).
 * - Skips redirect if the pending path equals the current location, or points
 *   back into the subscription page itself.
 *
 * Shows a brief full-screen loading overlay while the plan flips and the
 * router navigates, so the user gets feedback instead of a blank flash.
 */
export default function PostUpgradeRedirect() {
  const { data: plan } = usePlan();
  const navigate = useNavigate();
  const location = useLocation();
  const lastTier = useRef<string | null>(null);
  const consumedRef = useRef(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!plan) return;
    const prev = lastTier.current;
    lastTier.current = plan.tier;

    if (prev === null) return;
    if (prev !== 'free' || plan.tier === 'free') return;
    if (consumedRef.current) return;

    const pending = readPendingFeatureRedirect();
    clearPendingFeatureRedirect();
    if (!pending) return;

    const current = location.pathname + location.search;
    if (pending === current) return;
    if (pending.startsWith('/admin/subscription')) return;

    consumedRef.current = true;
    setRedirecting(true);
    // Small delay so the overlay is visible and React Query caches settle.
    const t = window.setTimeout(() => {
      navigate(pending, { replace: true });
      // Hide shortly after navigation so the destination page gets a beat to mount.
      window.setTimeout(() => setRedirecting(false), 400);
    }, 600);
    return () => window.clearTimeout(t);
  }, [plan, navigate, location.pathname, location.search]);

  if (!redirecting) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm"
    >
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-8 py-6 shadow-lg">
        <div className="relative">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <Loader2 className="absolute -bottom-1 -right-1 h-5 w-5 animate-spin text-primary" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold">Plan upgraded</p>
          <p className="text-xs text-muted-foreground">
            Taking you to the unlocked feature…
          </p>
        </div>
      </div>
    </div>
  );
}
