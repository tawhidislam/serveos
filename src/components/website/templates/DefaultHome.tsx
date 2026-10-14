import { Link } from 'react-router-dom';
import { UtensilsCrossed, LogIn, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import type { HomeTemplateProps } from './types';

export default function DefaultHome({ name }: HomeTemplateProps) {
  const { user, signOut } = useAuth();
  const { withPrefix } = useWebsitePrefix();
  const menuHref = withPrefix('/menu');

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="px-4 py-6">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <span className="text-lg font-semibold tracking-tight text-foreground">{name}</span>
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
            <div className="bg-card shadow-sm ring-1 ring-border rounded-lg p-6 text-center">
              <h1 className="text-2xl font-bold text-foreground mb-2">Welcome</h1>
              <p className="text-muted-foreground mb-6">Restaurant management, simplified.</p>
              <div className="flex flex-col gap-3">
                <Link to={menuHref}>
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

          {user && (
            <>
              <div className="bg-card shadow-sm ring-1 ring-border rounded-lg p-6">
                <p className="text-sm text-muted-foreground">Welcome back</p>
                <h1 className="text-2xl font-bold text-foreground">{user.user_metadata?.display_name || user.email}</h1>
              </div>

              <Link
                to={menuHref}
                className="bg-card shadow-sm ring-1 ring-border rounded-lg p-4 flex items-center justify-between group hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <UtensilsCrossed className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
                  <span className="font-medium text-card-foreground">Browse Menu & Order</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
