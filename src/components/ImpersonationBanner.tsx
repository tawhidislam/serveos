import { useNavigate } from 'react-router-dom';
import { Eye, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/hooks/useImpersonation';

export default function ImpersonationBanner() {
  const { active, stopImpersonation, isSwitching } = useImpersonation();
  const navigate = useNavigate();

  if (!active) return null;

  const handleStop = async () => {
    if (isSwitching) return;
    // Wait for the cache to resync before navigating away so the platform
    // pages don't render against stale tenant-scoped queries.
    await stopImpersonation();
    navigate('/platform/tenants');
  };

  return (
    <div className="sticky top-0 z-50 bg-amber-500/95 text-amber-950 backdrop-blur-sm border-b border-amber-600">
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <Eye className="h-4 w-4 shrink-0" strokeWidth={2} />
          <span className="font-medium truncate">
            Viewing as <span className="font-semibold">{active.restaurantName}</span> (read-only context)
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          disabled={isSwitching}
          className="h-7 px-2 text-amber-950 hover:bg-amber-600/30 disabled:opacity-70"
        >
          {isSwitching ? (
            <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
          ) : (
            <X className="h-3.5 w-3.5 mr-1" />
          )}
          {isSwitching ? 'Exiting…' : 'Exit'}
        </Button>
      </div>
    </div>
  );
}
