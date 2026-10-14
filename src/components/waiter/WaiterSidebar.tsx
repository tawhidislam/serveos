import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useSettings } from '@/hooks/useSettings';
import { useTheme } from 'next-themes';
import {
  LayoutDashboard, Plus, History, UtensilsCrossed,
  LogOut, Moon, Sun, Monitor, UserCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

const navSections = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', url: '/waiter', icon: LayoutDashboard },
    ],
  },
  {
    label: 'Actions',
    items: [
      { title: 'POS', url: '/admin/pos', icon: Monitor },
      { title: 'New Order', url: '/menu?mode=waiter', icon: Plus },
      { title: 'Order History', url: '/waiter/history', icon: History },
    ],
  },
];

export default function WaiterSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-card">
      <SidebarContent className="py-2">
        {/* Logo */}
        <div className="px-4 py-4 flex items-center gap-3">
          {settings?.logo_url ? (
            <div className="h-9 w-9 shrink-0 rounded-xl overflow-hidden bg-secondary flex items-center justify-center shadow-md">
              <img src={settings.logo_url} alt="Logo" className="h-full w-full object-contain" />
            </div>
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
              <UtensilsCrossed className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
            </div>
          )}
          {!collapsed && (
            <div>
              <span className="text-sm font-bold tracking-tight text-card-foreground">
                {settings?.restaurant_name || 'RestaurantOS'}
              </span>
              <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                Waiter Panel
              </span>
            </div>
          )}
        </div>

        <Separator className="mx-3 w-auto" />

        {navSections.map((section) => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <span className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 block">
                {section.label}
              </span>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive = item.url === '/waiter'
                    ? location.pathname === '/waiter'
                    : location.pathname.startsWith(item.url.split('?')[0]);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <NavLink
                          to={item.url}
                          end={item.url === '/waiter'}
                          className="hover:bg-accent/10 rounded-lg transition-all duration-150"
                          activeClassName="bg-primary/10 text-primary font-semibold"
                        >
                          <item.icon className="mr-2.5 h-4 w-4" strokeWidth={isActive ? 2 : 1.5} />
                          {!collapsed && <span className="text-[13px]">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="space-y-1 pb-3">
        <Separator className="mx-3 w-auto mb-1" />
        <NavLink to="/profile" className="flex items-center gap-2.5 px-3 text-muted-foreground hover:text-card-foreground text-[13px] h-9 rounded-md hover:bg-accent/10 transition-colors">
          <UserCircle className="h-4 w-4" strokeWidth={1.5} />
          {!collapsed && <span>My Profile</span>}
        </NavLink>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-card-foreground text-[13px] h-9"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4" strokeWidth={1.5} /> : <Moon className="h-4 w-4" strokeWidth={1.5} />}
          {!collapsed && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => signOut()}
          className="w-full justify-start gap-2.5 text-muted-foreground hover:text-destructive text-[13px] h-9"
        >
          <LogOut className="h-4 w-4" strokeWidth={1.5} />
          {!collapsed && <span>Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
