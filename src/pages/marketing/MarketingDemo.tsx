import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle, ArrowRight, BarChart3, ChefHat, ClipboardList, Copy, Crown, DollarSign,
  ExternalLink, Eye, KeyRound, Loader2, Lock, Mail, Maximize2, Receipt,
  RefreshCw, Shield, ShoppingBag, Smartphone, Sparkles, Star, TrendingUp, UserCog,
  Users, UtensilsCrossed, CheckCircle2, Zap, ChevronRight, Globe, QrCode,
} from 'lucide-react';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useRestaurantBySlug } from '@/hooks/useCurrentRestaurant';
import { useDemoPageConfig, DEMO_CONFIG_FALLBACK } from '@/hooks/useDemoPageConfig';
import { toast } from 'sonner';
import { DEMO_PANELS } from '@/components/marketing/demo/DemoPanelMocks';
import { useDemoOrders } from '@/components/marketing/demo/useDemoOrderStore';

const DEMO_SLUG = 'demo';

const ICON_MAP: Record<string, any> = {
  Sparkles, UtensilsCrossed, Star, ClipboardList, ChefHat, Receipt,
  BarChart3, ShoppingBag, TrendingUp, DollarSign,
};
const iconFor = (name?: string) => ICON_MAP[name ?? 'Sparkles'] ?? Sparkles;

interface PaidOrder {
  id: string;
  total_amount: number;
  paid_at: string | null;
  created_at: string;
  payment_method: string | null;
  ticket_number: number | null;
}
interface ActiveOrder {
  id: string;
  ticket_number: number | null;
  created_at: string;
  table_id: string | null;
  order_items: { id: string; quantity: number; menu_items: { name: string } | null }[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function timeAgo(iso: string) {
  const sec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ---------------- Provisioning ---------------- */
type ProvisionStatus = 'idle' | 'provisioning' | 'ready' | 'error';

function useDemoProvisioning() {
  const [status, setStatus] = useState<ProvisionStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const ranRef = useRef(false);

  const provision = async () => {
    setStatus('provisioning');
    setErrorMsg(null);
    try {
      const [staff, owner] = await Promise.all([
        supabase.functions.invoke('bootstrap-demo-staff'),
        supabase.functions.invoke('bootstrap-demo-owner'),
      ]);
      if (staff.error) throw staff.error;
      if (owner.error) throw owner.error;
      setStatus('ready');
    } catch (err: any) {
      setStatus('error');
      setErrorMsg(err?.message ?? 'Failed to set up demo accounts');
    }
  };

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    provision();
  }, []);

  return { status, errorMsg, retry: provision };
}

/* ---------------- Account model ---------------- */
type Role = 'owner' | 'admin' | 'manager' | 'kitchen' | 'waiter' | 'server' | 'customer' | 'website' | 'table';

interface DemoAccount {
  role: Role;
  label: string;
  tagline: string;
  description: string;
  email: string;
  password: string;
  signInHref: string;
  panelHref: string;
  previewHref: string; // public route to embed in iframe
  icon: any;
  group: 'leadership' | 'operations' | 'floor' | 'guest';
}

const DEMO_STAFF_PASSWORD = 'DemoStaff2025!';
const DEMO_OWNER_PASSWORD = 'DemoOwner2025!';
const DEMO_CUSTOMER_PASSWORD = 'DemoGuest2025!';

const ACCOUNTS: DemoAccount[] = [
  {
    role: 'owner', label: 'Owner', tagline: 'Full control',
    description: 'Billing, branding, staff, every panel — the keys to the entire restaurant.',
    email: 'owner@bellacucina.demo', password: DEMO_OWNER_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('owner@bellacucina.demo')}`,
    panelHref: '/owner', previewHref: `/r/${DEMO_SLUG}`, icon: Crown, group: 'leadership',
  },
  {
    role: 'admin', label: 'Admin', tagline: 'Run the restaurant',
    description: 'Menu, orders, settings, analytics — the day-to-day command center.',
    email: 'admin@bellacucina.demo', password: DEMO_STAFF_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('admin@bellacucina.demo')}`,
    panelHref: '/admin', previewHref: `/r/${DEMO_SLUG}/menu`, icon: Shield, group: 'leadership',
  },
  {
    role: 'manager', label: 'Manager', tagline: 'Operations & accounting',
    description: 'Admin access minus billing — manage staff, expenses, reporting.',
    email: 'manager@bellacucina.demo', password: DEMO_STAFF_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('manager@bellacucina.demo')}`,
    panelHref: '/admin', previewHref: `/r/${DEMO_SLUG}/menu`, icon: UserCog, group: 'operations',
  },
  {
    role: 'kitchen', label: 'Kitchen', tagline: 'Live KDS',
    description: 'Accept tickets, mark items ready, hear the bell — pure expediter view.',
    email: 'kitchen@bellacucina.demo', password: DEMO_STAFF_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('kitchen@bellacucina.demo')}`,
    panelHref: '/kitchen', previewHref: `/r/${DEMO_SLUG}/menu`, icon: ChefHat, group: 'operations',
  },
  {
    role: 'waiter', label: 'Waiter', tagline: 'Live floor service',
    description: 'Desktop & tablet panel for orders, tables, payments and waiter calls — same chrome the kitchen uses.',
    email: 'waiter@bellacucina.demo', password: DEMO_STAFF_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('waiter@bellacucina.demo')}`,
    panelHref: '/waiter', previewHref: `/r/${DEMO_SLUG}`, icon: ClipboardList, group: 'floor',
  },
  {
    role: 'server', label: 'Server', tagline: 'Parallel floor seat',
    description: 'Same as waiter — kept separate so two people can demo at once.',
    email: 'server@bellacucina.demo', password: DEMO_STAFF_PASSWORD,
    signInHref: `/staff-login?email=${encodeURIComponent('server@bellacucina.demo')}`,
    panelHref: '/waiter', previewHref: `/r/${DEMO_SLUG}`, icon: Users, group: 'floor',
  },
  {
    role: 'customer', label: 'Customer', tagline: 'Returning guest',
    description: 'Order history, loyalty points, saved profile and authenticated checkout.',
    email: 'guest@bellacucina.demo', password: DEMO_CUSTOMER_PASSWORD,
    signInHref: `/auth?email=${encodeURIComponent('guest@bellacucina.demo')}`,
    panelHref: `/r/${DEMO_SLUG}`, previewHref: `/r/${DEMO_SLUG}`, icon: Smartphone, group: 'guest',
  },
  {
    role: 'website', label: 'Website', tagline: 'Public-facing storefront',
    description: 'The branded restaurant homepage your guests see — menu, hours, reservations and online ordering.',
    email: '', password: '',
    signInHref: `/r/${DEMO_SLUG}`,
    panelHref: `/r/${DEMO_SLUG}`, previewHref: `/r/${DEMO_SLUG}`, icon: Globe, group: 'guest',
  },
  {
    role: 'table', label: 'Table QR / NFC', tagline: 'Scan-to-order at the table',
    description: 'A guest taps the NFC tag or scans the QR — the menu opens already bound to their table, with a one-tap waiter call and no checkout.',
    email: '', password: '',
    signInHref: `/table/t-07`,
    panelHref: `/table/t-07`, previewHref: `/table/t-07`, icon: QrCode, group: 'guest',
  },
];

const GROUP_LABEL: Record<DemoAccount['group'], string> = {
  leadership: 'Leadership',
  operations: 'Operations',
  floor: 'Floor & service',
  guest: 'Guest experience',
};
const GROUPS: DemoAccount['group'][] = ['leadership', 'operations', 'floor', 'guest'];

/* ---------------- Console (hero + interactive) ---------------- */
interface ConsoleProps {
  status: ProvisionStatus;
  errorMsg: string | null;
  onRetry: () => void;
  restaurantName?: string;
  totalRevenue: number;
  ordersCount: number;
  activeTickets: number;
  avgTicket: number;
  eyebrow: string;
  title: string;
  description: string;
}

function ConsoleSection(p: ConsoleProps) {
  const [activeRole, setActiveRole] = useState<Role>('owner');
  const active = ACCOUNTS.find((a) => a.role === activeRole) ?? ACCOUNTS[0];
  const [iframeKey, setIframeKey] = useState(0);
  const liveOrders = useDemoOrders();
  const liveCount = liveOrders.length;

  const reload = () => setIframeKey((k) => k + 1);

  const PanelComponent = DEMO_PANELS[active.role];

  return (
    <section className="relative border-b border-border/60">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.08),transparent_60%)]" />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,hsl(var(--background)))]" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pt-10 pb-10 sm:pt-24 sm:pb-16">
        {/* Eyebrow + headline */}
        <div className="max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-1.5 sm:gap-2 rounded-full border border-border bg-card px-2.5 sm:px-3 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            <span className="text-foreground">{p.eyebrow}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">No signup required</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.05 }}
            className="mt-4 sm:mt-5 text-[2rem] leading-[1.08] sm:text-5xl lg:text-6xl font-semibold tracking-tight sm:leading-[1.05]"
          >
            {p.restaurantName ? `Step inside ${p.restaurantName}` : p.title}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.1 }}
            className="mt-3 sm:mt-4 text-sm sm:text-lg text-muted-foreground leading-relaxed"
          >
            {p.description}
          </motion.p>
        </div>

        {/* KPI strip — hidden until the demo restaurant has real activity, so
            the hero never shows a row of $0s next to the populated preview. */}
        {(p.ordersCount > 0 || p.activeTickets > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.55, delay: 0.15 }}
          className="mt-6 sm:mt-8 grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3"
        >
          <Kpi icon={DollarSign} label="7-day revenue" value={formatCurrency(p.totalRevenue)} />
          <Kpi icon={Receipt} label="Paid orders" value={String(p.ordersCount)} />
          <Kpi icon={TrendingUp} label="Avg ticket" value={formatCurrency(p.avgTicket)} />
          <Kpi icon={ChefHat} label="Active tickets" value={String(p.activeTickets)} accent />
        </motion.div>
        )}

        {/* QR-to-Kitchen flow guide */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.18 }}
          className="mt-6 sm:mt-8 rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-3.5 sm:p-5"
        >
          <div className="flex items-start sm:items-center gap-3 flex-col sm:flex-row sm:justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold leading-tight">Try the QR-to-Kitchen flow</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Place an order as a guest → watch it land instantly in Kitchen and Orders.
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:flex items-center gap-1.5 shrink-0 w-full sm:w-auto">
              {[
                { role: 'customer' as Role, label: '1 · Customer', icon: Smartphone },
                { role: 'kitchen'  as Role, label: '2 · Kitchen',  icon: ChefHat },
                { role: 'admin'    as Role, label: '3 · Orders',   icon: ClipboardList },
              ].map((step, i) => {
                const SIcon = step.icon;
                const isActive = step.role === activeRole;
                return (
                  <button
                    key={step.role}
                    onClick={() => { setActiveRole(step.role); setIframeKey((k) => k + 1); }}
                    className={[
                      'inline-flex items-center justify-center gap-1.5 rounded-full border px-2.5 py-2.5 sm:py-1 text-xs sm:text-[11px] font-medium transition-colors whitespace-nowrap',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
                    ].join(' ')}
                  >
                    <SIcon className="h-3 w-3" />
                    {step.label}
                  </button>
                );
              })}
              {liveCount > 0 && (
                <span className="col-span-3 sm:col-span-1 justify-self-start inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {liveCount} live
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* INTERACTIVE CONSOLE */}
        <motion.div
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-8 sm:mt-10 rounded-2xl sm:rounded-3xl border border-border bg-card overflow-hidden shadow-[0_40px_120px_-40px_rgba(15,23,42,0.35)]"
        >
          {/* Top toolbar */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-border/60 bg-muted/40">
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-destructive/60" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-amber-400/70" />
              <span className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full bg-emerald-500/70" />
            </div>
            <div className="flex-1 min-w-0 mx-1.5 sm:mx-4">
              <div className="rounded-md bg-background/80 border border-border/60 px-2 sm:px-3 py-1 text-[10px] sm:text-[11px] font-mono text-muted-foreground truncate text-center">
                serveos.app{active.previewHref}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={reload}
                className="hidden sm:inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Reload preview"
              >
                <RefreshCw className="h-3 w-3" /> Reload
              </button>
              <a
                href={active.previewHref}
                target="_blank" rel="noopener"
                className="inline-flex items-center gap-1 p-2 -m-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Open in new tab"
              >
                <Maximize2 className="h-3 w-3" /> <span className="hidden sm:inline">Open</span>
              </a>
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Role rail */}
            <aside className="min-w-0 border-b lg:border-b-0 lg:border-r border-border/60 bg-background/40">
              {/* Mobile: horizontal scroll rail of role chips */}
              <div className="lg:hidden overflow-x-auto px-3 py-3 -mx-px">
                <div className="flex items-center gap-1.5 w-max">
                  {ACCOUNTS.map((a) => {
                    const Icon = a.icon;
                    const selected = a.role === activeRole;
                    return (
                      <button
                        key={a.role}
                        onClick={() => { setActiveRole(a.role); setIframeKey((k) => k + 1); }}
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-xs font-medium transition-colors whitespace-nowrap',
                          selected
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card border-border text-muted-foreground hover:text-foreground',
                        ].join(' ')}
                        aria-pressed={selected}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              {/* Desktop: grouped vertical list */}
              <div className="hidden lg:block p-4 space-y-4 max-h-[640px] overflow-auto">
                {GROUPS.map((g) => {
                  const items = ACCOUNTS.filter((a) => a.group === g);
                  if (!items.length) return null;
                  return (
                    <div key={g}>
                      <div className="px-2 mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground font-medium">
                        {GROUP_LABEL[g]}
                      </div>
                      <div className="space-y-1">
                        {items.map((a) => {
                          const Icon = a.icon;
                          const selected = a.role === activeRole;
                          return (
                            <button
                              key={a.role}
                              onClick={() => { setActiveRole(a.role); setIframeKey((k) => k + 1); }}
                              className={[
                                'w-full text-left rounded-xl px-3 py-2.5 flex items-center gap-3 transition-all border',
                                selected
                                  ? 'bg-primary/10 border-primary/30 text-foreground shadow-[0_6px_20px_-12px_hsl(var(--primary)/0.6)]'
                                  : 'bg-transparent border-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                              ].join(' ')}
                              aria-pressed={selected}
                            >
                              <span className={[
                                'h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border',
                                selected
                                  ? 'bg-gradient-to-br from-primary/25 to-primary/5 border-primary/30 text-primary'
                                  : 'bg-muted/50 border-border/60 text-muted-foreground',
                              ].join(' ')}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="flex-1 min-w-0">
                                <span className="block text-sm font-medium leading-tight truncate">{a.label}</span>
                                <span className="block text-[11px] text-muted-foreground truncate">{a.tagline}</span>
                              </span>
                              <ChevronRight className={`h-3.5 w-3.5 transition-opacity ${selected ? 'opacity-100 text-primary' : 'opacity-0'}`} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </aside>

            {/* Main preview */}
            <div className="relative bg-muted/20">
              <div className="h-[min(75svh,620px)] sm:h-auto sm:aspect-[16/9] lg:aspect-auto lg:min-h-[640px] relative overflow-hidden">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${active.role}-${iframeKey}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="absolute inset-0 h-full w-full bg-background"
                  >
                    <PanelComponent />
                  </motion.div>
                </AnimatePresence>

              </div>
            </div>
          </div>

          {/* Sticky credentials bar */}
          <CredentialsBar
            account={active}
            status={p.status}
            errorMsg={p.errorMsg}
            onRetry={p.onRetry}
          />
        </motion.div>
      </div>
    </section>
  );
}

function Kpi({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border ${accent ? 'border-primary/30 bg-primary/5' : 'border-border/60 bg-card'} p-3 sm:p-4`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] sm:text-[10px] uppercase tracking-wider text-muted-foreground font-medium leading-tight">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${accent ? 'text-primary' : 'text-muted-foreground'}`} />
      </div>
      <div className="mt-1.5 sm:mt-2 text-xl sm:text-2xl font-bold tabular-nums tracking-tight">{value}</div>
    </div>
  );
}

/* ---------------- Credentials bar ---------------- */
function CredentialsBar({
  account, status, errorMsg, onRetry,
}: {
  account: DemoAccount;
  status: ProvisionStatus;
  errorMsg: string | null;
  onRetry: () => void;
}) {
  const [copied, setCopied] = useState<'email' | 'password' | null>(null);
  const copy = async (val: string, key: 'email' | 'password') => {
    try {
      await navigator.clipboard.writeText(val);
      setCopied(key);
      toast.success(`${key === 'email' ? 'Email' : 'Password'} copied`);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  return (
    <div className="border-t border-border/60 bg-card">
      <div className="px-3 sm:px-5 py-3 sm:py-4 grid gap-2.5 sm:gap-3 lg:grid-cols-[auto_1fr_auto] items-center">
        {/* status */}
        <div className="flex items-center gap-2 text-[11px] sm:text-xs">
          {status === 'ready' && (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-foreground font-medium">All accounts active</span>
            </>
          )}
          {(status === 'idle' || status === 'provisioning') && (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
              <span className="text-muted-foreground">Preparing accounts…</span>
            </>
          )}
          {status === 'error' && (
            <>
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <span className="text-destructive truncate max-w-[260px]" title={errorMsg ?? undefined}>
                Demo sign-in is temporarily unavailable
              </span>
              <button onClick={onRetry} className="ml-1 px-2 py-2 -my-2 underline underline-offset-2 hover:text-foreground">Retry</button>
            </>
          )}
        </div>

        {/* credentials */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2 min-w-0">
          <button
            onClick={() => copy(account.email, 'email')}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 sm:py-2 text-left hover:border-primary/40 hover:bg-background transition-colors min-w-0"
          >
            <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs truncate flex-1">{account.email}</span>
            <Copy className={`h-3.5 w-3.5 shrink-0 ${copied === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>
          <button
            onClick={() => copy(account.password, 'password')}
            className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-3 sm:py-2 text-left hover:border-primary/40 hover:bg-background transition-colors min-w-0"
          >
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[11px] sm:text-xs truncate flex-1">{account.password}</span>
            <Copy className={`h-3.5 w-3.5 shrink-0 ${copied === 'password' ? 'text-primary' : 'text-muted-foreground'}`} />
          </button>
        </div>

        {/* actions */}
        <div className="flex items-center gap-2 justify-stretch sm:justify-end">
          <Link to={account.panelHref} className="flex-1 sm:flex-none">
            <Button size="sm" variant="outline" className="gap-1.5 w-full sm:w-auto h-11 sm:h-9">
              <Eye className="h-3.5 w-3.5" /> Panel
            </Button>
          </Link>
          <Link to={account.signInHref} className="flex-1 sm:flex-none">
            <Button size="sm" className="gap-1.5 w-full sm:w-auto h-11 sm:h-9">
              Sign in <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Live operations ---------------- */
const CUSTOMER_PREVIEW_HREF = ACCOUNTS.find((a) => a.role === 'customer')?.previewHref ?? '/menu';

function EmptyState({ icon: Icon, title, body, action = true }: { icon: any; title: string; body: string; action?: boolean }) {
  return (
    <div className="col-span-full flex flex-col items-center justify-center text-center px-6 py-8 sm:py-14">
      <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-xs text-xs text-muted-foreground leading-relaxed">{body}</p>
      {action && (
        <Link to={CUSTOMER_PREVIEW_HREF} className="mt-4">
          <Button size="sm" variant="outline" className="gap-1.5 rounded-full h-11 sm:h-9 px-5">
            <Smartphone className="h-3.5 w-3.5" /> Place a test order
          </Button>
        </Link>
      )}
    </div>
  );
}

function LiveOpsSection({
  paidOrders, activeOrders, todayRevenue,
}: {
  paidOrders: PaidOrder[];
  activeOrders: ActiveOrder[];
  todayRevenue: number;
}) {
  return (
    <Section className="py-12 sm:py-28">
      <SectionHeading
        eyebrow="Live operations"
        title="Real numbers, refreshed live"
        description="A live snapshot of the demo restaurant — kitchen tickets, recent orders, and today's revenue."
      />
      <div className="mt-8 sm:mt-12 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Active KDS */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4 }}
          className="rounded-2xl border border-border/60 bg-card overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/60">
            <div className="flex items-center gap-2"><ChefHat className="h-4 w-4 text-primary" /><h3 className="font-semibold">Kitchen Display</h3></div>
            <span className="text-xs text-muted-foreground">{activeOrders.length} active</span>
          </div>
          <div className="p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
            {activeOrders.length === 0 && (
              <EmptyState
                icon={ChefHat}
                title="Kitchen is all clear"
                body="Place an order as a guest and it shows up here as a ticket in seconds."
              />
            )}
            {activeOrders.map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-border/60 bg-background p-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-mono font-bold text-primary">#{o.ticket_number ?? '—'}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{timeAgo(o.created_at)}</span>
                </div>
                <ul className="space-y-1">
                  {o.order_items.slice(0, 3).map((it) => (
                    <li key={it.id} className="text-xs flex justify-between gap-2">
                      <span className="truncate">{it.menu_items?.name ?? '—'}</span>
                      <span className="text-muted-foreground tabular-nums">×{it.quantity}</span>
                    </li>
                  ))}
                  {o.order_items.length > 3 && (
                    <li className="text-[10px] text-muted-foreground">+{o.order_items.length - 3} more</li>
                  )}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Recent orders */}
        <motion.div
          initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border/60 bg-card overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-border/60">
            <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-primary" /><h3 className="font-semibold">Recent orders</h3></div>
            <span className="text-xs text-muted-foreground">Today {formatCurrency(todayRevenue)}</span>
          </div>
          <div className="divide-y divide-border/60">
            {paidOrders.length === 0 && (
              <EmptyState
                icon={ClipboardList}
                title="No paid orders this week"
                body="Settle a test order from the Waiter or Admin panel and it appears here with its total."
                action={false}
              />
            )}
            {paidOrders.slice(0, 7).map((o) => (
              <div key={o.id} className="flex items-center justify-between px-4 sm:px-6 py-2.5 sm:py-3 text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">Order #{o.ticket_number ?? o.id.slice(0, 6)}</div>
                    <div className="text-xs text-muted-foreground capitalize">{o.payment_method ?? 'paid'} · {timeAgo(o.created_at)}</div>
                  </div>
                </div>
                <div className="font-bold tabular-nums">{formatCurrency(Number(o.total_amount))}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </Section>
  );
}

/* ---------------- Embeds ---------------- */
interface DemoView {
  title: string; description: string; iframeSrc: string; ctaLabel: string; ctaHref: string; icon: string; badge?: string;
}
function DemoLaptopCard({ view, index }: { view: DemoView; index: number }) {
  const Icon = iconFor(view.icon);
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
      className="group relative flex flex-col rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/60 bg-muted/30">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 mx-2 h-6 rounded-md bg-background border border-border/60 flex items-center px-3 text-[11px] text-muted-foreground truncate">
          serveos.app{view.iframeSrc?.startsWith('/') ? view.iframeSrc : ''}
        </div>
        {view.badge && (
          <span className="text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 hidden sm:inline-block">
            {view.badge}
          </span>
        )}
      </div>

      {/* Live preview */}
      <a
        href={view.ctaHref}
        target="_blank"
        rel="noopener"
        className="relative block bg-muted overflow-hidden"
        style={{ aspectRatio: '16 / 10' }}
        aria-label={`${view.ctaLabel} — ${view.title}`}
      >
        {view.iframeSrc ? (
          <>
            <iframe
              src={view.iframeSrc}
              title={`${view.title} preview`}
              loading="lazy"
              className="absolute inset-0 h-[200%] w-[200%] origin-top-left scale-[0.5] pointer-events-none border-0 bg-white"
              sandbox="allow-scripts allow-same-origin"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/90 backdrop-blur text-[11px] font-medium border border-border/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              Open live <ExternalLink className="h-3 w-3" />
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">No preview</div>
        )}
      </a>

      {/* Footer info */}
      <div className="p-5 flex items-start gap-3">
        <div className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight truncate">{view.title}</h3>
          {view.description && (
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed line-clamp-2">{view.description}</p>
          )}
        </div>
        <a
          href={view.ctaHref}
          target="_blank"
          rel="noopener"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </motion.div>
  );
}

/* ---------------- Page ---------------- */
export default function MarketingDemo() {
  const { data: restaurant } = useRestaurantBySlug(DEMO_SLUG);
  const provisioning = useDemoProvisioning();

  const { data: paidOrders = [] } = useQuery<PaidOrder[]>({
    queryKey: ['demo-paid-orders', restaurant?.id], enabled: !!restaurant?.id,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase.from('orders')
        .select('id,total_amount,paid_at,created_at,payment_method,ticket_number')
        .eq('restaurant_id', restaurant!.id).eq('status', 'paid')
        .gte('created_at', sevenDaysAgo).order('created_at', { ascending: false });
      return (data ?? []) as PaidOrder[];
    },
    staleTime: 60_000,
  });

  const { data: activeOrders = [] } = useQuery<ActiveOrder[]>({
    queryKey: ['demo-active-orders', restaurant?.id], enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data } = await supabase.from('orders')
        .select('id,ticket_number,created_at,table_id,order_items(id,quantity,menu_items(name))')
        .eq('restaurant_id', restaurant!.id).in('status', ['pending', 'preparing'])
        .order('created_at', { ascending: true }).limit(4);
      return (data ?? []) as ActiveOrder[];
    },
    staleTime: 30_000,
  });

  const totalRevenue = useMemo(
    () => paidOrders.reduce((s, o) => s + Number(o.total_amount), 0),
    [paidOrders],
  );
  const ordersCount = paidOrders.length;
  const avgTicket = ordersCount > 0 ? totalRevenue / ordersCount : 0;
  const todayRevenue = useMemo(
    () =>
      paidOrders
        .filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
        .reduce((s, o) => s + Number(o.total_amount), 0),
    [paidOrders],
  );

  const { data: configRow } = useDemoPageConfig();
  const config = configRow ?? ({ id: '', ...DEMO_CONFIG_FALLBACK } as any);
  const fb = DEMO_CONFIG_FALLBACK;
  const hero = { ...fb.hero, ...config.hero };
  const cta = { ...fb.cta, ...config.cta };
  const embeds: DemoView[] = (config.embeds && config.embeds.length > 0 ? config.embeds : fb.embeds) as DemoView[];

  return (
    <MarketingLayout
      title="Demo — See ServeOS in action"
      description="Sign in to a real, fully-loaded demo restaurant. Tour the admin dashboard, live kitchen display, POS, and analytics — all with real data."
      canonical="/demo"
      keywords="restaurant software demo, ServeOS demo, restaurant management demo, live POS demo"
    >
      <ConsoleSection
        eyebrow={hero.eyebrow ?? 'Live product demo'}
        title={hero.title ?? 'Inside a live restaurant'}
        description={hero.description ?? ''}
        restaurantName={restaurant?.name}
        totalRevenue={totalRevenue}
        ordersCount={ordersCount}
        activeTickets={activeOrders.length}
        avgTicket={avgTicket}
        status={provisioning.status}
        onRetry={provisioning.retry}
        errorMsg={provisioning.errorMsg}
      />

      {/* LIVE OPERATIONS */}
      <div className="bg-muted/20">
        <LiveOpsSection
          paidOrders={paidOrders}
          activeOrders={activeOrders}
          todayRevenue={todayRevenue}
        />
      </div>

      {/* CTA */}
      <Section className="bg-muted/30 py-14 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">{cta.heading}</h2>
          <p className="mt-4 text-muted-foreground">{cta.subheading}</p>
          <div className="mt-8 grid grid-cols-1 sm:flex sm:flex-wrap gap-3 justify-center">
            {cta.primaryLabel && cta.primaryHref && (
              <Link to={cta.primaryHref}>
                <Button size="lg" className="gap-2 h-12 px-7 rounded-full w-full sm:w-auto">
                  {cta.primaryLabel} <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            )}
            {cta.secondaryLabel && cta.secondaryHref && (
              <Link to={cta.secondaryHref}>
                <Button size="lg" variant="outline" className="h-12 px-7 rounded-full w-full sm:w-auto">{cta.secondaryLabel}</Button>
              </Link>
            )}
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
