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
  LayoutDashboard, ShoppingCart, DollarSign, ChefHat,
  UtensilsCrossed, LayoutGrid, Building2, Users, Settings, LogOut,
  Moon, Sun, Monitor, Globe, CalendarDays, UserCircle, MapPin,
  TrendingUp, Receipt, FileText, Wallet, LineChart, Calculator, Shield, Tag, Tags, Star, CreditCard,
  Search, ChevronDown, Pin, X, Puzzle, Lock, ClipboardCheck, LifeBuoy,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { usePlan } from '@/hooks/usePlan';
import type { PlanLimits } from '@/lib/plans';


interface NavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  keywords?: string;
  /** When set, the item is rendered with a lock icon if the current plan/add-ons
   *  do not include this feature. The link still navigates — the destination page
   *  shows the upgrade prompt via FeatureGate. */
  feature?: keyof PlanLimits;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    label: 'Overview',
    items: [
      { title: 'Dashboard', url: '/admin', icon: LayoutDashboard, keywords: 'home stats summary' },
    ],
  },
  {
    label: 'Operations',
    items: [
      { title: 'Orders', url: '/admin/orders', icon: ShoppingCart, keywords: 'tickets queue', feature: 'operations' },
      { title: 'POS', url: '/admin/pos', icon: Monitor, keywords: 'point of sale checkout', feature: 'operations' },
      { title: 'Kitchen', url: '/kitchen', icon: ChefHat, keywords: 'KDS chef cooking', feature: 'operations' },
      { title: 'Billing', url: '/admin/billing', icon: DollarSign, keywords: 'invoice payment', feature: 'operations' },
      { title: 'Tables', url: '/admin/tables', icon: LayoutGrid, keywords: 'seating layout', feature: 'operations' },
      { title: 'Floor Plans', url: '/admin/floor-plans', icon: MapPin, keywords: 'layout map', feature: 'floorPlans' },
      { title: 'Reservations', url: '/admin/reservations', icon: CalendarDays, keywords: 'bookings', feature: 'operations' },
    ],
  },
  {
    label: 'Accounting',
    items: [
      { title: 'Overview', url: '/admin/accounting', icon: LayoutDashboard, keywords: 'finance summary', feature: 'accounting' },
      { title: 'Sales & Revenue', url: '/admin/accounting/sales', icon: TrendingUp, keywords: 'income earnings', feature: 'accounting' },
      { title: 'Expenses', url: '/admin/accounting/expenses', icon: Receipt, keywords: 'costs spending', feature: 'accounting' },
      { title: 'Inventory', url: '/admin/accounting/inventory', icon: LayoutGrid, keywords: 'stock supply', feature: 'accounting' },
      { title: 'Stock Adjustments', url: '/admin/accounting/inventory/adjustments', icon: ClipboardCheck, keywords: 'waste damage cycle count correction shrinkage', feature: 'accounting' },
      { title: 'Payroll', url: '/admin/accounting/payroll', icon: Wallet, keywords: 'salary wages staff pay', feature: 'accounting' },
      { title: 'Forecasting', url: '/admin/accounting/forecasting', icon: LineChart, keywords: 'projection budget', feature: 'accounting' },
      { title: 'Tax Reports', url: '/admin/accounting/tax', icon: Calculator, keywords: 'vat gst', feature: 'accounting' },
      { title: 'Profit & Loss', url: '/admin/accounting/pnl', icon: FileText, keywords: 'pnl income statement', feature: 'accounting' },
      { title: 'Audit Trail', url: '/admin/accounting/audit', icon: Shield, keywords: 'history log', feature: 'accounting' },
      { title: 'Monthly Report', url: '/admin/accounting/report', icon: FileText, keywords: 'monthly summary', feature: 'accounting' },
    ],
  },
  {
    label: 'Management',
    items: [
      { title: 'Menu', url: '/admin/menu', icon: UtensilsCrossed, keywords: 'food items dishes' },
      { title: 'Customizations', url: '/admin/customizations', icon: Tags, keywords: 'tags addons options' },
      { title: 'Promotions', url: '/admin/promotions', icon: Tag, keywords: 'discounts deals offers', feature: 'promotions' },
      { title: 'Loyalty', url: '/admin/loyalty', icon: Star, keywords: 'rewards points', feature: 'loyalty' },
      { title: 'Homepage', url: '/admin/homepage', icon: Globe, keywords: 'website landing' },
      { title: 'Sitemap & SEO', url: '/admin/sitemap', icon: Search, keywords: 'search engine seo' },
      { title: 'Branches', url: '/admin/branches', icon: Building2, keywords: 'locations stores' },
      { title: 'Help & support', url: '/admin/support', icon: LifeBuoy, keywords: 'help chat support contact serveos' },
      { title: 'Staff', url: '/admin/staff', icon: Users, keywords: 'employees team' },
      { title: 'Subscription', url: '/admin/subscription', icon: CreditCard, keywords: 'plan billing membership addons extras marketplace' },
      { title: 'Settings', url: '/admin/settings', icon: Settings, keywords: 'config preferences' },
    ],
  },
];

const PINNED_KEY = 'admin:pinned-nav';
const COLLAPSED_GROUPS_KEY = 'admin:collapsed-nav-groups';

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

export default function AdminSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const location = useLocation();
  const { signOut, hasRole } = useAuth();
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const { data: plan } = usePlan();

  // A feature is "locked" if the merged plan-limits boolean is false. Numeric
  // limits and unset features are always considered unlocked here.
  const isFeatureLocked = useCallback(
    (feature?: keyof PlanLimits) => {
      if (!feature || !plan) return false;
      const v = plan.limits[feature];
      return typeof v === 'boolean' ? !v : false;
    },
    [plan],
  );

  // Owner-only items (e.g. Sitemap & SEO exposes structured data about every menu item).
  const OWNER_ONLY_URLS = useMemo(() => new Set(['/admin/sitemap']), []);
  const isAllowedItem = useCallback(
    (url: string) => (OWNER_ONLY_URLS.has(url) ? hasRole('owner') : true),
    [OWNER_ONLY_URLS, hasRole],
  );

  const [search, setSearch] = useState('');
  const [pinned, setPinned] = useState<string[]>(() => readJSON<string[]>(PINNED_KEY, []));
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>(
    () => readJSON<string[]>(COLLAPSED_GROUPS_KEY, []),
  );

  const searchInputRef = useRef<HTMLInputElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => writeJSON(PINNED_KEY, pinned), [pinned]);
  useEffect(() => writeJSON(COLLAPSED_GROUPS_KEY, collapsedGroups), [collapsedGroups]);

  // Close the mobile drawer whenever the route changes
  useEffect(() => {
    if (isMobile) setOpenMobile(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // Global shortcut: "/" or Cmd/Ctrl+K focuses the sidebar search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);

      const isSlash = e.key === '/' && !isTyping;
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';

      if (isSlash || isCmdK) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Arrow-key navigation between focusable nav items + section headers
  const handleNavKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter / Space → activate the currently focused nav item (navigate or toggle)
    if (e.key === 'Enter' || e.key === ' ') {
      const active = document.activeElement as HTMLElement | null;
      if (active?.dataset?.navFocusable === 'true') {
        e.preventDefault();
        active.click();
      }
      return;
    }

    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    const root = navContainerRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>('[data-nav-focusable="true"]'),
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusables.length === 0) return;

    const active = document.activeElement as HTMLElement | null;
    const currentIdx = active ? focusables.indexOf(active) : -1;

    // Shift+Arrow → jump between section anchors (headers + first pinned item).
    // Falls back gracefully when there are no pinned items (anchors = headers only)
    // and when there are no anchors at all (behaves like a normal arrow nav).
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.shiftKey) {
      const anchors = focusables.filter(
        (el) =>
          el.dataset.navSectionHeader === 'true' ||
          el.dataset.navGroupFirst === 'pinned',
      );

      if (anchors.length > 0) {
        let target: HTMLElement | undefined;
        if (e.key === 'ArrowDown') {
          target =
            anchors.find((el) => focusables.indexOf(el) > currentIdx) ?? anchors[0];
        } else {
          const before = anchors.filter((el) => focusables.indexOf(el) < currentIdx);
          target = before.length > 0 ? before[before.length - 1] : anchors[anchors.length - 1];
        }

        e.preventDefault();
        if (target) {
          target.focus();
          target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
        return;
      }
      // No anchors available — fall through to regular arrow navigation below.
    }

    let nextIdx = currentIdx;
    if (e.key === 'ArrowDown') nextIdx = currentIdx < 0 ? 0 : (currentIdx + 1) % focusables.length;
    else if (e.key === 'ArrowUp') nextIdx = currentIdx <= 0 ? focusables.length - 1 : currentIdx - 1;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = focusables.length - 1;

    e.preventDefault();
    const next = focusables[nextIdx];
    next?.focus();
    next?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, []);

  // When focus moves into a nav item via Tab/click, ensure it's visible
  const handleNavFocusIn = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target?.dataset?.navFocusable === 'true') {
      target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, []);

  // From the search input: ArrowDown jumps into the nav list
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      if (search) {
        setSearch('');
      } else {
        searchInputRef.current?.blur();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = navContainerRef.current?.querySelector<HTMLElement>(
        '[data-nav-focusable="true"]',
      );
      first?.focus();
    }
  };

  const allItems = useMemo(
    () => navSections.flatMap(s => s.items).filter(i => isAllowedItem(i.url)),
    [isAllowedItem],
  );
  const itemByUrl = useMemo(() => {
    const m = new Map<string, NavItem>();
    for (const i of allItems) m.set(i.url, i);
    return m;
  }, [allItems]);

  const isActiveUrl = (url: string) =>
    url === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(url);

  // Auto-expand the group containing the active route
  const activeSectionLabel = useMemo(() => {
    for (const s of navSections) {
      if (s.items.some(i => isActiveUrl(i.url))) return s.label;
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  const isGroupCollapsed = (label: string) =>
    collapsedGroups.includes(label) && label !== activeSectionLabel;

  const toggleGroup = (label: string) => {
    setCollapsedGroups(prev =>
      prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label],
    );
  };

  const togglePin = (url: string) => {
    setPinned(prev => (prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]));
  };

  const query = search.trim().toLowerCase();
  const filterItem = (i: NavItem) =>
    !query ||
    i.title.toLowerCase().includes(query) ||
    (i.keywords ?? '').toLowerCase().includes(query);

  const pinnedItems = pinned
    .map(url => itemByUrl.get(url))
    .filter((i): i is NavItem => Boolean(i))
    .filter(filterItem);

  const renderItem = (item: NavItem, opts?: { isFirstPinned?: boolean }) => {
    const isActive = isActiveUrl(item.url);
    const isPinned = pinned.includes(item.url);
    const locked = isFeatureLocked(item.feature);
    return (
      <SidebarMenuItem key={item.url}>
        <div className="group/item relative flex items-center">
          <SidebarMenuButton asChild isActive={isActive} className="flex-1">
            <NavLink
              to={item.url}
              end={item.url === '/admin'}
              className={cn(
                'hover:bg-accent/10 rounded-lg transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:bg-accent/10',
                locked && 'text-muted-foreground/70',
              )}
              activeClassName="bg-primary/10 text-primary font-semibold"
              data-nav-focusable="true"
              data-nav-group-first={opts?.isFirstPinned ? 'pinned' : undefined}
              aria-label={locked ? `${item.title} — locked, requires upgrade` : undefined}
            >
              <item.icon className="mr-2.5 h-4 w-4" strokeWidth={isActive ? 2 : 1.5} />
              {!collapsed && (
                <span className="text-[13px] truncate flex-1 flex items-center gap-1.5">
                  <span className="truncate">{item.title}</span>
                  {locked && (
                    <Lock
                      className="h-3 w-3 text-muted-foreground/60 shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                  )}
                </span>
              )}
            </NavLink>
          </SidebarMenuButton>
          {!collapsed && (
            <button
              type="button"
              aria-label={isPinned ? `Unpin ${item.title}` : `Pin ${item.title}`}
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(item.url); }}
              className={cn(
                'absolute right-1 h-6 w-6 rounded-md flex items-center justify-center transition-opacity',
                'text-muted-foreground hover:text-foreground hover:bg-accent/20',
                isPinned ? 'opacity-100 text-primary' : 'opacity-0 group-hover/item:opacity-100 focus:opacity-100',
              )}
            >
              <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} strokeWidth={1.5} />
            </button>
          )}
        </div>
      </SidebarMenuItem>
    );
  };

  return (
    <TooltipProvider delayDuration={300}>
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
              <div className="min-w-0">
                <span className="text-sm font-bold tracking-tight text-card-foreground truncate block">
                  {settings?.restaurant_name || 'RestaurantOS'}
                </span>
                <span className="block text-[10px] text-muted-foreground font-medium uppercase tracking-widest">
                  Admin Panel
                </span>
              </div>
            )}
          </div>

          <Separator className="mx-3 w-auto" />

          {/* Search */}
          {!collapsed && (
            <div className="px-3 pt-3 pb-1">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                <Input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Search menu…"
                  aria-label="Search navigation (press / or Cmd+K)"
                  className="h-8 pl-8 pr-12 text-[12px] bg-background/60 border-border/60 focus-visible:ring-1"
                />
                {search ? (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setSearch('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/20"
                  >
                    <X className="h-3 w-3" strokeWidth={1.5} />
                  </button>
                ) : (
                  <kbd className="absolute right-1.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center h-5 px-1.5 rounded border border-border/60 bg-muted/40 text-[10px] font-mono text-muted-foreground/70 pointer-events-none">
                    /
                  </kbd>
                )}
              </div>
            </div>
          )}

          <div ref={navContainerRef} onKeyDown={handleNavKeyDown} onFocus={handleNavFocusIn}>

          {/* Pinned (shown whenever pinned items match the current filter and sidebar is expanded) */}
          {!collapsed && pinnedItems.length > 0 && (
            <SidebarGroup>
              <div className="px-3 pt-3 pb-1.5 flex items-center gap-1.5">
                <Pin className="h-3 w-3 text-primary fill-current" strokeWidth={1.5} />
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                  Pinned
                  {query && (
                    <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/50">
                      ({pinnedItems.length})
                    </span>
                  )}
                </span>
              </div>
              <SidebarGroupContent>
                <SidebarMenu>{pinnedItems.map((item, idx) => renderItem(item, { isFirstPinned: idx === 0 }))}</SidebarMenu>
              </SidebarGroupContent>
              <Separator className="mx-3 mt-2 w-auto" />
            </SidebarGroup>
          )}

          {/* Sections */}
          {navSections.map((section) => {
            const visibleItems = section.items.filter(i => isAllowedItem(i.url)).filter(filterItem);
            if (visibleItems.length === 0) return null;

            // When searching, force-expand all groups
            const groupCollapsed = !query && isGroupCollapsed(section.label);

            return (
              <SidebarGroup key={section.label}>
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(section.label)}
                    className={cn(
                      'relative px-3 pt-3 pb-1.5 w-full flex items-center justify-between text-left rounded-md transition-all duration-150 group/header',
                      'hover:bg-accent/5',
                      'focus:outline-none focus:bg-primary/5',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background focus-visible:bg-primary/10',
                      // Left-edge accent bar — visible on focus to mark the active section header
                      'before:content-[""] before:absolute before:left-0 before:top-2 before:bottom-1 before:w-0.5 before:rounded-r-full before:bg-primary before:opacity-0 focus:before:opacity-100 focus-visible:before:opacity-100 before:transition-opacity',
                    )}
                    aria-expanded={!groupCollapsed}
                    data-nav-focusable="true"
                    data-nav-section-header="true"
                  >
                    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 group-focus/header:text-primary group-focus-visible/header:text-primary transition-colors">
                      {section.label}
                      {query && (
                        <span className="ml-1.5 normal-case tracking-normal text-muted-foreground/50">
                          ({visibleItems.length})
                        </span>
                      )}
                      {/* Active-focus dot — shows where Shift+Arrow focus has landed */}
                      <span
                        aria-hidden="true"
                        className="h-1 w-1 rounded-full bg-primary opacity-0 group-focus/header:opacity-100 group-focus-visible/header:opacity-100 transition-opacity"
                      />
                    </span>
                    <ChevronDown
                      className={cn(
                        'h-3 w-3 text-muted-foreground/60 transition-transform duration-200 group-focus/header:text-primary group-focus-visible/header:text-primary',
                        groupCollapsed && '-rotate-90',
                      )}
                      strokeWidth={2}
                    />
                  </button>
                )}
                {(!groupCollapsed || collapsed) && (
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {visibleItems.map(item => {
                        // In collapsed mode wrap with tooltip to show label
                        if (collapsed) {
                          return (
                            <Tooltip key={item.url}>
                              <TooltipTrigger asChild>
                                <div>{renderItem(item)}</div>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {item.title}
                              </TooltipContent>
                            </Tooltip>
                          );
                        }
                        return renderItem(item);
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                )}
              </SidebarGroup>
            );
          })}

          {/* Empty search state */}
          {!collapsed && query && navSections.every(s => s.items.filter(i => isAllowedItem(i.url)).filter(filterItem).length === 0) && (
            <div className="px-4 py-6 text-center">
              <Search className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-xs text-muted-foreground">No results for "{search}"</p>
            </div>
          )}
          </div>
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
    </TooltipProvider>
  );
}
