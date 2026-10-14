import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePlanQuantityLimit, type QuantityLimitKey } from '@/hooks/usePlanQuantityLimit';

interface Props {
  limitKey: QuantityLimitKey;
  /** Friendly resource name, e.g. "menu items", "branches", "staff seats". */
  resource: string;
}

/**
 * Inline banner shown above lists where a plan-quantity limit applies.
 * Always renders something useful: a soft "X of Y used" hint when there
 * is still room, or a hard upgrade prompt once the limit is hit.
 */
export default function PlanLimitNotice({ limitKey, resource }: Props) {
  const { current, limit, canCreate, isLoading } = usePlanQuantityLimit(limitKey);
  if (isLoading || limit == null) return null;

  if (!canCreate) {
    return (
      <div
        className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-center gap-3"
        role="alert"
      >
        <div className="h-8 w-8 rounded-full bg-warning/20 flex items-center justify-center shrink-0">
          <Lock className="h-4 w-4 text-warning" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium leading-tight">
            You've reached your plan limit of {limit} {resource}.
          </p>
          <p className="text-xs text-muted-foreground">
            Upgrade your subscription or activate a matching add-on to add more.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button asChild size="sm" variant="outline">
            <Link to="/admin/subscription">Add-ons</Link>
          </Button>
          <Button asChild size="sm">
            <Link to="/admin/subscription">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Upgrade
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  // Soft hint when within limits — only show when getting close (>=70% used).
  const used = current ?? 0;
  const ratio = used / limit;
  if (ratio < 0.7) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/40 px-3 py-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
      <span>
        Using <span className="font-medium text-foreground">{used}</span> of {limit} {resource} on
        your plan.
      </span>
      <Link to="/admin/subscription" className="text-primary hover:underline shrink-0">
        Upgrade
      </Link>
    </div>
  );
}

/**
 * Lightweight hook+helper for inline disabling of a Create button.
 * Returns `{ disabled, reason }` ready to feed into a Button.
 */
export function usePlanLimitGate(limitKey: QuantityLimitKey, resource: string) {
  const { canCreate, limit, isLoading } = usePlanQuantityLimit(limitKey);
  const disabled = !isLoading && !canCreate;
  const reason = disabled ? `Plan limit reached (${limit} ${resource})` : undefined;
  return { disabled, reason };
}