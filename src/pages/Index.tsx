import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Link, useNavigate } from 'react-router-dom';
import {
  UtensilsCrossed, ChefHat, LayoutGrid, LogIn, ArrowRight,
  ClipboardList, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect } from 'react';

export default function Index() {
  const { user, hasRole, hasAnyRole, loading, signOut, getDashboardPath } = useAuth();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const navigate = useNavigate();

  // Auto-redirect: platform super-admins → /platform, staff → role dashboard
  useEffect(() => {
    if (loading || platformLoading || !user) return;
    if (isPlatformAdmin) {
      navigate('/platform', { replace: true });
      return;
    }
    if (hasAnyRole(['admin', 'manager', 'kitchen', 'waiter', 'server'])) {
      navigate(getDashboardPath(), { replace: true });
    }
  }, [loading, platformLoading, user, isPlatformAdmin, hasAnyRole, getDashboardPath, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">RestaurantOS</span>
          </div>
          {user ? (
            <button onClick={() => signOut()} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Sign Out
            </button>
          ) : (
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1">
              <LogIn className="h-4 w-4" strokeWidth={1.5} />
              Sign In
            </Link>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-lg w-full space-y-4 animate-slide-up">
          {!user && (
            <div className="bg-card card-shadow ring-subtle rounded-lg p-6 text-center">
              <h1 className="display-heading mb-2">Welcome</h1>
              <p className="text-muted-foreground mb-6">Restaurant management, simplified.</p>
              <div className="flex flex-col gap-3">
                <Link to="/menu">
                  <Button className="w-full gap-2" size="lg">
                    <UtensilsCrossed className="h-4 w-4" strokeWidth={1.5} />
                    Browse Menu
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" className="w-full gap-2" size="lg">
                    <LogIn className="h-4 w-4" strokeWidth={1.5} />
                    Sign In to Order
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {/* Customer view — staff gets auto-redirected above */}
          {user && (
            <>
              <div className="bg-card card-shadow ring-subtle rounded-lg p-6">
                <p className="text-sm text-muted-foreground">Welcome back</p>
                <h1 className="display-heading">{user.user_metadata?.display_name || user.email}</h1>
              </div>

              <div className="space-y-2">
                <Link
                  to="/menu"
                  className="bg-card card-shadow ring-subtle rounded-lg p-4 flex items-center justify-between group hover:card-shadow-hover transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <UtensilsCrossed className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                    <span className="font-medium text-card-foreground">Browse Menu & Order</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                </Link>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
