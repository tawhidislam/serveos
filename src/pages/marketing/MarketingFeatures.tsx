import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  QrCode, ClipboardList, ChefHat, CreditCard, BarChart3, Users,
  Tag, Building2, Sparkles, Bell, Layers, Lock, ArrowRight, Check,
  Zap, TrendingUp, Clock, Shield,
} from 'lucide-react';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading, Eyebrow } from '@/components/marketing/Section';
import FeatureCard from '@/components/marketing/FeatureCard';
import { Button } from '@/components/ui/button';

const sections = [
  {
    eyebrow: 'For your guests',
    title: 'QR Code Ordering that just works',
    description:
      'Give every table its own QR code. Customers scan, browse your branded menu, customize their order with dietary tags, and check out in under 30 seconds.',
    icon: QrCode,
    bullets: [
      'Branded menu pages with your logo & colors',
      'Customer customizations (no onion, extra spicy, etc.)',
      'Order tracking from kitchen to served',
      'Promo codes & first-order discounts',
    ],
    image: 'qr',
  },
  {
    eyebrow: 'For your front-of-house',
    title: 'Order Management & POS',
    description:
      'Waiters take orders on a tablet. Managers see every ticket, every table, every dollar — in real time.',
    icon: ClipboardList,
    bullets: [
      'POS for in-person orders',
      'Split bills & merge tickets',
      'Cash drawer sessions with audit trail',
      'Floor plans with live table status',
    ],
    image: 'orders',
  },
  {
    eyebrow: 'For your kitchen',
    title: 'Kitchen Display System',
    description:
      'Glassmorphic ticket displays with audio alerts, status filters, and one-tap progress updates. Your line cooks will love it.',
    icon: ChefHat,
    bullets: [
      'Real-time tickets with audio alerts',
      'Tab-based filtering by status',
      'Prep-time tracking per item',
      'Printable tickets for backup',
    ],
    image: 'kitchen',
  },
  {
    eyebrow: 'For your books',
    title: 'Billing, Payments & Accounting',
    description:
      'A full accounting suite — sales, expenses, payroll, inventory, P&L, tax reports, monthly statements. Stop exporting to spreadsheets.',
    icon: CreditCard,
    bullets: [
      'Sales & revenue dashboards',
      'Expense management with budgets',
      'Inventory & stock tracking',
      'Payroll, tips, and shift management',
    ],
    image: 'billing',
  },
  {
    eyebrow: 'For your growth',
    title: 'Analytics & Reports',
    description:
      'Live revenue, top items, server performance, financial forecasting. Know what\'s working before the night ends.',
    icon: BarChart3,
    bullets: [
      'Real-time revenue charts',
      'Top-selling items & categories',
      'Server performance & tip reports',
      'Financial forecasting & monthly P&L',
    ],
    image: 'analytics',
  },
];

const moreFeatures = [
  { icon: Users, title: 'Staff & Roles', description: 'Owners, admins, managers, kitchen, waiters — fine-grained role-based access.' },
  { icon: Building2, title: 'Multi-branch', description: 'Run multiple locations from one dashboard with per-branch reporting.' },
  { icon: Tag, title: 'Loyalty Program', description: 'Points per order or per dollar with redemption tiers and expiry rules.' },
  { icon: Bell, title: 'Real-time Alerts', description: 'Audio + push notifications for new orders, ready tickets, and waiter calls.' },
  { icon: Layers, title: 'Floor Plans', description: 'Drag-and-drop floor planner with live table occupancy.' },
  { icon: Lock, title: 'Secure by default', description: 'Row-level security, audit logs, and tenant isolation built in.' },
  { icon: QrCode, title: 'Custom Domains', description: 'Use your own domain for the customer-facing site (Pro plan).' },
];

const stats = [
  { icon: Zap, value: '< 30s', label: 'Avg checkout time' },
  { icon: TrendingUp, value: '32%', label: 'Higher avg ticket' },
  { icon: Clock, value: '< 2 min', label: 'Setup per table' },
  { icon: Shield, value: '99.99%', label: 'Uptime SLA' },
];

function MockPanel({ kind }: { kind: string }) {
  return (
    <div className="relative">
      {/* Glow */}
      <div className="absolute -inset-6 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent blur-3xl rounded-[40px] opacity-70" />
      {/* Browser frame */}
      <div className="relative rounded-2xl border border-border/60 bg-card shadow-[0_30px_80px_-20px_hsl(var(--primary)/0.25)] overflow-hidden">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/40">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-warning/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-success/60" />
          </div>
          <div className="flex-1 mx-4 h-5 rounded-md bg-background/80 border border-border/40" />
        </div>
        {/* Body */}
        <div className="p-8 aspect-[4/3] bg-gradient-to-br from-card via-card to-muted/40 flex items-center justify-center">
          <div className="w-full max-w-sm space-y-3">
            {kind === 'qr' && (
              <div className="space-y-4">
                <div className="aspect-square w-36 mx-auto rounded-2xl bg-foreground p-4 shadow-xl">
                  <div className="grid grid-cols-7 grid-rows-7 gap-0.5 h-full w-full">
                    {Array.from({ length: 49 }).map((_, i) => (
                      <div key={i} className={Math.random() > 0.5 ? 'bg-background rounded-[1px]' : ''} />
                    ))}
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Table 7</div>
                  <div className="text-sm font-semibold text-foreground">Bistro Olive</div>
                  <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">
                    <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Live menu
                  </div>
                </div>
              </div>
            )}
            {kind === 'orders' && (
              <div className="space-y-2.5">
                {[
                  { t: 'T-12', n: 'Margherita ×2', s: 'In kitchen', c: 'text-warning bg-warning/10' },
                  { t: 'T-04', n: 'Carbonara', s: 'Ready', c: 'text-success bg-success/10' },
                  { t: 'T-08', n: 'Tiramisu ×3', s: 'Pending', c: 'text-muted-foreground bg-muted' },
                  { t: 'T-02', n: 'Espresso ×4', s: 'Served', c: 'text-primary bg-primary/10' },
                ].map((o, i) => (
                  <div key={i} className="flex items-center justify-between rounded-xl bg-background/80 border border-border/60 p-3 shadow-sm">
                    <div>
                      <div className="text-[10px] text-muted-foreground font-mono">{o.t}</div>
                      <div className="text-sm font-medium text-foreground">{o.n}</div>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${o.c}`}>{o.s}</span>
                  </div>
                ))}
              </div>
            )}
            {kind === 'kitchen' && (
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { t: 'Pasta', n: 3, time: '04:32', urgent: false },
                  { t: 'Pizza', n: 4, time: '08:15', urgent: true },
                  { t: 'Salad', n: 5, time: '01:48', urgent: false },
                  { t: 'Dessert', n: 6, time: '02:55', urgent: false },
                ].map((t, i) => (
                  <div key={i} className={`rounded-xl border p-3 ${t.urgent ? 'border-destructive/40 bg-destructive/5' : 'border-primary/20 bg-primary/5'}`}>
                    <div className="text-[10px] text-muted-foreground font-mono">Table {t.n}</div>
                    <div className="text-sm font-bold text-foreground mt-0.5">{t.t}</div>
                    <div className={`text-[10px] mt-2 font-mono font-semibold ${t.urgent ? 'text-destructive' : 'text-primary'}`}>{t.time}</div>
                  </div>
                ))}
              </div>
            )}
            {kind === 'billing' && (
              <div className="space-y-3 rounded-xl bg-background/80 border border-border/60 p-5 shadow-sm">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground text-center">Receipt · #1247</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Margherita ×2</span><span className="font-medium tabular-nums">$36.00</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Carbonara</span><span className="font-medium tabular-nums">$22.50</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tiramisu ×2</span><span className="font-medium tabular-nums">$26.00</span></div>
                </div>
                <div className="border-t border-dashed border-border/60 pt-2 space-y-1 text-sm">
                  <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span className="tabular-nums">$84.50</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Tax 10%</span><span className="tabular-nums">$8.45</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>Tip 15%</span><span className="tabular-nums">$12.68</span></div>
                </div>
                <div className="border-t border-border/60 pt-2 flex justify-between text-base font-bold">
                  <span>Total</span><span className="tabular-nums text-primary">$105.63</span>
                </div>
              </div>
            )}
            {kind === 'analytics' && (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Today</div>
                    <div className="text-2xl font-bold text-foreground tabular-nums">$4,287</div>
                  </div>
                  <div className="inline-flex items-center gap-1 text-xs text-success font-semibold">
                    <TrendingUp className="h-3 w-3" /> +18.2%
                  </div>
                </div>
                <div className="h-32 flex items-end gap-1.5">
                  {[40, 65, 50, 80, 60, 95, 70, 85, 55, 90, 75, 88].map((h, i) => (
                    <div key={i} className="flex-1 bg-gradient-to-t from-primary to-primary/40 rounded-t-sm hover:from-primary hover:to-primary/60 transition-colors" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>9AM</span><span>12PM</span><span>3PM</span><span>6PM</span><span>9PM</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketingFeatures() {
  return (
    <MarketingLayout
      title="Features — Everything to run your restaurant"
      description="QR ordering, kitchen displays, POS, billing, analytics, accounting, loyalty, multi-branch — ServeOS has the full restaurant operating system."
      canonical="/features"
      keywords="restaurant features, QR ordering, kitchen display, POS, restaurant accounting, loyalty program, multi-branch restaurant"
    >
      {/* HERO */}
      <section className="relative overflow-hidden pt-20 pb-24 sm:pt-28 sm:pb-32">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[600px] w-[1200px] bg-gradient-radial from-primary/15 via-primary/5 to-transparent blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                'linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)',
              backgroundSize: '64px 64px',
            }}
          />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-6"
          >
            <Eyebrow>
              <Sparkles className="h-3.5 w-3.5" />
              The full restaurant OS
            </Eyebrow>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="font-display text-4xl sm:text-5xl lg:text-7xl font-semibold tracking-tight text-foreground"
          >
            One platform.
            <br />
            <span className="bg-gradient-to-r from-primary via-primary to-primary/60 bg-clip-text text-transparent">
              Every workflow.
            </span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground leading-relaxed"
          >
            From the moment a guest scans a QR code to the moment you close the books — ServeOS
            handles every step in between.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <Link to="/signup">
              <Button size="lg" className="gap-2 h-12 px-7 shadow-lg shadow-primary/25">
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-7">
                View live demo
              </Button>
            </Link>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25 }}
            className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto"
          >
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-sm p-5 hover:border-primary/30 transition-colors"
              >
                <s.icon className="h-5 w-5 text-primary mb-2 mx-auto" />
                <div className="text-2xl font-bold text-foreground tabular-nums">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* FEATURE SECTIONS */}
      {sections.map((s, i) => (
        <Section key={s.title} className={i % 2 === 1 ? 'bg-muted/30 border-y border-border/40' : ''}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            <motion.div
              initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5 }}
              className={i % 2 === 1 ? 'lg:order-2' : ''}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary uppercase tracking-wider mb-5">
                <s.icon className="h-3.5 w-3.5" />
                {s.eyebrow}
              </div>
              <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                {s.title}
              </h2>
              <p className="mt-5 text-base sm:text-lg text-muted-foreground leading-relaxed">
                {s.description}
              </p>
              <ul className="mt-8 space-y-3.5">
                {s.bullets.map((b) => (
                  <li key={b} className="flex gap-3 text-sm sm:text-base">
                    <div className="h-6 w-6 shrink-0 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                      <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                    </div>
                    <span className="text-foreground pt-0.5">{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.6 }}
              className={i % 2 === 1 ? 'lg:order-1' : ''}
            >
              <MockPanel kind={s.image} />
            </motion.div>
          </div>
        </Section>
      ))}

      {/* MORE */}
      <Section>
        <SectionHeading
          eyebrow="And more"
          title={<>Plus everything else <br className="hidden sm:inline" />you'd expect</>}
          description="A fully-loaded toolkit so you never need to bolt on another SaaS."
        />
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {moreFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.04} />
          ))}
        </div>
      </Section>

      {/* CTA */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-primary/5" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[900px] bg-gradient-radial from-primary/20 to-transparent blur-3xl" />
        </div>
        <div className="max-w-4xl mx-auto px-6 lg:px-10 text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="font-display text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight"
          >
            Ready to see it in action?
          </motion.h2>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Spin up your restaurant in 60 seconds.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup">
              <Button size="lg" className="gap-2 h-12 px-7 shadow-lg shadow-primary/25">
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button size="lg" variant="outline" className="h-12 px-7">
                View Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
