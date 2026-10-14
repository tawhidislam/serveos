import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { demoOrderStore, useDemoOrders, type DemoOrderStatus } from './useDemoOrderStore';
import {
  LayoutDashboard, ShoppingCart, ChefHat, UtensilsCrossed, LayoutGrid, Building2, Users,
  Settings, DollarSign, TrendingUp, Receipt, Wallet, LineChart, Calculator, FileText,
  Tag, Star, CreditCard, Search, Bell, Clock, Hash, Flame, Timer, CheckCircle2,
  ArrowRight, ClipboardList, CalendarDays, Globe, ShieldCheck,
  Plus, ShoppingBag, Heart, Filter, Monitor, MoreHorizontal, Download, Eye,
  Volume2, Printer, ArrowRightLeft, Pencil, RefreshCw,
  MapPin, Tags, Shield, Pin, ChevronDown, Lock, UserCircle, Moon, LogOut,
  Phone, Mail, Instagram, Facebook, ArrowUpRight, Menu as MenuIcon, Smartphone,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import demoWebsiteHero from '@/assets/demo-website-hero.jpg';
import demoDishTartufo from '@/assets/demo-dish-tartufo.jpg';
import demoDishBistecca from '@/assets/demo-dish-bistecca.jpg';
import demoDishRisotto from '@/assets/demo-dish-risotto.jpg';

interface NavItem { title: string; icon: LucideIcon; active?: boolean; locked?: boolean; key?: string; }
interface NavGroup { label: string; items: NavItem[]; }

const ADMIN_NAV: NavGroup[] = [
  { label: 'Overview', items: [{ title: 'Dashboard', icon: LayoutDashboard, key: 'dashboard' }] },
  { label: 'Operations', items: [
    { title: 'Orders', icon: ShoppingCart, key: 'orders' },
    { title: 'POS', icon: Monitor },
    { title: 'Kitchen', icon: ChefHat, key: 'kitchen' },
    { title: 'Billing', icon: DollarSign, key: 'billing' },
    { title: 'Tables', icon: LayoutGrid, key: 'tables' },
    { title: 'Floor Plans', icon: MapPin, locked: true },
    { title: 'Reservations', icon: CalendarDays },
  ]},
  { label: 'Accounting', items: [
    { title: 'Overview', icon: LayoutDashboard },
    { title: 'Sales & Revenue', icon: TrendingUp },
    { title: 'Expenses', icon: Receipt },
    { title: 'Inventory', icon: LayoutGrid },
    { title: 'Payroll', icon: Wallet },
    { title: 'Forecasting', icon: LineChart, locked: true },
    { title: 'Tax Reports', icon: Calculator },
    { title: 'Profit & Loss', icon: FileText },
    { title: 'Audit Trail', icon: Shield },
    { title: 'Monthly Report', icon: FileText },
  ]},
  { label: 'Management', items: [
    { title: 'Menu', icon: UtensilsCrossed, key: 'menu' },
    { title: 'Customizations', icon: Tags },
    { title: 'Promotions', icon: Tag },
    { title: 'Loyalty', icon: Star, locked: true },
    { title: 'Homepage', icon: Globe },
    { title: 'Sitemap & SEO', icon: Search },
    { title: 'Branches', icon: Building2 },
    { title: 'Staff', icon: Users },
    { title: 'Subscription', icon: CreditCard },
    { title: 'Settings', icon: Settings },
  ]},
];

function AdminChrome({
  title, brand = 'Bella Cucina', subline = 'Admin Panel', children, nav = ADMIN_NAV, badge,
  activeKey, onNavigate,
}: {
  title: string;
  brand?: string;
  subline?: string;
  badge?: string;
  children: React.ReactNode;
  nav?: NavGroup[];
  activeKey?: string;
  onNavigate?: (key: string) => void;
}) {
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);
  const [pinned, setPinned] = useState<string[]>(['Orders', 'Menu']);
  const toggleGroup = (label: string) =>
    setCollapsedGroups((prev) => (prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label]));
  const togglePin = (title: string) =>
    setPinned((prev) => (prev.includes(title) ? prev.filter((t) => t !== title) : [...prev, title]));

  const renderItem = (it: NavItem) => {
    const Icon = it.icon;
    const isActive = activeKey ? it.key === activeKey : !!it.active;
    const isInteractive = !!(it.key && onNavigate && !it.locked);
    const isPinned = pinned.includes(it.title);
    const baseCls = [
      'w-full text-left flex items-center gap-2.5 rounded-lg pl-2 pr-7 py-1.5 text-[11px] transition-all duration-150',
      isActive
        ? 'bg-primary/10 text-primary font-semibold'
        : it.locked
          ? 'text-muted-foreground/70 hover:bg-accent/10'
          : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
      isInteractive ? 'cursor-pointer' : 'cursor-default',
    ].join(' ');
    const inner = (
      <>
        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={isActive ? 2 : 1.5} />
        <span className="truncate flex-1 flex items-center gap-1">
          <span className="truncate">{it.title}</span>
          {it.locked && <Lock className="h-2.5 w-2.5 text-muted-foreground/60 shrink-0" strokeWidth={2} />}
        </span>
      </>
    );
    return (
      <li key={it.title} className="group/item relative flex items-center">
        {isInteractive ? (
          <button type="button" onClick={() => onNavigate!(it.key!)} className={baseCls} aria-current={isActive ? 'page' : undefined}>
            {inner}
          </button>
        ) : (
          <div className={baseCls} aria-current={isActive ? 'page' : undefined}>
            {inner}
          </div>
        )}
        <button
          type="button"
          aria-label={isPinned ? `Unpin ${it.title}` : `Pin ${it.title}`}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePin(it.title); }}
          className={[
            'absolute right-1 h-5 w-5 rounded flex items-center justify-center transition-opacity',
            'text-muted-foreground hover:text-foreground hover:bg-accent/20',
            isPinned ? 'opacity-100 text-primary' : 'opacity-0 group-hover/item:opacity-100',
          ].join(' ')}
        >
          <Pin className={['h-2.5 w-2.5', isPinned && 'fill-current'].filter(Boolean).join(' ')} strokeWidth={1.5} />
        </button>
      </li>
    );
  };

  const pinnedItems = pinned
    .map((t) => nav.flatMap((g) => g.items).find((i) => i.title === t))
    .filter((i): i is NavItem => Boolean(i));

  return (
    <div className="absolute inset-0 flex bg-background text-foreground select-none">
      <aside className="w-[220px] shrink-0 border-r border-border bg-card hidden sm:flex flex-col">
        {/* Logo block — mirrors real AdminSidebar header */}
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <span className="text-[12px] font-bold tracking-tight text-card-foreground truncate block">{brand}</span>
            <span className="block text-[9px] text-muted-foreground font-medium uppercase tracking-widest">{subline}</span>
          </div>
        </div>
        <div className="mx-3 h-px bg-border" />
        {/* Search with / kbd hint */}
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
            <div className="h-7 rounded-md border border-border bg-background/60 pl-7 pr-9 text-[11px] text-muted-foreground flex items-center">
              Search menu…
            </div>
            <kbd className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center h-5 px-1.5 rounded border border-border/60 bg-muted/40 text-[9px] font-mono text-muted-foreground/70 pointer-events-none">
              /
            </kbd>
          </div>
        </div>
        <nav className="flex-1 overflow-hidden px-1.5 py-2 space-y-1">
          {/* Pinned section */}
          {pinnedItems.length > 0 && (
            <div>
              <div className="px-3 pt-2 pb-1.5 flex items-center gap-1.5">
                <Pin className="h-2.5 w-2.5 text-primary fill-current" strokeWidth={1.5} />
                <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">Pinned</span>
              </div>
              <ul className="space-y-0.5">{pinnedItems.map(renderItem)}</ul>
              <div className="mx-2 mt-2 h-px bg-border" />
            </div>
          )}
          {nav.map((g) => {
            const isCollapsed = collapsedGroups.includes(g.label);
            return (
              <div key={g.label}>
                <button
                  type="button"
                  onClick={() => toggleGroup(g.label)}
                  className="px-3 pt-2 pb-1.5 w-full flex items-center justify-between text-left rounded-md hover:bg-accent/5 transition-colors"
                  aria-expanded={!isCollapsed}
                >
                  <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                    {g.label}
                  </span>
                  <ChevronDown
                    className={['h-2.5 w-2.5 text-muted-foreground/60 transition-transform duration-200', isCollapsed && '-rotate-90'].filter(Boolean).join(' ')}
                    strokeWidth={2}
                  />
                </button>
                {!isCollapsed && <ul className="space-y-0.5">{g.items.map(renderItem)}</ul>}
              </div>
            );
          })}
        </nav>
        {/* Footer — mirrors My Profile / Theme / Sign Out */}
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-foreground cursor-default">
            <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>My Profile</span>
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-foreground cursor-default">
            <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Dark Mode</span>
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-destructive cursor-default">
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-border bg-card/60 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <h1 className="text-[13px] font-semibold tracking-tight">{title}</h1>
            {badge && (
              <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/10 text-success border border-success/20 font-medium">
                {badge}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button className="h-7 w-7 rounded-md hover:bg-accent/10 flex items-center justify-center">
              <Bell className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button className="h-7 w-7 rounded-md hover:bg-accent/10 flex items-center justify-center">
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary">M</div>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-5 space-y-4">{children}</main>
      </div>
    </div>
  );
}

function StatCard({
  label, value, delta, deltaPositive = true, icon: Icon, accent,
}: {
  label: string; value: string; delta?: string; deltaPositive?: boolean;
  icon: LucideIcon; accent?: 'success' | 'primary' | 'warning' | 'muted';
}) {
  const accentMap: Record<string, string> = {
    success: 'text-success bg-success/10',
    primary: 'text-primary bg-primary/10',
    warning: 'text-warning bg-warning/10',
    muted: 'text-muted-foreground bg-muted',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-3.5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="mt-1 text-xl font-bold tabular-nums tracking-tight">{value}</div>
          {delta && (
            <div className={`mt-1 text-[10px] font-medium ${deltaPositive ? 'text-success' : 'text-destructive'}`}>
              {deltaPositive ? '▲' : '▼'} {delta}
            </div>
          )}
        </div>
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${accentMap[accent ?? 'primary']}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function Sparkline({ data, color = 'primary' }: { data: number[]; color?: 'primary' | 'success' }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const w = 100;
  const h = 30;
  const step = w / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => `${i * step},${h - ((v - min) / range) * h}`).join(' ');
  const stroke = color === 'success' ? 'hsl(var(--success))' : 'hsl(var(--primary))';
  const fill = color === 'success' ? 'hsl(var(--success) / 0.12)' : 'hsl(var(--primary) / 0.12)';
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-full">
      <polygon points={`0,${h} ${pts} ${w},${h}`} fill={fill} />
      <polyline points={pts} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function RevenueChart() {
  const hours = Array.from({ length: 18 }, (_, i) => 6 + i);
  const data = [120, 80, 220, 410, 680, 540, 320, 280, 410, 720, 980, 1140, 760, 510, 380, 290, 180, 90];
  const max = Math.max(...data);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-[12px] font-semibold">Revenue today</div>
          <div className="text-[10px] text-muted-foreground">Hourly · $ USD</div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Today
          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30 ml-2" /> Avg
        </div>
      </div>
      <div className="h-[120px] flex items-end gap-1.5">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-gradient-to-t from-primary/70 to-primary"
              style={{ height: `${(v / max) * 100}%` }}
            />
            <span className="text-[8px] text-muted-foreground/70 font-mono">{hours[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrderStatusBreakdown() {
  const items = [
    { label: 'Pending', count: 6, color: 'bg-warning' },
    { label: 'Preparing', count: 11, color: 'bg-primary' },
    { label: 'Ready', count: 4, color: 'bg-success' },
    { label: 'Completed', count: 32, color: 'bg-muted-foreground/40' },
  ];
  const total = items.reduce((s, x) => s + x.count, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-semibold">Order status</div>
        <div className="text-[10px] text-muted-foreground">{total} today</div>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden mb-3">
        {items.map((it) => (
          <div key={it.label} className={it.color} style={{ width: `${(it.count / total) * 100}%` }} />
        ))}
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${it.color}`} />
              <span className="text-muted-foreground">{it.label}</span>
            </div>
            <span className="tabular-nums font-medium">{it.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopItems() {
  const items = [
    { name: 'Tagliatelle al Tartufo', count: 28, revenue: '$728' },
    { name: 'Bistecca alla Fiorentina', count: 19, revenue: '$1,140' },
    { name: 'Tiramisu della Casa', count: 41, revenue: '$369' },
    { name: 'Burrata e Pomodoro', count: 22, revenue: '$308' },
    { name: 'Risotto ai Funghi', count: 17, revenue: '$391' },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[12px] font-semibold">Top selling items</div>
        <button className="text-[10px] text-primary hover:underline">View all</button>
      </div>
      <div className="divide-y divide-border">
        {items.map((it, i) => (
          <div key={it.name} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-6 w-6 rounded-md bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">{i + 1}</div>
              <div className="min-w-0">
                <div className="text-[11px] font-medium truncate">{it.name}</div>
                <div className="text-[9px] text-muted-foreground">{it.count} sold today</div>
              </div>
            </div>
            <div className="text-[11px] font-bold tabular-nums">{it.revenue}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

const OWNER_NAV: NavGroup[] = [
  { label: 'Overview', items: [
    { title: 'Dashboard', icon: LayoutDashboard, active: true },
    { title: 'Analytics', icon: TrendingUp },
  ]},
  { label: 'Brand', items: [
    { title: 'Branding', icon: Star },
    { title: 'Homepage', icon: Globe },
    { title: 'Domain', icon: ShieldCheck },
  ]},
  { label: 'Team', items: [
    { title: 'Staff', icon: Users },
    { title: 'Branches', icon: Building2 },
  ]},
  { label: 'Account', items: [
    { title: 'Subscription', icon: CreditCard },
    { title: 'Billing', icon: DollarSign },
    { title: 'Settings', icon: Settings },
  ]},
];

export function OwnerPanelMock() {
  return (
    <AdminChrome title="Owner Dashboard" brand="Bella Cucina" subline="Owner Suite" badge="Live" nav={OWNER_NAV}>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Good evening, Marco 👋</h2>
            <p className="text-[11px] text-muted-foreground">Here is how Bella Cucina is performing this week.</p>
          </div>
          <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
            <RefreshCw className="h-3 w-3" /> Updated 2m ago
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="7-day revenue" value="$48,210" delta="12.4%" icon={DollarSign} accent="success" />
          <StatCard label="Paid orders" value="612" delta="8.1%" icon={ShoppingBag} accent="primary" />
          <StatCard label="Avg ticket" value="$78.90" delta="2.3%" icon={TrendingUp} accent="primary" />
          <StatCard label="Active staff" value="14" icon={Users} accent="muted" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[12px] font-semibold">Revenue trend</div>
                <div className="text-[10px] text-muted-foreground">Last 14 days</div>
              </div>
              <div className="text-right">
                <div className="text-base font-bold tabular-nums">$48,210</div>
                <div className="text-[10px] text-success">▲ 12.4% vs prior</div>
              </div>
            </div>
            <div className="h-[110px]">
              <Sparkline data={[12, 18, 14, 22, 28, 26, 31, 29, 35, 41, 38, 44, 47, 52]} color="success" />
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[12px] font-semibold mb-3">Branch performance</div>
            <div className="space-y-2.5">
              {[
                { name: 'Downtown', value: '$22.1k', share: 70 },
                { name: 'Riverside', value: '$14.8k', share: 48 },
                { name: 'Airport', value: '$11.3k', share: 36 },
              ].map((b) => (
                <div key={b.name}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium">{b.name}</span>
                    <span className="text-muted-foreground tabular-nums">{b.value}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${b.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TopItems />
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="text-[12px] font-semibold mb-3">Recent activity</div>
            <div className="space-y-2.5">
              {[
                { who: 'Sofia · Manager', what: 'Updated menu prices', when: '12m' },
                { who: 'Kitchen', what: 'Marked 4 tickets ready', when: '18m' },
                { who: 'Luca · Waiter', what: 'Closed table 7 ($142)', when: '26m' },
                { who: 'System', what: 'Daily report generated', when: '1h' },
              ].map((a, i) => (
                <div key={i} className="flex items-start gap-2 text-[11px]">
                  <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                  </div>
                  <div className="flex-1">
                    <span className="font-medium">{a.who}</span>{' '}
                    <span className="text-muted-foreground">{a.what}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{a.when}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AdminChrome>
  );
}

/* ===== Admin sub-views ===== */

function AdminDashboardView() {
  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Good evening 👋</h2>
          <p className="text-[11px] text-muted-foreground">Here is what is happening with your restaurant today.</p>
        </div>
        <div className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" /> Updated just now
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Today's revenue" value="$6,842" delta="9.2%" icon={DollarSign} accent="success" />
        <StatCard label="Orders today" value="89" delta="12 vs avg" icon={ShoppingCart} accent="primary" />
        <StatCard label="Active now" value="11" icon={Clock} accent="warning" />
        <StatCard label="Tables" value="14/22" icon={LayoutGrid} accent="muted" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-3"><RevenueChart /></div>
        <div className="sm:col-span-2"><OrderStatusBreakdown /></div>
      </div>

      <TopItems />
    </motion.div>
  );
}

const ORDER_ROWS = [
  { num: 1289, table: 'Table 9',   items: 4, total: '$112.50', status: 'pending'    as const, when: '1m ago' },
  { num: 1288, table: 'Bar 2',     items: 3, total: '$48.00',  status: 'ready'      as const, when: '2m ago' },
  { num: 1287, table: 'Table 3',   items: 3, total: '$96.40',  status: 'preparing'  as const, when: '6m ago' },
  { num: 1286, table: 'Takeaway',  items: 3, total: '$54.20',  status: 'preparing'  as const, when: '9m ago' },
  { num: 1285, table: 'Table 12',  items: 3, total: '$184.00', status: 'preparing'  as const, when: '12m ago' },
  { num: 1284, table: 'Table 7',   items: 5, total: '$142.10', status: 'served'     as const, when: '18m ago' },
  { num: 1283, table: 'Patio 4',   items: 4, total: '$210.00', status: 'completed'  as const, when: '24m ago' },
  { num: 1282, table: 'Table 5',   items: 6, total: '$168.30', status: 'completed'  as const, when: '32m ago' },
];

const ORDER_STATUS = {
  pending:    { label: 'Pending',    color: 'text-warning',          bg: 'bg-warning/10',          icon: Clock },
  preparing:  { label: 'Preparing',  color: 'text-primary',          bg: 'bg-primary/10',          icon: ChefHat },
  ready:      { label: 'Ready',      color: 'text-success',          bg: 'bg-success/10',          icon: Bell },
  served:     { label: 'Served',     color: 'text-muted-foreground', bg: 'bg-muted',               icon: CheckCircle2 },
  completed:  { label: 'Completed',  color: 'text-muted-foreground', bg: 'bg-muted',               icon: CheckCircle2 },
} as const;

function OrdersView() {
  const [filter, setFilter] = useState<'all' | 'pending' | 'preparing' | 'ready' | 'completed'>('all');
  const liveOrders = useDemoOrders();
  const liveRows = liveOrders.map((o) => {
    const mins = Math.max(1, Math.floor((Date.now() - o.createdAt) / 60000));
    return {
      id: o.id,
      num: o.num,
      table: o.table,
      items: o.items.reduce((s, i) => s + i.qty, 0),
      total: `$${o.total.toFixed(2)}`,
      status: o.status,
      when: mins < 1 ? 'just now' : `${mins}m ago`,
      fresh: o.fresh,
    };
  });
  const staticRows = ORDER_ROWS.map((o) => ({ ...o, id: `static-${o.num}`, fresh: false }));
  const allRows = [...liveRows, ...staticRows];
  const filtered = allRows.filter((o) => filter === 'all' || o.status === filter);
  const tabs: { key: typeof filter; label: string; count: number }[] = [
    { key: 'all',        label: 'All',        count: allRows.length },
    { key: 'pending',    label: 'Pending',    count: allRows.filter(o => o.status === 'pending').length },
    { key: 'preparing',  label: 'Preparing',  count: allRows.filter(o => o.status === 'preparing').length },
    { key: 'ready',      label: 'Ready',      count: allRows.filter(o => o.status === 'ready').length },
    { key: 'completed',  label: 'Completed',  count: allRows.filter(o => o.status === 'completed' || o.status === 'served').length },
  ];
  return (
    <motion.div
      key="orders"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Orders</h2>
          <p className="text-[11px] text-muted-foreground">All tickets across dine-in, takeaway, and QR.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-7 px-2.5 rounded-md border border-border text-[10px] flex items-center gap-1">
            <Download className="h-3 w-3" /> Export
          </button>
          <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
            <Plus className="h-3 w-3" /> New order
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={[
              'h-7 px-2.5 rounded-md text-[10px] font-medium flex items-center gap-1.5 border transition-colors',
              filter === t.key
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:text-foreground',
            ].join(' ')}
          >
            {t.label}
            <span className={`text-[9px] px-1 rounded ${filter === t.key ? 'bg-primary-foreground/20' : 'bg-muted'}`}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="grid grid-cols-[60px_1fr_70px_90px_110px_70px_36px] items-center px-3 py-2 border-b border-border bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
          <div>#</div>
          <div>Table</div>
          <div className="text-right">Items</div>
          <div className="text-right">Total</div>
          <div>Status</div>
          <div className="text-right">When</div>
          <div></div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((o) => {
            const s = ORDER_STATUS[o.status];
            const StatusIcon = s.icon;
            return (
              <motion.div
                key={o.id}
                layout
                initial={o.fresh ? { backgroundColor: 'hsl(var(--success) / 0.18)' } : false}
                animate={{ backgroundColor: 'hsl(var(--success) / 0)' }}
                transition={{ duration: 5, ease: 'easeOut' }}
                className="grid grid-cols-[60px_1fr_70px_90px_110px_70px_36px] items-center px-3 py-2.5 text-[11px] hover:bg-accent/5"
              >
                <div className="font-mono font-bold text-primary flex items-center gap-1">
                  #{o.num}
                  {o.fresh && <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />}
                </div>
                <div className="font-medium truncate">{o.table}</div>
                <div className="text-right text-muted-foreground tabular-nums">{o.items}</div>
                <div className="text-right font-bold tabular-nums">{o.total}</div>
                <div>
                  <span className={`${s.bg} ${s.color} inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full`}>
                    <StatusIcon className="h-2.5 w-2.5" />
                    {s.label}
                  </span>
                </div>
                <div className="text-right text-[10px] text-muted-foreground">{o.when}</div>
                <div className="text-right">
                  <button className="h-6 w-6 rounded-md hover:bg-accent/20 flex items-center justify-center ml-auto">
                    <MoreHorizontal className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </motion.div>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-[11px] text-muted-foreground">No orders match this filter.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

const MENU_CATS = [
  { name: 'Antipasti', count: 8, active: false },
  { name: 'Pasta',     count: 12, active: true },
  { name: 'Pizza',     count: 9, active: false },
  { name: 'Mains',     count: 11, active: false },
  { name: 'Dolci',     count: 6, active: false },
  { name: 'Drinks',    count: 18, active: false },
];

const MENU_ITEMS = [
  { name: 'Tagliatelle al Tartufo', cat: 'Pasta', price: '$26', stock: 'In stock',  sold: 28, available: true },
  { name: 'Spaghetti Carbonara',    cat: 'Pasta', price: '$19', stock: 'In stock',  sold: 22, available: true },
  { name: 'Ravioli di Zucca',       cat: 'Pasta', price: '$21', stock: 'Low (4)',   sold: 14, available: true },
  { name: 'Lasagne della Nonna',    cat: 'Pasta', price: '$22', stock: 'In stock',  sold: 19, available: true },
  { name: 'Pappardelle al Cinghiale', cat: 'Pasta', price: '$24', stock: 'In stock', sold: 11, available: true },
  { name: 'Penne Arrabbiata',       cat: 'Pasta', price: '$17', stock: '86\'d',     sold: 0,  available: false },
];

function MenuView() {
  return (
    <motion.div
      key="menu"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Menu</h2>
          <p className="text-[11px] text-muted-foreground">64 items across 6 categories.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-7 px-2.5 rounded-md border border-border text-[10px] flex items-center gap-1">
            <Filter className="h-3 w-3" /> Filter
          </button>
          <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
            <Plus className="h-3 w-3" /> New item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-3">
        <div className="rounded-xl border border-border bg-card p-2 space-y-0.5 h-fit">
          <div className="px-2 py-1 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Categories</div>
          {MENU_CATS.map((c) => (
            <button
              key={c.name}
              className={[
                'w-full text-left flex items-center justify-between rounded-md px-2 py-1.5 text-[11px] transition-colors',
                c.active ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
              ].join(' ')}
            >
              <span className="truncate">{c.name}</span>
              <span className="text-[9px] tabular-nums">{c.count}</span>
            </button>
          ))}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-[1fr_70px_90px_70px_36px] items-center px-3 py-2 border-b border-border bg-muted/40 text-[9px] uppercase tracking-wider text-muted-foreground font-medium">
            <div>Item</div>
            <div className="text-right">Price</div>
            <div>Stock</div>
            <div className="text-right">Sold today</div>
            <div></div>
          </div>
          <div className="divide-y divide-border">
            {MENU_ITEMS.map((m) => (
              <div key={m.name} className="grid grid-cols-[1fr_70px_90px_70px_36px] items-center px-3 py-2.5 text-[11px] hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-md bg-gradient-to-br from-primary/20 to-warning/20 shrink-0 flex items-center justify-center">
                    <UtensilsCrossed className="h-3.5 w-3.5 text-primary/70" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{m.name}</div>
                    <div className="text-[9px] text-muted-foreground">{m.cat}</div>
                  </div>
                </div>
                <div className="text-right font-bold tabular-nums text-primary">{m.price}</div>
                <div>
                  <span className={[
                    'inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full',
                    m.stock === 'In stock'   ? 'bg-success/10 text-success'
                    : m.stock.startsWith('Low') ? 'bg-warning/10 text-warning'
                    : 'bg-destructive/10 text-destructive',
                  ].join(' ')}>
                    {m.stock}
                  </span>
                </div>
                <div className="text-right tabular-nums text-muted-foreground">{m.sold}</div>
                <div className="text-right">
                  <button className="h-6 w-6 rounded-md hover:bg-accent/20 flex items-center justify-center ml-auto">
                    <Pencil className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const TABLES = [
  { num: 1,  seats: 2, status: 'available' as const,  party: '' },
  { num: 2,  seats: 4, status: 'occupied'  as const, party: 'Rossi · 28m' },
  { num: 3,  seats: 4, status: 'occupied'  as const, party: 'Bianchi · 14m' },
  { num: 4,  seats: 6, status: 'reserved'  as const, party: 'Conti · 19:30' },
  { num: 5,  seats: 2, status: 'occupied'  as const, party: 'Walk-in · 22m' },
  { num: 6,  seats: 4, status: 'available' as const, party: '' },
  { num: 7,  seats: 6, status: 'occupied'  as const, party: 'Greco · 18m' },
  { num: 8,  seats: 2, status: 'cleaning'  as const, party: '' },
  { num: 9,  seats: 4, status: 'occupied'  as const, party: 'Marino · 6m' },
  { num: 10, seats: 8, status: 'reserved'  as const, party: 'Esposito · 20:00' },
  { num: 11, seats: 2, status: 'available' as const, party: '' },
  { name: 'Bar 1', num: 12, seats: 1, status: 'occupied' as const, party: 'Solo' },
  { name: 'Bar 2', num: 13, seats: 1, status: 'occupied' as const, party: 'Solo' },
  { name: 'Bar 3', num: 14, seats: 1, status: 'available' as const, party: '' },
];

const TABLE_STATUS = {
  available: { color: 'text-success',          bg: 'bg-success/10 border-success/30',         label: 'Open' },
  occupied:  { color: 'text-primary',          bg: 'bg-primary/10 border-primary/30',         label: 'Occupied' },
  reserved:  { color: 'text-warning',          bg: 'bg-warning/10 border-warning/30',         label: 'Reserved' },
  cleaning:  { color: 'text-muted-foreground', bg: 'bg-muted border-border',                  label: 'Cleaning' },
} as const;

function TablesView() {
  const counts = {
    available: TABLES.filter(t => t.status === 'available').length,
    occupied:  TABLES.filter(t => t.status === 'occupied').length,
    reserved:  TABLES.filter(t => t.status === 'reserved').length,
    cleaning:  TABLES.filter(t => t.status === 'cleaning').length,
  };
  return (
    <motion.div
      key="tables"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Tables</h2>
          <p className="text-[11px] text-muted-foreground">Live floor — {counts.occupied}/{TABLES.length} occupied.</p>
        </div>
        <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
          <Plus className="h-3 w-3" /> Add table
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Open"     value={String(counts.available)} icon={CheckCircle2} accent="success" />
        <StatCard label="Occupied" value={String(counts.occupied)}  icon={Users}        accent="primary" />
        <StatCard label="Reserved" value={String(counts.reserved)}  icon={CalendarDays} accent="warning" />
        <StatCard label="Cleaning" value={String(counts.cleaning)}  icon={RefreshCw}    accent="muted"   />
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[12px] font-semibold">Floor plan</div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            {Object.entries(TABLE_STATUS).map(([k, v]) => (
              <span key={k} className="inline-flex items-center gap-1">
                <span className={`h-2 w-2 rounded-full ${v.bg.split(' ')[0]}`} />
                {v.label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2.5">
          {TABLES.map((t) => {
            const s = TABLE_STATUS[t.status];
            return (
              <div
                key={`${t.num}-${(t as any).name ?? ''}`}
                className={`rounded-lg border ${s.bg} p-2.5 aspect-square flex flex-col items-center justify-center text-center transition-transform hover:scale-105 cursor-pointer`}
              >
                <div className={`text-[10px] font-bold ${s.color}`}>
                  {(t as any).name ?? `T${t.num}`}
                </div>
                <div className="text-[8px] text-muted-foreground mt-0.5">{t.seats} seats</div>
                {t.party && (
                  <div className={`text-[8px] mt-1 font-medium ${s.color} truncate max-w-full px-1`}>{t.party}</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

const INVOICES = [
  { num: 'INV-2841', table: 'Table 7',  amount: '$142.10', method: 'Card',  paid: true,  when: '12m ago' },
  { num: 'INV-2840', table: 'Bar 2',    amount: '$48.00',  method: 'Cash',  paid: true,  when: '24m ago' },
  { num: 'INV-2839', table: 'Patio 4',  amount: '$210.00', method: 'Card',  paid: true,  when: '38m ago' },
  { num: 'INV-2838', table: 'Table 5',  amount: '$96.40',  method: 'Card',  paid: true,  when: '52m ago' },
  { num: 'INV-2837', table: 'Takeaway', amount: '$54.20',  method: 'Card',  paid: true,  when: '1h ago' },
  { num: 'INV-2836', table: 'Table 12', amount: '$184.00', method: 'Split', paid: false, when: '1h ago' },
];

function BillingView() {
  return (
    <motion.div
      key="billing"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.18 }}
      className="space-y-4"
    >
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Billing</h2>
          <p className="text-[11px] text-muted-foreground">Invoices, payments, and cash drawer.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-7 px-2.5 rounded-md border border-border text-[10px] flex items-center gap-1">
            <Printer className="h-3 w-3" /> Print Z-report
          </button>
          <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> Open drawer
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Net today"   value="$6,842" delta="9.2%" icon={DollarSign} accent="success" />
        <StatCard label="Cash"        value="$1,210" icon={Wallet}     accent="primary" />
        <StatCard label="Card"        value="$5,418" icon={CreditCard} accent="primary" />
        <StatCard label="Open tabs"   value="4"      icon={Receipt}    accent="warning" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        <div className="sm:col-span-3 rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="text-[12px] font-semibold">Recent invoices</div>
            <button className="text-[10px] text-primary hover:underline">View all</button>
          </div>
          <div className="divide-y divide-border">
            {INVOICES.map((inv) => (
              <div key={inv.num} className="grid grid-cols-[100px_1fr_80px_90px_70px_28px] items-center px-4 py-2.5 text-[11px] hover:bg-accent/5 transition-colors">
                <div className="font-mono font-medium">{inv.num}</div>
                <div className="text-muted-foreground truncate">{inv.table}</div>
                <div className="text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                    {inv.method}
                  </span>
                </div>
                <div className="text-right font-bold tabular-nums">{inv.amount}</div>
                <div>
                  {inv.paid ? (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success/10 text-success">
                      <CheckCircle2 className="h-2.5 w-2.5" /> Paid
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/10 text-warning">
                      <Clock className="h-2.5 w-2.5" /> Open
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <button className="h-6 w-6 rounded-md hover:bg-accent/20 flex items-center justify-center ml-auto">
                    <Eye className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="sm:col-span-2 rounded-xl border border-border bg-card p-4">
          <div className="text-[12px] font-semibold mb-3">Payment methods</div>
          <div className="space-y-2.5">
            {[
              { name: 'Card · Visa/MC',    share: 64, value: '$4,378' },
              { name: 'Cash',              share: 18, value: '$1,210' },
              { name: 'Apple/Google Pay',  share: 12, value: '$821'   },
              { name: 'Split',             share: 6,  value: '$433'   },
            ].map((c) => (
              <div key={c.name}>
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground tabular-nums">{c.value} · {c.share}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${c.share}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

const ADMIN_VIEWS: Record<string, { title: string; render: () => JSX.Element }> = {
  dashboard: { title: 'Dashboard', render: () => <AdminDashboardView /> },
  orders:    { title: 'Orders',    render: () => <OrdersView /> },
  menu:      { title: 'Menu',      render: () => <MenuView /> },
  tables:    { title: 'Tables',    render: () => <TablesView /> },
  billing:   { title: 'Billing',   render: () => <BillingView /> },
};

export function AdminPanelMock() {
  const [view, setView] = useState<string>('dashboard');
  const current = ADMIN_VIEWS[view] ?? ADMIN_VIEWS.dashboard;
  return (
    <AdminChrome
      title={current.title}
      badge="Live"
      activeKey={view}
      onNavigate={(key) => {
        if (ADMIN_VIEWS[key]) setView(key);
      }}
    >
      <AnimatePresence mode="wait">{current.render()}</AnimatePresence>
    </AdminChrome>
  );
}

export function ManagerPanelMock() {
  const nav: NavGroup[] = ADMIN_NAV.map((g) => ({
    ...g,
    items: g.items.map((it) => ({
      ...it,
      active: it.title === 'Sales & Revenue',
      locked: ['Subscription', 'Billing', 'Settings'].includes(it.title) ? true : it.locked,
    })),
  }));
  return (
    <AdminChrome title="Sales & Revenue" badge="Live" nav={nav}>
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Sales overview</h2>
            <p className="text-[11px] text-muted-foreground">Operational view — billing locked to owner.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="h-7 px-2.5 rounded-md border border-border text-[10px] flex items-center gap-1">
              <Filter className="h-3 w-3" /> This week
            </button>
            <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-[10px] font-medium">Export</button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Net sales" value="$32,140" delta="6.4%" icon={DollarSign} accent="success" />
          <StatCard label="Refunds" value="$214" delta="0.7%" deltaPositive={false} icon={Receipt} accent="warning" />
          <StatCard label="Tips" value="$2,810" delta="11.0%" icon={Star} accent="primary" />
          <StatCard label="Cover avg" value="$42.10" icon={Users} accent="muted" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          <div className="sm:col-span-3"><RevenueChart /></div>
          <div className="sm:col-span-2 rounded-xl border border-border bg-card p-4">
            <div className="text-[12px] font-semibold mb-3">Channel mix</div>
            <div className="space-y-2.5">
              {[
                { name: 'Dine-in', share: 62, value: '$19.9k' },
                { name: 'Takeaway', share: 22, value: '$7.1k' },
                { name: 'QR table order', share: 11, value: '$3.5k' },
                { name: 'Phone', share: 5, value: '$1.6k' },
              ].map((c) => (
                <div key={c.name}>
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted-foreground tabular-nums">{c.value} · {c.share}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${c.share}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </AdminChrome>
  );
}

// Real KitchenPage is rendered inside AdminLayout, so the demo mock
// uses the same ADMIN_NAV with `kitchen` highlighted — pixel-matching
// what staff see in production.

function KdsTicket({
  num, table, mins, status, items, onAdvance, fresh,
}: {
  num: number; table: string; mins: number;
  status: 'pending' | 'preparing' | 'ready';
  items: { name: string; qty: number; note?: string; tag?: string }[];
  onAdvance?: () => void;
  fresh?: boolean;
}) {
  const cfg = {
    pending:   { label: 'NEW',     color: 'text-warning', bg: 'bg-warning/10',  ring: 'ring-warning/30',  next: 'Start cooking' },
    preparing: { label: 'COOKING', color: 'text-primary', bg: 'bg-primary/10',  ring: 'ring-primary/30',  next: 'Mark ready'    },
    ready:     { label: 'READY',   color: 'text-success', bg: 'bg-success/10',  ring: 'ring-success/40',  next: 'Bump'          },
  }[status];
  const overdue = mins > 12;
  return (
    <div className={`relative rounded-xl border border-border bg-card overflow-hidden ring-1 ${cfg.ring} flex flex-col ${fresh ? 'shadow-[0_0_0_3px_hsl(var(--success)/0.4)]' : ''}`}>
      {fresh && (
        <span className="absolute -top-1.5 -right-1.5 z-10 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-success text-success-foreground animate-pulse">NEW</span>
      )}
      <div className={`${cfg.bg} px-3 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <Hash className={`h-3.5 w-3.5 ${cfg.color}`} />
          <span className={`text-[12px] font-bold ${cfg.color}`}>#{num}</span>
          <span className="text-[10px] text-muted-foreground">· {table}</span>
        </div>
        <span className={`text-[9px] font-bold uppercase tracking-wider ${cfg.color}`}>{cfg.label}</span>
      </div>
      <div className="px-3 py-2.5 flex-1 space-y-1.5">
        {items.map((it, i) => (
          <div key={i} className="text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="font-medium truncate">{it.qty}× {it.name}</span>
              {it.tag && (
                <span className="text-[9px] px-1.5 rounded-full bg-warning/10 text-warning border border-warning/30 shrink-0">
                  {it.tag}
                </span>
              )}
            </div>
            {it.note && <div className="text-[10px] text-muted-foreground italic">↳ {it.note}</div>}
          </div>
        ))}
      </div>
      <div className="px-3 py-2 border-t border-border flex items-center justify-between bg-background/40">
        <div className={`flex items-center gap-1 text-[10px] ${overdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
          {overdue ? <Flame className="h-3 w-3" /> : <Timer className="h-3 w-3" />}
          {mins}m
        </div>
        <button
          onClick={onAdvance}
          className={`text-[10px] font-bold uppercase tracking-wider ${cfg.color} flex items-center gap-1 hover:opacity-80 transition-opacity`}
        >
          {cfg.next} <ArrowRight className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export function KitchenPanelMock() {
  const liveOrders = useDemoOrders();
  const liveKitchen = liveOrders.filter((o) => o.status !== 'served');
  const baseAll = 9, baseNew = 3, baseCooking = 4, baseReady = 2;
  const counts = {
    all: baseAll + liveKitchen.length,
    incoming: baseNew + liveKitchen.filter((o) => o.status === 'pending').length,
    cooking: baseCooking + liveKitchen.filter((o) => o.status === 'preparing').length,
    ready: baseReady + liveKitchen.filter((o) => o.status === 'ready').length,
  };
  return (
    <AdminChrome title="Kitchen Display" badge="KDS" subline="Admin Panel" activeKey="kitchen">
      {/* Real-page header — logo + live indicator + sticky tab strip */}
      <div className="-mx-4 lg:-mx-5 -mt-4 mb-3">
        <div className="bg-card/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Flame className="h-4 w-4 text-primary" strokeWidth={2} />
              </div>
              <div className="min-w-0">
                <h2 className="text-[13px] font-bold tracking-tight text-foreground truncate">Kitchen Queue</h2>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5 truncate">
                  {counts.all} active · {counts.incoming} new · {counts.ready} ready
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <button className="h-7 w-7 rounded-md hover:bg-accent/10 flex items-center justify-center text-primary">
                <Printer className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
              <button className="h-7 w-7 rounded-md hover:bg-accent/10 flex items-center justify-center">
                <Volume2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
              </button>
              <div className="flex items-center gap-1.5 ml-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                </span>
                <span className="text-[10px] text-muted-foreground font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
        {counts.incoming > 0 && (
          <div className="bg-warning/5 border-b border-warning/10">
            <div className="max-w-5xl mx-auto px-4 py-2 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warning opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-warning" />
              </span>
              <span className="text-[11px] font-semibold text-warning">
                {counts.incoming} new order{counts.incoming !== 1 ? 's' : ''} waiting
              </span>
            </div>
          </div>
        )}
        <div className="bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-5xl mx-auto px-4 flex gap-1 py-2 overflow-x-auto scrollbar-hide">
            {[
              { label: 'All',     count: counts.all,      active: true,  tone: 'default' as const },
              { label: 'New',     count: counts.incoming, active: false, tone: 'warning' as const },
              { label: 'Cooking', count: counts.cooking,  active: false, tone: 'default' as const },
              { label: 'Ready',   count: counts.ready,    active: false, tone: 'success' as const },
            ].map((t) => (
              <button
                key={t.label}
                className={[
                  'relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
                  t.active
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
                ].join(' ')}
              >
                {t.label}
                {t.count > 0 && (
                  <span className={[
                    'text-[9px] tabular-nums font-bold min-w-[16px] text-center rounded-full px-1 py-px',
                    t.active
                      ? 'bg-background/20 text-background'
                      : t.tone === 'warning'
                        ? 'bg-warning/15 text-warning'
                        : t.tone === 'success'
                          ? 'bg-success/15 text-success'
                          : 'bg-secondary text-muted-foreground',
                  ].join(' ')}>
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <AnimatePresence>
          {liveKitchen.map((o) => {
            const mins = Math.max(1, Math.floor((Date.now() - o.createdAt) / 60000));
            return (
              <motion.div
                key={o.id}
                layout
                initial={{ opacity: 0, scale: 0.9, y: -8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <KdsTicket
                  num={o.num}
                  table={o.table}
                  mins={mins}
                  status={o.status === 'served' ? 'ready' : o.status}
                  fresh={o.fresh}
                  onAdvance={() => demoOrderStore.advance(o.id)}
                  items={o.items.map((it) => ({ name: it.name, qty: it.qty, note: it.note }))}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
        <KdsTicket num={1284} table="Table 7" mins={3} status="pending" items={[
          { name: 'Tagliatelle al Tartufo', qty: 2 },
          { name: 'Burrata e Pomodoro', qty: 1, note: 'no basil' },
          { name: 'Aqua frizzante', qty: 2 },
        ]} />
        <KdsTicket num={1285} table="Table 12" mins={6} status="preparing" items={[
          { name: 'Bistecca alla Fiorentina', qty: 1, tag: 'Medium-rare' },
          { name: 'Patate al rosmarino', qty: 1 },
          { name: 'Insalata mista', qty: 1 },
        ]} />
        <KdsTicket num={1286} table="Takeaway" mins={9} status="preparing" items={[
          { name: 'Pizza Margherita', qty: 2, tag: 'Extra cheese' },
          { name: 'Tiramisu', qty: 1 },
        ]} />
        <KdsTicket num={1287} table="Table 3" mins={14} status="preparing" items={[
          { name: 'Risotto ai Funghi', qty: 2 },
          { name: 'Bruschetta', qty: 1 },
        ]} />
        <KdsTicket num={1288} table="Bar 2" mins={2} status="ready" items={[
          { name: 'Caprese', qty: 1 },
          { name: 'Spritz', qty: 2 },
        ]} />
        <KdsTicket num={1289} table="Table 9" mins={4} status="pending" items={[
          { name: 'Ravioli di zucca', qty: 3 },
          { name: 'Vino della casa', qty: 1, note: 'rosso' },
        ]} />
      </div>
    </AdminChrome>
  );
}

function WaiterFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-background flex items-center justify-center p-4">
      <div className="relative w-[320px] max-w-full h-[600px] max-h-full rounded-[36px] border-[10px] border-foreground/90 bg-background overflow-hidden shadow-2xl">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-foreground/90 rounded-b-2xl z-10" />
        <div className="absolute inset-0 flex flex-col">{children}</div>
      </div>
    </div>
  );
}

/* ----- Waiter desktop chrome (mirrors WaiterLayout/WaiterSidebar) ----- */
interface WaiterNavItem { title: string; icon: LucideIcon; active?: boolean; }
interface WaiterNavGroup { label: string; items: WaiterNavItem[]; }
const WAITER_NAV: WaiterNavGroup[] = [
  { label: 'Overview', items: [
    { title: 'Dashboard', icon: LayoutDashboard, active: true },
  ]},
  { label: 'Actions', items: [
    { title: 'POS', icon: Monitor },
    { title: 'New Order', icon: Plus },
    { title: 'Order History', icon: Clock },
  ]},
];

function WaiterChrome({
  title, subtitle, brand = 'Bella Cucina', staffName, staffRole, children,
}: {
  title: string;
  subtitle?: string;
  brand?: string;
  staffName: string;
  staffRole: 'Waiter Panel' | 'Server Panel';
  children: React.ReactNode;
}) {
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return (
    <div className="absolute inset-0 flex bg-background text-foreground select-none">
      {/* Sidebar — mirrors WaiterSidebar */}
      <aside className="w-[200px] shrink-0 border-r border-border bg-card hidden sm:flex flex-col">
        <div className="px-4 py-4 flex items-center gap-3">
          <div className="h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-md">
            <UtensilsCrossed className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <span className="block text-[12px] font-bold tracking-tight text-card-foreground truncate">{brand}</span>
            <span className="block text-[9px] text-muted-foreground font-medium uppercase tracking-widest">{staffRole}</span>
          </div>
        </div>
        <div className="mx-3 h-px bg-border" />
        <nav className="flex-1 overflow-hidden px-2 py-2 space-y-2">
          {WAITER_NAV.map((g) => (
            <div key={g.label}>
              <div className="px-3 pt-2 pb-1.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
                {g.label}
              </div>
              <ul className="space-y-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  return (
                    <li key={it.title}>
                      <div className={[
                        'w-full text-left flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-[11px] transition-all duration-150',
                        it.active
                          ? 'bg-primary/10 text-primary font-semibold'
                          : 'text-muted-foreground hover:bg-accent/10 hover:text-foreground',
                      ].join(' ')}>
                        <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={it.active ? 2 : 1.5} />
                        <span className="truncate">{it.title}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        <div className="border-t border-border px-2 py-2 space-y-0.5">
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-foreground cursor-default">
            <UserCircle className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>My Profile</span>
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-foreground cursor-default">
            <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Dark Mode</span>
          </div>
          <div className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-accent/10 hover:text-destructive cursor-default">
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>Sign Out</span>
          </div>
        </div>
      </aside>

      {/* Main column — mirrors WaiterLayout header + scrollable main */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <header className="h-12 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
          <div className="flex items-baseline gap-2 min-w-0">
            <h1 className="text-[13px] font-semibold tracking-tight truncate">{title}</h1>
            {subtitle && <span className="text-[10px] text-muted-foreground hidden sm:inline">{subtitle}</span>}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums">{today}</span>
        </header>
        <main className="flex-1 overflow-auto">
          <div className="p-3 sm:p-4 lg:p-5 max-w-3xl">
            {/* Greeting line — matches WaiterDashboard */}
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{staffRole.replace(' Panel', '')}</div>
                <div className="text-base font-bold tracking-tight">{staffName}</div>
              </div>
              <button className="h-8 w-8 rounded-md border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function WaiterTicket({
  num, table, mins, status, total, items, pulse,
}: {
  num: number; table: string; mins: number; total: string;
  status: 'pending' | 'preparing' | 'ready' | 'served';
  items: string[]; pulse?: boolean;
}) {
  const cfg = {
    pending:   { label: 'Pending',   color: 'text-warning', bg: 'bg-warning/10', ring: 'ring-warning/20',  icon: Clock },
    preparing: { label: 'Cooking',   color: 'text-primary', bg: 'bg-primary/10', ring: 'ring-primary/20',  icon: ChefHat },
    ready:     { label: 'Ready',     color: 'text-success', bg: 'bg-success/10', ring: 'ring-success/30',  icon: CheckCircle2 },
    served:    { label: 'Served',    color: 'text-muted-foreground', bg: 'bg-muted', ring: 'ring-border',  icon: CheckCircle2 },
  }[status];
  const StatusIcon = cfg.icon;
  return (
    <div className={`rounded-xl border border-border bg-card overflow-hidden ring-1 ${cfg.ring}`}>
      <div className={`${cfg.bg} px-3.5 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2 min-w-0">
          <Hash className={`h-3.5 w-3.5 ${cfg.color}`} strokeWidth={2} />
          <span className={`text-[12px] font-bold ${cfg.color}`}>{num}</span>
          <span className="text-[10px] text-muted-foreground truncate">· {table}</span>
        </div>
        <span className={`${cfg.color} text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 ${pulse ? 'animate-pulse' : ''}`}>
          <StatusIcon className="h-3 w-3" strokeWidth={2} /> {cfg.label}
        </span>
      </div>
      <div className="px-3.5 py-2.5">
        <div className="text-[11px] text-foreground/90 leading-relaxed line-clamp-2">{items.join(' · ')}</div>
        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span className="text-muted-foreground flex items-center gap-1">
            <Timer className="h-3 w-3" strokeWidth={1.5} /> {mins}m
          </span>
          <span className="font-bold tabular-nums text-[11px]">{total}</span>
        </div>
      </div>
      {status === 'ready' && (
        <div className="border-t border-border bg-success/5 px-3.5 py-1.5 flex items-center justify-between">
          <span className="text-[10px] text-success font-semibold flex items-center gap-1">
            <Bell className="h-3 w-3 animate-pulse" /> Pickup ready
          </span>
          <button className="text-[10px] font-bold text-success uppercase tracking-wider flex items-center gap-1">
            Mark served <ArrowRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

export function WaiterPanelMock() {
  return (
    <WaiterChrome title="Waiter Dashboard" subtitle="Floor service" staffName="Luca Bianchi" staffRole="Waiter Panel">
      {/* Active orders banner — matches WaiterDashboard "Order ready" pulse */}
      <div className="mb-3 rounded-xl bg-success/5 border border-success/15 px-3.5 py-2 flex items-center gap-2.5">
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-semibold text-success">2 orders ready for pickup</p>
          <p className="text-[10px] text-muted-foreground">Bar 2 · Table 7 — collect from kitchen pass</p>
        </div>
      </div>

      {/* Tab strip — mirrors WaiterDashboard */}
      <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {[
          { label: 'All',       count: 7,  active: true,  tone: 'default' as const },
          { label: 'Pending',   count: 2,  active: false, tone: 'warning' as const },
          { label: 'Cooking',   count: 3,  active: false, tone: 'default' as const },
          { label: 'Ready',     count: 2,  active: false, tone: 'success' as const },
          { label: 'My tables', count: 4,  active: false, tone: 'default' as const },
        ].map((t) => (
          <button
            key={t.label}
            className={[
              'relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
              t.active
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            ].join(' ')}
          >
            {t.label}
            <span className={[
              'text-[9px] tabular-nums font-bold min-w-[16px] text-center rounded-full px-1 py-px',
              t.active
                ? 'bg-background/20 text-background'
                : t.tone === 'warning'
                  ? 'bg-warning/15 text-warning'
                  : t.tone === 'success'
                    ? 'bg-success/15 text-success'
                    : 'bg-secondary text-muted-foreground',
            ].join(' ')}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Order list — stacked cards like the real WaiterDashboard */}
      <div className="space-y-2.5">
        <WaiterTicket num={1288} table="Bar 2" mins={2} status="ready" total="$48.00"
          items={['Caprese', 'Aperol Spritz × 2']} pulse />
        <WaiterTicket num={1284} table="Table 7" mins={3} status="pending" total="$112.50"
          items={['Tagliatelle al Tartufo × 2', 'Burrata e Pomodoro', 'Acqua frizzante × 2']} />
        <WaiterTicket num={1285} table="Table 12" mins={6} status="preparing" total="$184.00"
          items={['Bistecca alla Fiorentina', 'Patate al rosmarino', 'Insalata mista']} />
        <WaiterTicket num={1281} table="Table 5" mins={22} status="served" total="$96.40"
          items={['Pizza Margherita', 'Tiramisu', 'Vino della casa × 2']} />
      </div>
    </WaiterChrome>
  );
}

export function ServerPanelMock() {
  return (
    <WaiterChrome title="Waiter Dashboard" subtitle="Patio section · 8 covers" staffName="Giulia Romano" staffRole="Server Panel">
      <div className="mb-3 flex gap-1 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {[
          { label: 'All',     count: 4, active: true,  tone: 'default' as const },
          { label: 'Pending', count: 1, active: false, tone: 'warning' as const },
          { label: 'Cooking', count: 2, active: false, tone: 'default' as const },
          { label: 'Ready',   count: 0, active: false, tone: 'success' as const },
          { label: 'My tables', count: 3, active: false, tone: 'default' as const },
        ].map((t) => (
          <button
            key={t.label}
            className={[
              'relative flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-medium transition-all whitespace-nowrap',
              t.active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
            ].join(' ')}
          >
            {t.label}
            {t.count > 0 && (
              <span className={[
                'text-[9px] tabular-nums font-bold min-w-[16px] text-center rounded-full px-1 py-px',
                t.active
                  ? 'bg-background/20 text-background'
                  : t.tone === 'warning'
                    ? 'bg-warning/15 text-warning'
                    : 'bg-secondary text-muted-foreground',
              ].join(' ')}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-2.5">
        <WaiterTicket num={1290} table="Patio 1" mins={1} status="pending" total="$64.00"
          items={['Caprese', 'Pizza Diavola', 'Limonata × 2']} />
        <WaiterTicket num={1287} table="Patio 3" mins={14} status="preparing" total="$132.00"
          items={['Risotto ai Funghi × 2', 'Bruschetta al pomodoro']} pulse />
        <WaiterTicket num={1283} table="Patio 4" mins={28} status="served" total="$210.00"
          items={['Tasting menu × 2', 'Vino della casa (bottle)']} />
      </div>
    </WaiterChrome>
  );
}

export function CustomerPanelMock() {
  const dishes = [
    { name: 'Tagliatelle al Tartufo', desc: 'Hand-cut pasta, black truffle, Parmigiano', price: 26, tag: 'Chef pick' },
    { name: 'Burrata e Pomodoro', desc: 'Apulian burrata, heirloom tomato, basil oil', price: 18 },
    { name: 'Bistecca alla Fiorentina', desc: 'Bone-in T-bone, rosemary potatoes (for 2)', price: 68, tag: 'Bestseller' },
    { name: 'Risotto ai Funghi', desc: 'Carnaroli, porcini, white wine, butter', price: 23 },
    { name: 'Tiramisu della Casa', desc: 'Mascarpone, espresso, savoiardi, cocoa', price: 9 },
  ];
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const cartTotal = dishes.reduce((s, d) => s + d.price * (cart[d.name] ?? 0), 0);

  const addItem = (name: string) =>
    setCart((c) => ({ ...c, [name]: (c[name] ?? 0) + 1 }));

  const sendToKitchen = () => {
    if (!cartCount || sending) return;
    setSending(true);
    const items = dishes
      .filter((d) => cart[d.name])
      .map((d) => ({ name: d.name, qty: cart[d.name], price: d.price }));
    const order = demoOrderStore.add({ table: 'Table 14 · QR', items });
    toast.success(`Order #${order.num} sent to the kitchen`, {
      description: 'Switch to Kitchen or Admin to watch it land in real time.',
    });
    setCart({});
    setTimeout(() => setSending(false), 600);
  };
  return (
    <WaiterFrame>
      <div className="px-4 pt-8 pb-3 bg-gradient-to-br from-primary/15 via-primary/5 to-background border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs">BC</div>
            <div>
              <div className="text-[12px] font-bold">Bella Cucina</div>
              <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Star className="h-2.5 w-2.5 fill-warning text-warning" /> 4.9 · 2.3k reviews
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center">
              <Heart className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="h-7 w-7 rounded-full bg-card border border-border flex items-center justify-center relative">
              <ShoppingBag className="h-3 w-3 text-muted-foreground" />
              {cartCount > 0 && (
                <motion.span
                  key={cartCount}
                  initial={{ scale: 0.6 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center font-bold"
                >
                  {cartCount}
                </motion.span>
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {['All', 'Antipasti', 'Pasta', 'Pizza', 'Mains', 'Dolci', 'Drinks'].map((c, i) => (
            <button key={c} className={[
              'h-7 px-3 rounded-full text-[10px] font-medium whitespace-nowrap',
              i === 0 ? 'bg-foreground text-background' : 'bg-card border border-border text-muted-foreground',
            ].join(' ')}>{c}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-background">
        <div className="p-3 space-y-2.5">
          {dishes.map((m) => (
            <div key={m.name} className="rounded-xl border border-border bg-card p-3 flex gap-3">
              <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-warning/20 shrink-0 flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="text-[12px] font-semibold truncate">{m.name}</div>
                  {m.tag && <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 font-medium">{m.tag}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{m.desc}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] font-bold text-primary tabular-nums">${m.price}</span>
                  <div className="flex items-center gap-1.5">
                    {cart[m.name] > 0 && (
                      <span className="text-[10px] font-bold tabular-nums w-4 text-center">{cart[m.name]}</span>
                    )}
                    <button
                      onClick={() => addItem(m.name)}
                      className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                      aria-label={`Add ${m.name}`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border bg-card p-3">
        <motion.button
          onClick={sendToKitchen}
          whileTap={{ scale: 0.97 }}
          disabled={!cartCount || sending}
          className={[
            'w-full h-10 rounded-xl flex items-center justify-between px-4 text-[12px] font-bold transition-all',
            cartCount
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4" />
            {cartCount ? `Send to kitchen · ${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Add items to start'}
          </span>
          <span className="tabular-nums">{cartCount ? `$${cartTotal} →` : ''}</span>
        </motion.button>
        {!cartCount && (
          <p className="text-[9px] text-center text-muted-foreground mt-1.5">
            Tap + on a dish, then send to watch it appear in Kitchen & Orders instantly.
          </p>
        )}
      </div>
    </WaiterFrame>
  );
}

function BrowserFrame({ url, children }: { url: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 bg-gradient-to-br from-muted/40 to-background flex items-center justify-center p-3 sm:p-5">
      <div className="relative w-full h-full max-w-[920px] rounded-2xl border border-border bg-background overflow-hidden shadow-2xl flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/40">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <div className="flex-1 min-w-0 mx-2">
            <div className="rounded-md bg-background border border-border px-2.5 py-0.5 text-[10px] font-mono text-muted-foreground truncate text-center">
              {url}
            </div>
          </div>
          <button className="text-muted-foreground hover:text-foreground" aria-label="Refresh">
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-auto bg-background">{children}</div>
      </div>
    </div>
  );
}

export function WebsitePanelMock() {
  const featured = [
    { name: 'Tagliatelle al Tartufo', price: 26, tag: 'Chef pick', img: demoDishTartufo },
    { name: 'Bistecca alla Fiorentina', price: 68, tag: 'Bestseller', img: demoDishBistecca },
    { name: 'Risotto ai Funghi', price: 23, img: demoDishRisotto },
  ];
  return (
    <BrowserFrame url="bellacucina.com">
      {/* Top nav */}
      <header className="sticky top-0 z-10 backdrop-blur bg-background/80 border-b border-border">
        <div className="max-w-5xl mx-auto px-5 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center font-bold text-[11px]">BC</div>
            <span className="text-[13px] font-semibold tracking-tight">Bella Cucina</span>
          </div>
          <nav className="hidden sm:flex items-center gap-5 text-[11px] text-muted-foreground">
            <a className="text-foreground font-medium">Home</a>
            <a className="hover:text-foreground transition-colors">Menu</a>
            <a className="hover:text-foreground transition-colors">Story</a>
            <a className="hover:text-foreground transition-colors">Reservations</a>
            <a className="hover:text-foreground transition-colors">Contact</a>
          </nav>
          <button className="h-7 px-3 rounded-full bg-foreground text-background text-[10px] font-semibold inline-flex items-center gap-1">
            Order online <ArrowUpRight className="h-3 w-3" />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-warning/10 to-background" />
        <div className="relative max-w-5xl mx-auto px-5 py-12 grid sm:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-[10px] font-medium">
              <Star className="h-2.5 w-2.5 fill-warning text-warning" /> 4.9 · 2.3k reviews
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight leading-[1.1]">
              Roman classics, made the slow way.
            </h1>
            <p className="mt-2 text-[12px] text-muted-foreground leading-relaxed">
              Hand-rolled pasta, wood-fired meats, and a wine list curated table-side.
              Open daily for lunch and dinner.
            </p>
            <div className="mt-4 flex items-center gap-2">
              <button className="h-8 px-3.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold inline-flex items-center gap-1.5">
                Reserve a table <ArrowRight className="h-3 w-3" />
              </button>
              <button className="h-8 px-3.5 rounded-full border border-border text-[11px] font-medium inline-flex items-center gap-1.5 hover:bg-muted transition-colors">
                <UtensilsCrossed className="h-3 w-3" /> View menu
              </button>
            </div>
            <div className="mt-4 flex items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Via Roma 14</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> Open · until 23:00</span>
              <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> +39 06 555 0142</span>
            </div>
          </div>
          <div className="relative aspect-[4/3] rounded-2xl border border-border overflow-hidden">
            <img
              src={demoWebsiteHero}
              alt="Bella Cucina trattoria interior at golden hour with hand-rolled pasta"
              loading="lazy"
              width={1024}
              height={768}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/10 to-transparent" />
            <div className="absolute bottom-3 left-3 right-3 rounded-xl bg-background/90 backdrop-blur border border-border p-2.5 flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <CalendarDays className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] font-semibold leading-tight">Tonight · 7 tables left</div>
                <div className="text-[9px] text-muted-foreground">Book in 30 seconds, no signup.</div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </section>

      {/* Featured menu */}
      <section className="max-w-5xl mx-auto px-5 py-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">Featured tonight</div>
            <h2 className="text-lg font-semibold tracking-tight">From the kitchen</h2>
          </div>
          <a className="text-[11px] font-medium text-primary inline-flex items-center gap-1">See full menu <ArrowRight className="h-3 w-3" /></a>
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {featured.map((d) => (
            <div key={d.name} className="rounded-xl border border-border bg-card overflow-hidden group hover:shadow-lg transition-shadow">
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={d.img}
                  alt={d.name}
                  loading="lazy"
                  width={768}
                  height={576}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="text-[12px] font-semibold truncate">{d.name}</div>
                  {d.tag && <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 font-medium">{d.tag}</span>}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] font-bold text-primary tabular-nums">${d.price}</span>
                  <button className="text-[10px] font-semibold text-foreground inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                    Add <Plus className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Story strip */}
      <section className="border-y border-border bg-muted/30">
        <div className="max-w-5xl mx-auto px-5 py-8 grid sm:grid-cols-3 gap-5">
          {[
            { icon: ChefHat, title: 'Slow kitchen', desc: 'Pasta rolled fresh every morning, never frozen.' },
            { icon: Star, title: 'Wine pairings', desc: 'Sommelier-led list of 80+ Italian labels.' },
            { icon: Heart, title: 'Family run', desc: 'Three generations, one Roman recipe book.' },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex items-start gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[12px] font-semibold leading-tight">{title}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-5 py-6 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>© Bella Cucina · Powered by ServeOS</span>
        <div className="flex items-center gap-3">
          <Instagram className="h-3.5 w-3.5" />
          <Facebook className="h-3.5 w-3.5" />
          <Mail className="h-3.5 w-3.5" />
        </div>
      </footer>
    </BrowserFrame>
  );
}

export function TablePanelMock() {
  const dishes = [
    { name: 'Margherita DOC', desc: 'San Marzano, fior di latte, basil', price: 16, tag: 'Classic' },
    { name: 'Tagliatelle al Tartufo', desc: 'Hand-cut pasta, black truffle, Parmigiano', price: 26, tag: 'Chef pick' },
    { name: 'Polpette della Nonna', desc: 'Beef & pork meatballs, slow tomato sugo', price: 17 },
    { name: 'Acqua Frizzante 0.75L', desc: 'Sparkling mineral water', price: 4 },
    { name: 'Tiramisu della Casa', desc: 'Mascarpone, espresso, savoiardi, cocoa', price: 9 },
  ];
  const [cart, setCart] = useState<Record<string, number>>({});
  const [sending, setSending] = useState(false);
  const [calling, setCalling] = useState(false);
  const cartCount = Object.values(cart).reduce((s, n) => s + n, 0);
  const cartTotal = dishes.reduce((s, d) => s + d.price * (cart[d.name] ?? 0), 0);

  const addItem = (name: string) =>
    setCart((c) => ({ ...c, [name]: (c[name] ?? 0) + 1 }));
  const removeItem = (name: string) =>
    setCart((c) => {
      const next = { ...c, [name]: Math.max(0, (c[name] ?? 0) - 1) };
      if (!next[name]) delete next[name];
      return next;
    });

  const sendToTable = () => {
    if (!cartCount || sending) return;
    setSending(true);
    const items = dishes
      .filter((d) => cart[d.name])
      .map((d) => ({ name: d.name, qty: cart[d.name], price: d.price }));
    const order = demoOrderStore.add({ table: 'Table 07 · NFC', items });
    toast.success(`Order #${order.num} sent to Table 07`, {
      description: 'No checkout — added straight to your table tab.',
    });
    setCart({});
    setTimeout(() => setSending(false), 600);
  };

  const callWaiter = () => {
    if (calling) return;
    setCalling(true);
    toast.success('Waiter called to Table 07', {
      description: 'Switch to Waiter to see the alert appear.',
    });
    setTimeout(() => setCalling(false), 2200);
  };

  return (
    <WaiterFrame>
      {/* Table-bound header — emphasises NFC/QR + table number */}
      <div className="px-4 pt-8 pb-3 bg-gradient-to-br from-primary/20 via-warning/10 to-background border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-xs shrink-0">BC</div>
            <div className="min-w-0">
              <div className="text-[12px] font-bold truncate">Bella Cucina</div>
              <div className="text-[9px] text-muted-foreground flex items-center gap-1">
                <span className="inline-flex items-center gap-0.5"><Pin className="h-2.5 w-2.5" /> Dine-in</span>
                <span>·</span>
                <span>Tap-to-order</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2 py-0.5 text-[9px] font-bold tracking-wide">
              <Hash className="h-2.5 w-2.5" /> TABLE 07
            </span>
          </div>
        </div>

        {/* Scanned-from strip */}
        <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-card/70 border border-border px-2 py-1.5">
          <div className="h-5 w-5 rounded-md bg-primary/15 text-primary flex items-center justify-center shrink-0">
            <Smartphone className="h-3 w-3" />
          </div>
          <div className="text-[9px] leading-tight min-w-0">
            <div className="font-semibold truncate">NFC tag · table-bound session</div>
            <div className="text-muted-foreground font-mono truncate">serveos.app/table/t-07</div>
          </div>
          <button
            onClick={callWaiter}
            disabled={calling}
            className={[
              'ml-auto h-6 px-2 rounded-full text-[9px] font-bold inline-flex items-center gap-1 transition-colors shrink-0',
              calling
                ? 'bg-success/15 text-success border border-success/30'
                : 'bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25',
            ].join(' ')}
          >
            <Bell className="h-2.5 w-2.5" />
            {calling ? 'On the way' : 'Waiter'}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
          {['All', 'Antipasti', 'Pizza', 'Pasta', 'Mains', 'Dolci', 'Drinks'].map((c, i) => (
            <button key={c} className={[
              'h-7 px-3 rounded-full text-[10px] font-medium whitespace-nowrap',
              i === 0 ? 'bg-foreground text-background' : 'bg-card border border-border text-muted-foreground',
            ].join(' ')}>{c}</button>
          ))}
        </div>
      </div>

      {/* Menu list */}
      <div className="flex-1 overflow-auto bg-background">
        <div className="p-3 space-y-2.5">
          {dishes.map((m) => (
            <div key={m.name} className="rounded-xl border border-border bg-card p-3 flex gap-3">
              <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-warning/20 shrink-0 flex items-center justify-center">
                <UtensilsCrossed className="h-5 w-5 text-primary/70" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="text-[12px] font-semibold truncate">{m.name}</div>
                  {m.tag && <span className="text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30 font-medium">{m.tag}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{m.desc}</div>
                <div className="flex items-center justify-between mt-1.5">
                  <span className="text-[12px] font-bold text-primary tabular-nums">${m.price}</span>
                  {cart[m.name] > 0 ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => removeItem(m.name)}
                        className="h-6 w-6 rounded-full border border-border text-foreground flex items-center justify-center hover:bg-muted transition-colors"
                        aria-label={`Remove ${m.name}`}
                      >
                        <span className="text-[14px] leading-none -mt-0.5">−</span>
                      </button>
                      <span className="text-[10px] font-bold tabular-nums w-4 text-center">{cart[m.name]}</span>
                      <button
                        onClick={() => addItem(m.name)}
                        className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                        aria-label={`Add ${m.name}`}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => addItem(m.name)}
                      className="h-6 px-2.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold inline-flex items-center gap-1 hover:scale-105 active:scale-95 transition-transform"
                      aria-label={`Add ${m.name}`}
                    >
                      <Plus className="h-3 w-3" /> Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky add-to-table tab — no checkout, no card */}
      <div className="border-t border-border bg-card p-3">
        <motion.button
          onClick={sendToTable}
          whileTap={{ scale: 0.97 }}
          disabled={!cartCount || sending}
          className={[
            'w-full h-10 rounded-xl flex items-center justify-between px-4 text-[12px] font-bold transition-all',
            cartCount
              ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
              : 'bg-muted text-muted-foreground cursor-not-allowed',
          ].join(' ')}
        >
          <span className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4" />
            {cartCount ? `Add to Table 07 · ${cartCount} item${cartCount > 1 ? 's' : ''}` : 'Tap + on a dish'}
          </span>
          <span className="tabular-nums">{cartCount ? `$${cartTotal} →` : ''}</span>
        </motion.button>
        <p className="text-[9px] text-center text-muted-foreground mt-1.5">
          {cartCount
            ? 'No checkout · pay together at the end of the meal.'
            : 'Scan once, order all night — every dish lands on your table tab.'}
        </p>
      </div>
    </WaiterFrame>
  );
}

export const DEMO_PANELS = {
  owner: OwnerPanelMock,
  admin: AdminPanelMock,
  manager: ManagerPanelMock,
  kitchen: KitchenPanelMock,
  waiter: WaiterPanelMock,
  server: ServerPanelMock,
  customer: CustomerPanelMock,
  website: WebsitePanelMock,
  table: TablePanelMock,
} as const;

export type DemoPanelRole = keyof typeof DEMO_PANELS;
