import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import WaiterSidebar from './WaiterSidebar';
import WaiterMobileNav from './WaiterMobileNav';
import { format } from 'date-fns';
import TenantFaviconInjector from '@/components/TenantFaviconInjector';

interface WaiterLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export default function WaiterLayout({ children, title, subtitle }: WaiterLayoutProps) {
  const today = format(new Date(), 'EEEE, MMMM d');

  return (
    <SidebarProvider>
        <TenantFaviconInjector />
        <div className="h-screen flex w-full bg-background">
        <WaiterSidebar />
        <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
          <header className="h-14 flex items-center justify-between border-b border-border px-3 sm:px-4 lg:px-6 bg-card/80 backdrop-blur-sm shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
              {title && (
                <div className="flex items-baseline gap-2 min-w-0">
                  <h1 className="text-sm font-semibold text-card-foreground truncate">{title}</h1>
                  {subtitle && (
                    <span className="text-xs text-muted-foreground hidden sm:inline whitespace-nowrap">{subtitle}</span>
                  )}
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground hidden md:block tabular-nums">{today}</span>
          </header>
          <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
            {children}
          </main>
        </div>
        <WaiterMobileNav />
      </div>
    </SidebarProvider>
  );
}
