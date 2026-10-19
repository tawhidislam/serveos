import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Shield, LayoutDashboard, Building2, Users, ShoppingBag, LogOut, CreditCard, Activity, Sparkles, Package, Settings, Globe, Puzzle, Palette, Link as LinkIcon, Mail, Smartphone, Info, Menu, LifeBuoy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useSupportUnread } from '@/hooks/useSupportUnread';

const nav = [
  { label: 'Overview', to: '/platform', icon: LayoutDashboard, end: true },
  { label: 'Support', to: '/platform/support', icon: LifeBuoy },
  { label: 'Tenants', to: '/platform/tenants', icon: Building2 },
  { label: 'Domains', to: '/platform/domains', icon: Globe },
  { label: 'Subdomain pool', to: '/platform/subdomains', icon: Globe },
  { label: 'Packages', to: '/platform/packages', icon: Package },
  { label: 'Add-ons', to: '/platform/addons', icon: Puzzle },
  { label: 'Themes', to: '/platform/themes', icon: Palette },
  { label: 'Subscriptions', to: '/platform/billing', icon: CreditCard },
  { label: 'Payment methods', to: '/platform/billing?tab=settings', icon: Smartphone },
  { label: 'Users', to: '/platform/users', icon: Users },
  { label: 'Orders', to: '/platform/orders', icon: ShoppingBag },
  { label: 'Audit log', to: '/platform/audit', icon: Activity },
  { label: 'Marketing home', to: '/platform/marketing-home', icon: Globe },
  { label: 'Marketing footer', to: '/platform/footer', icon: LinkIcon },
  { label: 'Marketing contact', to: '/platform/contact', icon: Mail },
  { label: 'Marketing about', to: '/platform/about', icon: Info },
  { label: 'App downloads', to: '/platform/apps', icon: Smartphone },
  { label: 'Demo page', to: '/platform/demo-editor', icon: Sparkles },
  { label: 'Settings', to: '/platform/settings', icon: Settings },
];

export default function PlatformLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [open, setOpen] = useState(false);
  const supportUnread = useSupportUnread();

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.search]);

  const isActive = (to: string, end?: boolean) => {
    const [path, query] = to.split('?');
    const pathMatch = end ? location.pathname === path : location.pathname.startsWith(path);
    if (!pathMatch) return false;
    if (!query) {
      // Plain path entry should NOT light up when a tab-specific entry is active
      if (location.search) {
        const tabMatch = nav.some(
          (n) => n.to !== to && n.to.startsWith(path + '?') && location.search.includes(n.to.split('?')[1])
        );
        if (tabMatch) return false;
      }
      return true;
    }
    return location.search.includes(query);
  };

  const activeLabel = nav.find((n) => isActive(n.to, n.end))?.label ?? 'Platform';

  const SidebarContent = (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-5 lg:p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight">Platform</h1>
            <p className="text-xs text-muted-foreground">Super Admin</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
        {nav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.to, item.end);
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className={cn(
                'flex items-center gap-2 px-3 py-2.5 lg:py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.to === '/platform/support' && supportUnread > 0 && (
                <span className="ml-auto h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold flex items-center justify-center" aria-label={`${supportUnread} unread conversations`}>
                  {supportUnread}
                </span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border space-y-2 safe-area-bottom">
        <p className="text-xs text-muted-foreground px-3 truncate">{user?.email}</p>
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
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-border bg-card flex-col sticky top-0 h-screen">
        {SidebarContent}
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center gap-2 px-3 border-b border-border bg-card/90 backdrop-blur-sm">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label="Open navigation menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-[17rem] max-w-[85vw] bg-card">
              {SidebarContent}
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-4 w-4 text-primary shrink-0" strokeWidth={2} />
            <span className="text-sm font-semibold truncate">{activeLabel}</span>
          </div>
        </header>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
