import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChefHat, LifeBuoy, UserCircle, LogOut, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { Button } from '@/components/ui/button';
import {
  Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarFooter,
  SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, useSidebar,
} from '@/components/ui/sidebar';
import TenantFaviconInjector from '@/components/TenantFaviconInjector';

const links = [
  { label: 'Kitchen Queue', path: '/kitchen', icon: ChefHat },
  { label: 'Help & support', path: '/admin/support', icon: LifeBuoy },
  { label: 'My Profile', path: '/profile', icon: UserCircle },
];

function KitchenNavigation() {
  const { pathname } = useLocation();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const { data: settings } = useSettings();
  const { signOut } = useAuth();
  const collapsed = state === 'collapsed' && !isMobile;

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarContent>
        <div className="flex min-w-0 items-center gap-3 px-4 py-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ChefHat className="h-5 w-5" /></span>
          {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-bold">{settings?.restaurant_name || 'ServeOS'}</p><p className="mt-0.5 text-[10px] font-medium uppercase tracking-widest text-muted-foreground">Kitchen Panel</p></div>}
        </div>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {links.map(item => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild isActive={pathname === item.path} tooltip={item.label}>
                    <Link to={item.path} aria-current={pathname === item.path ? 'page' : undefined} onClick={() => setOpenMobile(false)}><item.icon className="h-4 w-4" /><span>{item.label}</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border p-2">
        <Button variant="ghost" className="justify-start gap-2 text-muted-foreground" aria-label="Sign out" onClick={() => void signOut()}><LogOut className="h-4 w-4 shrink-0" />{!collapsed && 'Sign out'}</Button>
      </SidebarFooter>
    </Sidebar>
  );
}

export default function KitchenLayout({ children, title, subtitle }: { children: ReactNode; title?: string; subtitle?: string }) {
  const { pathname } = useLocation();
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === 'dark';

  return (
    <SidebarProvider>
      <TenantFaviconInjector />
      <div className="flex h-dvh w-full bg-background">
        <KitchenNavigation />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card px-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-2"><SidebarTrigger aria-label="Toggle kitchen navigation" /><h1 className="truncate text-sm font-semibold">{title || 'Kitchen Display'}</h1><span className="hidden text-xs text-muted-foreground sm:inline">{subtitle || 'Kitchen Panel'}</span></div>
            <Button variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</Button>
          </header>
          <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</main>
        </div>
        <nav aria-label="Kitchen navigation" className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom md:hidden">
          <div className="grid h-16 grid-cols-3">
            {links.map(item => <Link key={item.path} to={item.path} aria-current={pathname === item.path ? 'page' : undefined} className={`flex flex-col items-center justify-center gap-1 text-[11px] font-medium ${pathname === item.path ? 'text-primary' : 'text-muted-foreground'}`}><item.icon className="h-5 w-5" />{item.label}</Link>)}
          </div>
        </nav>
      </div>
    </SidebarProvider>
  );
}
