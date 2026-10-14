import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Check, ArrowRight, ShieldCheck, RefreshCw, Zap, Headphones } from 'lucide-react';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import { Section, SectionHeading } from '@/components/marketing/Section';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { getCurrencySymbol } from '@/lib/currency';
import { getPlanPrice, getPlanCycle } from '@/lib/plan-pricing';
import { isTrialPlan, planTermSuffix } from '@/lib/plan-duration';
import { usePlatformCurrency } from '@/hooks/usePlatformCurrency';

// Built-in fallback shown ONLY when an admin has not configured custom bullets
// for a given plan via /platform/packages → "Pricing-page bullets".
const DEFAULT_FEATURES = [
  'Explore our 4 free subdomains',
  'Add your custom domain',
  'Free access to ServeOS Academy',
  'Integrated logistics and payment solutions',
  'Unlimited order and receipt processing',
  'Theme customization',
  'Track customer loyalty & customer list',
  'Enable alerts',
  'Dashboard',
  'Export reports',
];

function getPlanFeatures(plan: SubscriptionPlan): string[] {
  // Admin-edited bullets win; drop blanks defensively. Fallback to the default list otherwise.
  const custom = Array.isArray(plan.features)
    ? plan.features.map((f) => (f ?? '').trim()).filter(Boolean)
    : [];
  return custom.length > 0 ? custom : DEFAULT_FEATURES;
}

function fmt(amount: number, symbol: string) {
  // Match Zatiq's compact integer pricing (e.g. ৳1,200 not ৳1,200.00).
  return `${symbol}${Math.round(amount).toLocaleString()}`;
}

interface CardPricing {
  symbol: string;
  current: number;
  original: number | null;
  savings: number | null;
  savingsPct: number | null;
}

function getCardPricing(plan: SubscriptionPlan, currency: string): CardPricing {
  // Resolve the cycle this card represents (in the viewer's currency), then
  // read the price for that cycle. Falls back to the plan's base currency.
  const cycle = getPlanCycle(plan, currency);
  const resolved = getPlanPrice(plan, currency, cycle);
  const symbol = getCurrencySymbol(resolved.currency);
  return {
    symbol,
    current: resolved.current,
    original: resolved.original,
    savings: resolved.savings,
    savingsPct: resolved.savingsPct,
  };
}

/** Pick the billing cycle this card represents so we can deep-link checkout to it. */
function getCardCycle(plan: SubscriptionPlan, currency: string): 'monthly' | 'yearly' {
  return getPlanCycle(plan, currency);
}

export default function MarketingPricing() {
  const { data: allPlans, isLoading } = useSubscriptionPlans();
  const { currency } = usePlatformCurrency();
  const plans = useMemo(() => {
    const visible = (allPlans ?? []).filter((p) => p.is_public && p.is_active);
    // Only the FIRST plan badged "popular" should render as popular —
    // a second "Popular" tag dilutes the visual emphasis.
    let popularSeen = false;
    return visible.map((p) => {
      const isPopular = !popularSeen && (p.badge ?? '').toLowerCase().includes('popular');
      if (isPopular) popularSeen = true;
      return { ...p, _isPopular: isPopular } as SubscriptionPlan & { _isPopular: boolean };
    });
  }, [allPlans]);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      { '@type': 'Question', name: 'Can I switch plans later?', acceptedAnswer: { '@type': 'Answer', text: 'Yes. Upgrade or downgrade anytime — we\'ll prorate the difference automatically.' } },
      { '@type': 'Question', name: 'Are there any hidden fees?', acceptedAnswer: { '@type': 'Answer', text: 'No hidden fees. The price you see is the price you pay — no per-order or per-transaction charges.' } },
      { '@type': 'Question', name: 'Do you offer a money-back guarantee?', acceptedAnswer: { '@type': 'Answer', text: 'Yes — if ServeOS isn\'t right for you in the first 30 days, we\'ll refund your last invoice in full.' } },
    ],
  };

  return (
    <MarketingLayout
      title="Pricing — Choose the plan to grow your business"
      description="No hidden fees. Flexible pricing. Monthly, 3-month, 6-month, and yearly options available."
      canonical="/pricing"
      keywords="restaurant software pricing, restaurant POS plans, ServeOS pricing"
      jsonLd={faqJsonLd}
    >
      <Section className="!pt-12 !pb-12">
        {/* Hero — tighter so cards land closer to the fold */}
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-[1.1]">
            Choose the plan to grow your business
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Simple, transparent pricing. Cancel anytime. The longer you commit, the more you save.
          </p>
        </div>

        {/* Plan cards */}
        {isLoading ? (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border border-border/60 bg-card p-7 h-[640px] animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <p className="mt-16 text-center text-muted-foreground">
            No plans available yet — please check back soon.
          </p>
        ) : (
          <div className={`mt-12 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-7xl mx-auto items-stretch ${
            plans.length >= 5 ? 'lg:grid-cols-3 xl:grid-cols-5' : plans.length >= 4 ? 'lg:grid-cols-4' : plans.length === 3 ? 'lg:grid-cols-3' : ''
          }`}>
            {plans.map((plan, i) => {
              const { symbol, current, original, savings, savingsPct } = getCardPricing(plan, currency);
              const isPopular = (plan as SubscriptionPlan & { _isPopular?: boolean })._isPopular ?? false;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className={`relative flex ${isPopular ? 'lg:-my-2' : ''}`}
                >
                  {/* "Most popular" pill — only one card shows it */}
                  {isPopular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <span className="inline-block bg-primary text-primary-foreground text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-md">
                        Most popular
                      </span>
                    </div>
                  )}

                  <div
                    className={`relative h-full w-full rounded-2xl p-6 flex flex-col transition-all ${
                      isPopular
                        ? 'bg-card border-2 border-primary shadow-lg shadow-primary/10'
                        : 'bg-card border border-border/60 shadow-sm hover:shadow-md hover:border-border'
                    }`}
                  >
                    {/* Savings pill sits above the name so the name has full width
                        and never wraps — keeps each card's header height identical. */}
                    <div className="h-5 mb-2">
                      {savingsPct != null && (
                        <span className="inline-block rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[11px] font-semibold px-2 py-0.5">
                          Save {savingsPct}%
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground leading-tight">
                      {plan.name}
                    </h3>
                    {/* Description with reserved height for up to 3 lines so all cards align */}
                    <p className="mt-1.5 text-xs text-muted-foreground min-h-[54px] leading-relaxed">
                      {plan.description ?? '\u00A0'}
                    </p>

                    {/* Price block — fixed slot heights keep the price baseline aligned */}
                    <div className="mt-5">
                      <div className="h-5">
                        {original != null && original > current && (
                          <p className="text-sm text-muted-foreground line-through leading-none">
                            {fmt(original, symbol)}
                          </p>
                        )}
                      </div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="text-[2.75rem] font-bold text-foreground leading-none tracking-tight">
                          {isTrialPlan(plan.tier) ? 'Free' : fmt(current, symbol)}
                        </span>
                        {(current > 0 || isTrialPlan(plan.tier)) && (
                          <span className="text-sm text-muted-foreground">
                            {planTermSuffix(plan.tier, getCardCycle(plan, currency))}
                          </span>
                        )}
                      </div>
                      <div className="h-5 mt-1.5">
                        {savings != null && (
                          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            You save {fmt(savings, symbol)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* CTA — solid for popular, outline for the rest so popular pops.
                        Every plan deep-links to signup → checkout (no free tier). */}
                    <Link
                      to={isTrialPlan(plan.tier) ? '/signup' : `/signup?plan=${plan.tier}&cycle=${getCardCycle(plan, currency)}`}
                      className="block w-full mt-5"
                    >
                      <button
                        className={`w-full h-11 rounded-full font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${
                          isPopular
                            ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm'
                            : 'bg-card text-foreground border border-border hover:bg-muted hover:border-primary/40'
                        }`}
                      >
                        {isTrialPlan(plan.tier) ? 'Start free trial' : 'Get this plan'} <ArrowRight className="h-4 w-4" />
                      </button>
                    </Link>

                    {/* Features */}
                    {plan.features_visible !== false && (
                      <div className="mt-6 pt-6 border-t border-border/60 flex-1">
                        <h4 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
                          {(plan.features_heading ?? '').trim() || "What's included"}
                        </h4>
                        <ul className="space-y-2.5 text-[13px] text-foreground">
                          {getPlanFeatures(plan).map((f) => (
                            <li key={f} className="flex gap-2 items-start">
                              <span className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
                              </span>
                              <span className="leading-snug">{f}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Trust strip */}
        <div className="mt-20 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: ShieldCheck, label: '30-day money-back guarantee' },
            { icon: RefreshCw, label: 'Cancel or change plan anytime' },
            { icon: Zap, label: 'Setup in under 10 minutes' },
            { icon: Headphones, label: 'Human support, every plan' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-4">
              <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary grid place-items-center shrink-0">
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-medium text-foreground leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-muted/30">
        <SectionHeading eyebrow="FAQ" title="Pricing questions, answered" />
        <div className="mt-12 max-w-3xl mx-auto grid gap-4">
          {[
            { q: 'Can I switch plans later?', a: 'Yes. Upgrade or downgrade anytime — we\'ll prorate the difference automatically.' },
            { q: 'Are there any hidden fees?', a: 'No hidden fees. The price you see is the price you pay — no per-order or per-transaction charges.' },
            { q: 'Do you offer a money-back guarantee?', a: 'Yes. If ServeOS isn\'t right for you within 30 days of your first paid invoice, we\'ll refund it in full — no questions asked.' },
            { q: 'What payment methods do you accept?', a: 'We accept all major credit cards and bKash. For yearly plans we can also issue invoices.' },
            { q: 'Do you offer custom enterprise pricing?', a: 'Yes — chains and large operations can contact us for volume pricing, custom SLAs, and onboarding support.' },
          ].map((f) => (
            <div key={f.q} className="rounded-xl border border-border/60 bg-card p-6">
              <h3 className="text-base font-semibold text-foreground">{f.q}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <Section>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight">Ready to get started?</h2>
          <p className="mt-3 text-muted-foreground">No setup fees. Pick a plan, pay securely, and start running smoother shifts in minutes.</p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/pricing">
              <button className="h-12 px-7 rounded-full bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-sm w-full sm:w-auto">
                Choose your plan <ArrowRight className="h-4 w-4" />
              </button>
            </Link>
            <Link to="/demo">
              <button className="h-12 px-7 rounded-full border border-border bg-card text-foreground font-semibold text-sm hover:bg-muted transition-colors w-full sm:w-auto">
                Watch demo
              </button>
            </Link>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}
