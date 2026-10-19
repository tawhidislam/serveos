import FreeTrialBanner from './FreeTrialBanner';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import AdminSidebar from './AdminSidebar';
import { format } from 'date-fns';
import { Bell, Check, ShoppingCart, ArrowRightLeft, PhoneCall, Trash2, PackageMinus, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import AdminOrderAutoPrint from './AdminOrderAutoPrint';
import { useAdminAutoPrintToggle } from '@/hooks/useAdminAutoPrintToggle';
import { usePrintAgentStatus } from '@/hooks/usePrintAgentStatus';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAdminNotifications, AdminNotification } from '@/hooks/useAdminNotifications';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import MobileBottomNav from './MobileBottomNav';
import SupportLauncher from '@/components/support/SupportLauncher';
import SubscriptionExpiryBanner from './SubscriptionExpiryBanner';
import UpgradePromptDialog from './UpgradePromptDialog';
import PostUpgradeRedirect from './PostUpgradeRedirect';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import TenantFaviconInjector from '@/components/TenantFaviconInjector';
import KitchenLayout from '@/components/kitchen/KitchenLayout';
import { useAuth } from '@/hooks/useAuth';

interface AdminLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

const notifIcon: Record<AdminNotification['type'], typeof ShoppingCart> = {
  new_order: ShoppingCart,
  status_change: ArrowRightLeft,
  waiter_call: PhoneCall,
  low_stock: PackageMinus,
};

const notifColor: Record<AdminNotification['type'], string> = {
  new_order: 'text-primary',
  status_change: 'text-accent-foreground',
  waiter_call: 'text-destructive',
  low_stock: 'text-destructive',
};


export default function AdminLayout(props: AdminLayoutProps) {
  const { hasRole, hasAnyRole } = useAuth();
  // Shared staff pages (including support) must not mount admin navigation,
  // notifications, auto-print listeners, or billing prompts for kitchen staff.
  if (hasRole('kitchen') && !hasAnyRole(['owner', 'admin', 'manager'])) {
    return <KitchenLayout {...props} />;
  }
  return <AdminWorkspaceLayout {...props} />;
}

function AdminWorkspaceLayout({ children, title, subtitle }: AdminLayoutProps) {
  const today = format(new Date(), 'EEEE, MMMM d');
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useAdminNotifications();
  const { enabled: autoPrintEnabled, toggle: toggleAutoPrint } = useAdminAutoPrintToggle();
  const { agentAvailable } = usePrintAgentStatus();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: subStatus } = useSubscriptionStatus();

  // Block all admin pages once the subscription is expired.
  // Allow the renew/billing screens and the expired page itself through
  // so the owner can still pay and see status.
  const allowedWhileExpired = [
    '/admin/subscription',
    '/admin/subscription/expired',
    '/admin/billing',
  ];
  const isOnAllowedRoute = allowedWhileExpired.some((p) =>
    location.pathname.startsWith(p)
  );
  if (subStatus?.isExpired && !isOnAllowedRoute) {
    return <Navigate to="/admin/subscription/expired" replace />;
  }

  const handleNotificationClick = (n: AdminNotification) => {
    markAsRead(n.id);
    if (n.type === 'low_stock') {
      navigate('/admin/accounting/inventory');
    } else if (n.orderId) {
      navigate(`/admin/orders?highlight=${n.orderId}`);
    }
  };


  return (
    <SidebarProvider>
      <TenantFaviconInjector />
      {/* Global auto-print listener — stays mounted across all admin pages. */}
      <AdminOrderAutoPrint enabled={autoPrintEnabled} />
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between gap-2 border-b border-border px-3 lg:px-6 bg-card/80 backdrop-blur-sm shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0 h-9 w-9" />
              {title && (
                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-sm font-semibold text-card-foreground truncate">{title}</h1>
                  {subtitle && (
                    <span className="text-xs text-muted-foreground hidden sm:inline truncate">{subtitle}</span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className={`relative h-9 w-9 ${autoPrintEnabled ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={toggleAutoPrint}
                title={
                  autoPrintEnabled
                    ? agentAvailable
                      ? 'Auto-print new orders: ON (silent — print agent detected)'
                      : 'Auto-print new orders: ON (dialog — run `npm run print-agent` for silent printing)'
                    : 'Auto-print new orders: OFF'
                }
              >
                <Printer className="h-4 w-4" strokeWidth={1.5} />
                {autoPrintEnabled && (
                  <span
                    className={`absolute top-1.5 right-1.5 h-2 w-2 rounded-full ${
                      agentAvailable ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    aria-hidden="true"
                  />
                )}
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Bell className="h-4 w-4" strokeWidth={1.5} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-[min(20rem,calc(100vw-1.5rem))] p-0">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-card-foreground">
                      Notifications
                      {unreadCount > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">({unreadCount} new)</span>
                      )}
                    </h3>
                    <div className="flex gap-1">
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" onClick={markAllAsRead}>
                          <Check className="h-3 w-3" />
                          Read all
                        </Button>
                      )}
                      {notifications.length > 0 && (
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={clearAll}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                  <ScrollArea className="max-h-72">
                    {notifications.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                        <Bell className="h-8 w-8 mb-2 opacity-20" />
                        <p className="text-sm">No notifications yet</p>
                        <p className="text-xs mt-1 opacity-60">New orders will appear here</p>
                      </div>
                    ) : (
                      notifications.map(n => {
                        const Icon = notifIcon[n.type];
                        const color = notifColor[n.type];
                        return (
                          <div
                            key={n.id}
                            className={`flex items-start gap-3 px-4 py-3 border-b border-border last:border-0 cursor-pointer transition-colors hover:bg-accent/5 ${!n.read ? 'bg-primary/5' : ''}`}
                            onClick={() => handleNotificationClick(n)}
                          >
                            <div className={`mt-0.5 shrink-0 ${color}`}>
                              <Icon className="h-4 w-4" strokeWidth={1.5} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm leading-snug ${!n.read ? 'text-card-foreground font-medium' : 'text-muted-foreground'}`}>
                                {n.message}
                              </p>
                              <span className="text-[11px] text-muted-foreground">{n.time}</span>
                            </div>
                            {!n.read && (
                              <span className="mt-1.5 h-2 w-2 rounded-full bg-primary shrink-0" />
                            )}
                          </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
              <span className="text-xs text-muted-foreground hidden md:block tabular-nums">{today}</span>
            </div>
          </header>
          <FreeTrialBanner />
          <SubscriptionExpiryBanner />
          <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 md:pb-0">
            {children}
          </main>
        </div>
        <MobileBottomNav />
        <SupportLauncher raised />
        <UpgradePromptDialog />
        <PostUpgradeRedirect />
      </div>
    </SidebarProvider>
  );
}
