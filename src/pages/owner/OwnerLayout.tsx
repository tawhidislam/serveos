import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Store, LayoutDashboard, BarChart3, UsersRound, Palette, Brush, Settings, LogOut, ExternalLink, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getTenantOrigin, isSubdomainTenancyEnabled } from '@/lib/tenant-host';
import TenantFaviconInjector from '@/components/TenantFaviconInjector';

const nav = [
  { label: 'Overview', to: '/owner', icon: LayoutDashboard, end: true },
  { label: 'Analytics', to: '/owner/analytics', icon: BarChart3 },
  { label: 'Staff', to: '/owner/staff', icon: UsersRound },
  { label: 'Branding', to: '/owner/branding', icon: Palette },
  { label: 'Theme', to: '/owner/theme', icon: Brush },
  { label: 'Domain', to: '/owner/domain', icon: Globe },
];

export default function OwnerLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { data: restaurant } = useCurrentRestaurant();

  const isActive = (to: string, end?: boolean) =>
    end ? location.pathname === to : location.pathname.startsWith(to);

  return (
    <div className="min-h-screen bg-background flex">
      <TenantFaviconInjector />
      <aside className="w-60 border-r border-border bg-card flex flex-col">
        <div className="p-6 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-tight truncate">{restaurant?.name ?? 'Restaurant'}</h1>
              <p className="text-xs text-muted-foreground truncate">
                {restaurant && isSubdomainTenancyEnabled() && getTenantOrigin(restaurant.slug)
                  ? getTenantOrigin(restaurant.slug)!.replace(/^https?:\/\//, '')
                  : `/r/${restaurant?.slug}`}
              </p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to, item.end);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                  active
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
          <div className="pt-3 mt-3 border-t border-border space-y-1">
            <Link
              to="/admin"
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <Settings className="h-4 w-4" />
              Operations
            </Link>
            {restaurant && (
              <a
                href={
                  isSubdomainTenancyEnabled() && getTenantOrigin(restaurant.slug)
                    ? `${getTenantOrigin(restaurant.slug)}/menu`
                    : `/r/${restaurant.slug}/menu`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Public menu
              </a>
            )}
          </div>
        </nav>
        <div className="p-3 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={() => signOut().then(() => navigate('/auth'))}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
