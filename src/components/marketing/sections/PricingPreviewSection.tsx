import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { Button } from '@/components/ui/button';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { getCurrencySymbol } from '@/lib/currency';
import { getPlanPrice, getPlanCycle } from '@/lib/plan-pricing';
import { planDurationMonths, isTrialPlan, planTermSuffix } from '@/lib/plan-duration';
import { usePlatformCurrency } from '@/hooks/usePlatformCurrency';
import type { PricingPreviewContent } from '@/lib/marketing-sections';

const FALLBACK_FEATURES = [
  'Unlimited order processing',
  'Theme customization',
  'Customer loyalty tracking',
  'Real-time alerts',
];

function fmt(amount: number, symbol: string) {
  if (!amount) return 'Free';
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

function getPrice(plan: SubscriptionPlan, currency: string) {
  const billingCycle = getPlanCycle(plan, currency);
  const resolved = getPlanPrice(plan, currency, billingCycle);
  const symbol = getCurrencySymbol(resolved.currency);
  const current = resolved.current;
  // Multi-month packages store their full price; label it with the real length.
  const months = planDurationMonths(plan.tier, billingCycle);
  const cycle = current || isTrialPlan(plan.tier) ? planTermSuffix(plan.tier, billingCycle) : '';
  const perMonth = current && months > 1 ? current / months : 0;
  return { symbol, current, cycle, perMonth, original: resolved.original, savings: resolved.savings, savingsPct: resolved.savingsPct, billingCycle };
}

function getFeatures(plan: SubscriptionPlan): string[] {
  const custom = Array.isArray(plan.features)
    ? plan.features.map((f) => (f ?? '').trim()).filter(Boolean)
    : [];
  if (custom.length > 0) return custom.slice(0, 5);
  // Derive a short summary from limits + feature flags when no custom bullets exist.
  const derived: string[] = [
    plan.max_menu_items ? `${plan.max_menu_items} menu items` : 'Unlimited menu items',
    plan.max_branches ? `${plan.max_branches} branch${plan.max_branches > 1 ? 'es' : ''}` : 'Unlimited branches',
    plan.max_staff ? `${plan.max_staff} staff seats` : 'Unlimited staff',
  ];
  if (plan.feature_accounting) derived.push('Accounting suite');
  if (plan.feature_loyalty) derived.push('Loyalty program');
  return derived.length ? derived.slice(0, 5) : FALLBACK_FEATURES;
}

export default function PricingPreviewSection({ content }: { content: PricingPreviewContent }) {
  const { data: allPlans, isLoading } = useSubscriptionPlans();
  const { currency } = usePlatformCurrency();

  const plans = useMemo(() => {
    const visible = (allPlans ?? []).filter((p) => p.is_public && p.is_active);
    let popularSeen = false;
    return visible.map((p) => {
      const isPopular = !popularSeen && (p.badge ?? '').toLowerCase().includes('popular');
      if (isPopular) popularSeen = true;
      return { ...p, _isPopular: isPopular } as SubscriptionPlan & { _isPopular: boolean };
    });
  }, [allPlans]);

  return (
    <Section className="bg-muted/40 border-y border-border/60" id="pricing-preview">
      <SectionHeading
        eyebrow={content.eyebrow}
        title={content.title}
        description={content.description}
      />

      {isLoading ? (
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-7 h-[360px] animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="mt-14 text-center text-muted-foreground">
          No plans available yet — please check back soon.
        </p>
      ) : (
        <div
          // Phones: a swipeable row (next card peeks in) instead of a very long
          // stack. Tablet and up: the usual grid.
          className={`mt-10 sm:mt-14 -mx-6 px-6 pt-4 pb-4 flex gap-4 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-auto sm:px-0 sm:pb-0 sm:grid sm:gap-5 sm:overflow-visible max-w-5xl ${
            plans.length >= 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : plans.length === 3 ? 'md:grid-cols-3' : plans.length === 2 ? 'sm:grid-cols-2' : ''
          }`}
        >
          {plans.map((plan, i) => {
            const { symbol, current, cycle, perMonth, original, savings, savingsPct, billingCycle } = getPrice(plan, currency);
            const featured = plan._isPopular;
            const features = getFeatures(plan);
            return (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`relative rounded-2xl border p-6 sm:p-7 flex flex-col shrink-0 w-[82%] snap-center sm:w-auto ${
                  featured
                    ? 'border-primary/40 bg-card shadow-xl shadow-primary/10 md:scale-[1.03]'
                    : 'border-border bg-card'
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold uppercase tracking-wider">
                    Most popular
                  </div>
                )}
                {savingsPct != null && (
                  <span className="mb-2 w-fit rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">Save {savingsPct}%</span>
                )}
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                {plan.description && (
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{plan.description}</p>
                )}
                {original != null && original > current && <p className="mt-3 text-sm text-muted-foreground line-through">{fmt(original, symbol)}</p>}
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-foreground">{fmt(current, symbol)}</span>
                  {cycle && <span className="text-sm text-muted-foreground">{cycle}</span>}
                </div>
                {savings != null && <p className="mt-1 text-xs font-medium text-emerald-700">You save {fmt(savings, symbol)}</p>}
                {perMonth > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">≈ {fmt(perMonth, symbol)} per month</p>
                )}
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground flex-1">
                  {features.map((f, idx) => (
                    <li key={idx} className="flex gap-2">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Link to={isTrialPlan(plan.tier) ? '/signup' : `/signup?plan=${encodeURIComponent(plan.tier)}&cycle=${billingCycle}`} className="block mt-7">
                  <Button className="w-full" variant={featured ? 'default' : 'outline'}>
                    {isTrialPlan(plan.tier) ? 'Start free trial' : 'Get this plan'}
                  </Button>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {content.compareLabel && (
        <div className="mt-10 text-center">
          <Link to={content.compareHref || '/pricing'} className="text-sm text-primary hover:underline">
            {content.compareLabel} →
          </Link>
        </div>
      )}
    </Section>
  );
}
