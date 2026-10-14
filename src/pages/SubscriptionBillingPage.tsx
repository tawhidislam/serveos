import { getPlanCycle, getPlanPrice } from '@/lib/plan-pricing';
import { planDurationMonths, durationSuffix, isTrialPlan } from '@/lib/plan-duration';
import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useSubscriptionPlans, type SubscriptionPlan } from '@/hooks/useSubscriptionPlans';
import { usePlan } from '@/hooks/usePlan';
import {
  usePlatformAddons, useRestaurantAddons, useMyAddonRequests,
  type PlatformAddon, type AddonPurchaseRequest,
} from '@/hooks/useAddons';
import { getCurrencySymbol, formatMoney } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Copy, Smartphone, AlertCircle, CheckCircle2, XCircle, Clock, Sparkles, Download, Puzzle, ShoppingBag, X as XIcon, Loader2, CreditCard, DollarSign, RefreshCw, CalendarClock, Tag, Percent, AlertTriangle, Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { format, differenceInCalendarDays } from 'date-fns';
import { downloadSubscriptionInvoice } from '@/lib/subscriptionInvoicePdf';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import { useMarketingContact } from '@/hooks/useMarketingContact';
import {
  readPendingFeatureRedirect,
  setPendingFeatureRedirect,
} from '@/components/FeatureGate';

type Cycle = 'monthly' | 'yearly';

interface MobilePaymentProvider {
  id: string;
  provider: 'bkash' | 'nagad' | 'rocket';
  display_name: string;
  receiver_number: string;
  account_type: string;
  instructions: string | null;
  reference_prefix: string | null;
  is_enabled: boolean;
  sort_order: number;
}

const PROVIDER_THEME: Record<string, { ring: string; bg: string; text: string }> = {
  bkash:  { ring: 'border-pink-500/30',     bg: 'bg-pink-500/10',     text: 'text-pink-500' },
  nagad:  { ring: 'border-orange-500/30',   bg: 'bg-orange-500/10',   text: 'text-orange-500' },
  rocket: { ring: 'border-purple-500/30',   bg: 'bg-purple-500/10',   text: 'text-purple-500' },
};

const submitSchema = z.object({
  sender_number: z.string().trim()
    .regex(/^01[3-9]\d{8}$/, 'Enter a valid mobile number (e.g. 01XXXXXXXXX)'),
  transaction_id: z.string().trim().min(6, 'Transaction ID is too short').max(64, 'Too long'),
  notes: z.string().max(500).optional(),
});

export default function SubscriptionBillingPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: restaurant } = useCurrentRestaurant();
  const { data: plans = [] } = useSubscriptionPlans();
  const { data: currentPlan } = usePlan();
  const [searchParams, setSearchParams] = useSearchParams();
  const { siteName, logoUrl } = usePlatformBranding();
  const { data: marketingContact } = useMarketingContact();
  /** Pull the configured support email from marketing contact settings, if present. */
  const platformSupportEmail =
    marketingContact?.contact_info?.find(
      (c) => (c.icon ?? '').toLowerCase() === 'mail' && (c.value ?? '').includes('@'),
    )?.value?.trim() || '';

  // Live subscription period info (for expiry date display)
  const { data: subscriptionPeriod } = useQuery({
    queryKey: ['my-subscription-period', restaurant?.id ?? 'none'],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('plan, status, current_period_end')
        .eq('restaurant_id', restaurant!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const [cycle, setCycle] = useState<Cycle>('monthly');
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeProvider, setActiveProvider] = useState<MobilePaymentProvider | null>(null);
  // Coupon state — applied coupon (after successful validation) and the input field.
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon_id: string; code: string; description: string | null;
    discount_type: string; discount_value: number;
    discount_amount: number; final_amount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  // Stable submission reference generated once per dialog open. Reusing the
  // same reference across "Try again" clicks keeps the submission idempotent
  // — the platform team will see one logical attempt even if the network
  // request was retried.
  const [submissionRef, setSubmissionRef] = useState<string | null>(null);

  // Compute the base amount for the currently selected plan/cycle.
  const baseAmount = selectedPlan
    ? getPlanPrice(selectedPlan, selectedPlan.currency, getPlanCycle(selectedPlan, selectedPlan.currency, cycle)).current
    : 0;
  const finalAmount = appliedCoupon ? appliedCoupon.final_amount : baseAmount;

  // Reset coupon whenever the dialog closes or the plan/cycle changes.
  useEffect(() => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  }, [dialogOpen, selectedPlan?.id, cycle]);

  const validateCoupon = async () => {
    if (!couponInput.trim() || !selectedPlan) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data, error } = await (supabase as any).rpc('validate_subscription_coupon', {
        _code: couponInput.trim(),
        _plan: selectedPlan.tier,
        _cycle: cycle,
        _amount: baseAmount,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.valid) {
        setCouponError(row?.reason || 'Invalid coupon');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          coupon_id: row.coupon_id,
          code: row.code,
          description: row.description,
          discount_type: row.discount_type,
          discount_value: Number(row.discount_value),
          discount_amount: Number(row.discount_amount),
          final_amount: Number(row.final_amount),
        });
        toast.success(`Coupon applied — saved ${selectedPlan.currency} ${Number(row.discount_amount).toLocaleString()}`);
      }
    } catch (e: any) {
      setCouponError(e?.message || 'Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  // Mobile payment providers (bkash / nagad / rocket)
  const { data: providers = [] } = useQuery({
    queryKey: ['mobile-payment-providers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mobile_payment_settings')
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MobilePaymentProvider[];
    },
  });

  const enabledProviders = useMemo(
    () => providers.filter((p) => p.is_enabled && p.receiver_number),
    [providers],
  );

  // Default the active provider when dialog opens
  useEffect(() => {
    if (dialogOpen && !activeProvider && enabledProviders.length > 0) {
      setActiveProvider(enabledProviders[0]);
    }
  }, [dialogOpen, activeProvider, enabledProviders]);

  // Deep-link from the public pricing page or a locked feature page:
  // /admin/subscription?plan=pro&cycle=yearly&next=/admin/orders
  // → preselect the cycle, find the matching plan, open the payment dialog,
  //   and remember the page to return to after upgrade completes.
  useEffect(() => {
    const planParam = searchParams.get('plan');
    const cycleParam = searchParams.get('cycle') as Cycle | null;
    const nextParam = searchParams.get('next');

    // Persist the intended destination even if no plan param is present, so a
    // user landing here from a locked admin page (e.g. /admin/orders) is bounced
    // back automatically once their subscription becomes active.
    if (nextParam && nextParam.startsWith('/')) {
      setPendingFeatureRedirect(nextParam);
    }

    if (!planParam || plans.length === 0) return;
    const target = plans.find((p) => p.tier === planParam && p.is_active && p.is_public && !isTrialPlan(p.tier));
    if (!target) return;
    setCycle(getPlanCycle(target, target.currency, cycleParam === 'monthly' || cycleParam === 'yearly' ? cycleParam : undefined));
    if (enabledProviders.length === 0) return; // wait for providers to load
    setSelectedPlan(target);
    const provider = enabledProviders[0];
    setActiveProvider(provider);
    setSubmissionRef(mintSubmissionRef(provider, restaurant?.id));
    setDialogOpen(true);
    // Clear plan/cycle/next params so reopening the page later doesn't re-trigger
    // the dialog (the destination is already saved in sessionStorage above).
    const next = new URLSearchParams(searchParams);
    next.delete('plan');
    next.delete('cycle');
    next.delete('next');
    setSearchParams(next, { replace: true });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, enabledProviders]);

  // Payment history
  const { data: payments = [] } = useQuery({
    queryKey: ['my-subscription-payments', restaurant?.id ?? 'none'],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_payments')
        .select('*')
        .eq('restaurant_id', restaurant!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const publicPlans = useMemo(
    () => plans.filter((p) => p.is_active && p.is_public).sort((a, b) => a.sort_order - b.sort_order),
    [plans],
  );

  const submit = useMutation({
    mutationFn: async (form: { sender_number: string; transaction_id: string; notes?: string }) => {
      if (!restaurant || !selectedPlan || !user || !activeProvider) throw new Error('Missing data');
      const amount = baseAmount;
      const charged = appliedCoupon ? appliedCoupon.final_amount : amount;
      // Use the dialog-scoped submission reference so retries reuse the same
      // code instead of minting a fresh one on every click.
      const referenceCode = submissionRef
        ?? `${activeProvider.reference_prefix || 'SUB'}-${restaurant.id.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await (supabase as any).from('subscription_payments').insert({
        restaurant_id: restaurant.id,
        submitted_by: user.id,
        plan: selectedPlan.tier,
        billing_cycle: cycle,
        amount: charged,
        original_amount: amount,
        discount_amount: appliedCoupon ? appliedCoupon.discount_amount : 0,
        coupon_id: appliedCoupon ? appliedCoupon.coupon_id : null,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        currency: selectedPlan.currency || 'BDT',
        payment_method: activeProvider.provider,
        sender_number: form.sender_number,
        transaction_id: form.transaction_id,
        reference_code: referenceCode,
        notes: form.notes || null,
        status: 'pending',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const pending = readPendingFeatureRedirect();
      toast.success(
        pending
          ? 'Payment submitted! We\'ll take you back to the page you were trying to open as soon as your plan is approved.'
          : 'Payment submitted! Platform team will verify within 24 hours.',
      );
      setDialogOpen(false);
      setSelectedPlan(null);
      setActiveProvider(null);
      qc.invalidateQueries({ queryKey: ['my-subscription-payments'] });
    },
    onError: (e: any) => {
      const msg = String(e?.message || '');
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.error('This Transaction ID has already been submitted.');
      } else {
        toast.error(msg || 'Failed to submit payment');
      }
    },
  });

  // Helper — mint a fresh submission reference for a checkout flow. Called
  // once when the dialog opens; the value persists through retries.
  const mintSubmissionRef = (provider: MobilePaymentProvider | null, restaurantId: string | undefined) => {
    const prefix = provider?.reference_prefix || 'SUB';
    const tenant = (restaurantId ?? 'XXXXXXXX').slice(0, 8).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    return `${prefix}-${tenant}-${Date.now().toString(36).toUpperCase()}${rand}`;
  };

  const openCheckout = (plan: SubscriptionPlan) => {
    if (enabledProviders.length === 0) {
      toast.error('No mobile payment method is configured yet. Please contact support.');
      return;
    }
    if (isTrialPlan(plan.tier)) return;
    setCycle(getPlanCycle(plan, plan.currency));
    setSelectedPlan(plan);
    const provider = enabledProviders[0];
    setActiveProvider(provider);
    setSubmissionRef(mintSubmissionRef(provider, restaurant?.id));
    setDialogOpen(true);
  };

  const resubmitPayment = (payment: any) => {
    if (enabledProviders.length === 0) {
      toast.error('No mobile payment method is configured yet. Please contact support.');
      return;
    }
    const target = plans.find((p) => p.tier === payment.plan && p.is_active);
    if (!target) {
      toast.error('That plan is no longer available. Please pick a current plan.');
      return;
    }
    setCycle(getPlanCycle(target, target.currency, payment.billing_cycle === 'yearly' ? 'yearly' : 'monthly'));
    setSelectedPlan(target);
    // Prefer the same provider if it's still enabled, otherwise default to first.
    const sameProvider = enabledProviders.find((p) => p.provider === payment.payment_method);
    const provider = sameProvider || enabledProviders[0];
    setActiveProvider(provider);
    setSubmissionRef(mintSubmissionRef(provider, restaurant?.id));
    setDialogOpen(true);
  };

  const copyNumber = () => {
    if (!activeProvider?.receiver_number) return;
    navigator.clipboard.writeText(activeProvider.receiver_number);
    toast.success(`${activeProvider.display_name} number copied`);
  };

  const ctaLabel = enabledProviders.length === 1
    ? `Pay with ${enabledProviders[0].display_name}`
    : 'Pay with Mobile Banking';

  return (
    <AdminLayout title="Subscription & Plans" subtitle="Choose a plan and pay securely with mobile banking">
      <div className="p-6 sm:p-10 max-w-5xl mx-auto space-y-6">
        {/* Header — platform style */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Subscription & plans</h1>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              Choose a plan that fits your restaurant. Pay securely with mobile banking — your
              subscription activates as soon as the platform team verifies your payment.
            </p>
          </div>
          <SubscriptionStatusCard
            tier={currentPlan?.tier || 'free'}
            status={currentPlan?.status || 'inactive'}
            periodEnd={subscriptionPeriod?.current_period_end ?? null}
          />
        </header>

        <Tabs defaultValue="plans" className="w-full">
          <TabsList className="w-full justify-start overflow-x-auto h-auto flex-wrap">
            <TabsTrigger value="plans" className="gap-2">
              <Sparkles className="h-3.5 w-3.5" /> Plans
            </TabsTrigger>
            <TabsTrigger value="addons" className="gap-2">
              <Puzzle className="h-3.5 w-3.5" /> Add-ons
            </TabsTrigger>
            {payments.length > 0 && (
              <TabsTrigger value="history" className="gap-2">
                <Clock className="h-3.5 w-3.5" /> Payment history
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="plans" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Available plans</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {publicPlans.map((plan) => {
                    const packageCycle = getPlanCycle(plan, plan.currency);
                    const price = getPlanPrice(plan, plan.currency, packageCycle).current;
                    const isCurrent = currentPlan?.tier === plan.tier && currentPlan?.isActive;
                    return (
                      <div
                        key={plan.id}
                        className={`bg-background border rounded-xl p-5 flex flex-col transition-shadow hover:shadow-md ${
                          plan.badge ? 'ring-2 ring-primary border-primary/30' : 'border-border'
                        }`}
                      >
                        {plan.badge && (
                          <Badge className="w-fit mb-3 bg-primary text-primary-foreground text-[10px]">
                            {plan.badge}
                          </Badge>
                        )}
                        <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
                        {plan.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                        )}
                        <div className="mt-4 mb-4">
                          <span className="text-3xl font-bold text-foreground">
                            {price === 0 ? 'Free' : `${plan.currency} ${price.toLocaleString()}`}
                          </span>
                          {price > 0 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              {durationSuffix(planDurationMonths(plan.tier, packageCycle))}
                            </span>
                          )}
                        </div>
                        <ul className="space-y-1.5 text-xs text-muted-foreground flex-1">
                          <FeatureLine on={plan.feature_pos} label="POS & Billing" />
                          <FeatureLine on={plan.feature_kds} label="Kitchen Display" />
                          <FeatureLine on={plan.feature_promotions} label="Promotions" />
                          <FeatureLine on={plan.feature_loyalty} label="Loyalty Program" />
                          <FeatureLine on={plan.feature_accounting} label="Accounting Suite" />
                          <FeatureLine on={plan.feature_custom_domain} label="Custom Domain" />
                          <FeatureLine on={plan.feature_multi_branch} label="Multi-Branch" />
                        </ul>
                        <Button
                          className="mt-5 w-full"
                          variant={isCurrent ? 'outline' : 'default'}
                          disabled={isCurrent || price === 0}
                          onClick={() => openCheckout(plan)}
                        >
                          {isCurrent ? 'Current Plan' : price === 0 ? (isTrialPlan(plan.tier) ? 'New restaurants only' : 'Free Plan') : ctaLabel}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addons" className="mt-4">
            <AddonsSection restaurantId={restaurant?.id ?? null} />
          </TabsContent>

          {payments.length > 0 && (
            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Payment history</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50">
                      <StatusBadge status={p.status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium capitalize">{p.plan} · {p.billing_cycle}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {methodLabel(p.payment_method)} · TrxID: {p.transaction_id} · {format(new Date(p.created_at), 'MMM d, yyyy HH:mm')}
                        </p>
                        {p.admin_notes && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 italic">Note: {p.admin_notes}</p>
                        )}
                      </div>
                      <p className="text-sm font-semibold tabular-nums">{p.currency} {Number(p.amount).toLocaleString()}</p>
                      {p.status === 'approved' && restaurant && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() =>
                            downloadSubscriptionInvoice({
                              payment: p,
                              restaurant: {
                                name: restaurant.name,
                                slug: restaurant.slug,
                                custom_domain: restaurant.custom_domain,
                              },
                              platform: {
                                name: siteName,
                                supportEmail: platformSupportEmail,
                                logoUrl,
                              },
                            })
                          }
                        >
                          <Download className="h-3.5 w-3.5" />
                          Invoice
                        </Button>
                      )}
                      {p.status === 'rejected' && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          onClick={() => resubmitPayment(p)}
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Resubmit
                        </Button>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Checkout Dialog */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) {
            setActiveProvider(null);
            setSubmissionRef(null);
          }
        }}
      >
        <CheckoutDialogContent
          activeProvider={activeProvider}
          enabledProviders={enabledProviders}
          setActiveProvider={setActiveProvider}
          headerTitle={
            selectedPlan
              ? <>Subscribing to <strong className="capitalize">{selectedPlan.name}</strong></>
              : 'Subscription checkout'
          }
          headerMeta={
            selectedPlan
              ? `${formatMoney(selectedPlan.currency, baseAmount)} ${durationSuffix(planDurationMonths(selectedPlan.tier, cycle))}`
              : ''
          }
          copyNumber={copyNumber}
          showCoupon={!!selectedPlan && baseAmount > 0}
          couponCurrency={selectedPlan?.currency || ''}
          baseAmount={baseAmount}
          finalAmount={finalAmount}
          appliedCoupon={appliedCoupon}
          couponInput={couponInput}
          setCouponInput={setCouponInput}
          setCouponError={setCouponError}
          couponError={couponError}
          validateCoupon={validateCoupon}
          validatingCoupon={validatingCoupon}
          removeCoupon={removeCoupon}
          couponPlaceholder="WELCOME20"
          onSubmitPayment={(form) => submit.mutate(form)}
          submitting={submit.isPending}
          submitError={
            submit.isError
              ? (() => {
                  const msg = String((submit.error as any)?.message || '');
                  if (msg.includes('duplicate') || msg.includes('unique')) {
                    return 'This Transaction ID has already been submitted.';
                  }
                  return msg || 'Failed to submit payment. Please try again.';
                })()
              : null
          }
          clearSubmitError={() => submit.reset()}
        />
      </Dialog>
    </AdminLayout>
  );
}

function methodLabel(method: string | null | undefined): string {
  if (!method) return 'Mobile';
  switch (method) {
    case 'bkash': return 'bKash';
    case 'nagad': return 'Nagad';
    case 'rocket': return 'Rocket';
    default: return method.charAt(0).toUpperCase() + method.slice(1);
  }
}

function FeatureLine({ on, label }: { on: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {on ? (
        <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
      ) : (
        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-muted-foreground/30" />
      )}
      <span className={on ? '' : 'opacity-50 line-through'}>{label}</span>
    </li>
  );
}

function SubscriptionStatusCard({
  tier,
  status,
  periodEnd,
}: {
  tier: string;
  status: string;
  periodEnd: string | null;
}) {
  const isFree = tier === 'free';
  const end = periodEnd ? new Date(periodEnd) : null;
  const now = new Date();
  const isExpired = !!end && end.getTime() < now.getTime();
  const daysLeft = end ? differenceInCalendarDays(end, now) : null;

  // Tone the expiry pill: red if expired, amber if ≤ 7 days, muted otherwise.
  const expiryTone =
    isExpired
      ? 'bg-destructive/10 text-destructive border-destructive/30'
      : daysLeft !== null && daysLeft <= 7
        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
        : 'bg-muted/60 text-muted-foreground border-border';

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Current</span>
        <Badge variant="outline" className="capitalize gap-1.5">
          <Sparkles className="h-3 w-3" />
          {tier}
        </Badge>
        <Badge variant="outline" className="capitalize text-[10px]">
          {status}
        </Badge>
      </div>
      {!isFree && end && (
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] ${expiryTone}`}
          title={format(end, 'PPpp')}
        >
          <CalendarClock className="h-3 w-3" />
          {isExpired ? (
            <span>Expired on {format(end, 'MMM d, yyyy')}</span>
          ) : (
            <span>
              Renews on {format(end, 'MMM d, yyyy')}
              {daysLeft !== null && (
                <span className="ml-1 opacity-80">
                  ({daysLeft === 0 ? 'today' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left`})
                </span>
              )}
            </span>
          )}
        </div>
      )}
      {isFree && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-muted/60 text-muted-foreground text-[11px]">
          <CalendarClock className="h-3 w-3" />
          <span>No active subscription</span>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map = {
    pending: { icon: Clock, cls: 'bg-amber-500/15 text-amber-600' },
    approved: { icon: CheckCircle2, cls: 'bg-emerald-500/15 text-emerald-600' },
    rejected: { icon: XCircle, cls: 'bg-destructive/15 text-destructive' },
  } as const;
  const m = map[status as keyof typeof map] || map.pending;
  const Icon = m.icon;
  return (
    <Badge variant="outline" className={`${m.cls} border-transparent capitalize text-[10px] gap-1`}>
      <Icon className="h-3 w-3" />
      {status}
    </Badge>
  );
}

function PaymentForm({
  providerLabel,
  onSubmit,
  loading,
}: {
  providerLabel: string;
  onSubmit: (f: { sender_number: string; transaction_id: string; notes?: string }) => void;
  loading: boolean;
}) {
  const [sender, setSender] = useState('');
  const [trx, setTrx] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handle = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = submitSchema.safeParse({
      sender_number: sender,
      transaction_id: trx,
      notes: notes || undefined,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => {
        if (i.path[0]) errs[i.path[0] as string] = i.message;
      });
      setErrors(errs);
      return;
    }
    setErrors({});
    onSubmit({
      sender_number: parsed.data.sender_number!,
      transaction_id: parsed.data.transaction_id!,
      notes: parsed.data.notes,
    });
  };

  return (
    <form id="addon-checkout-form" onSubmit={handle} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="sender" className="text-xs font-medium">Your {providerLabel} number</Label>
        <Input
          id="sender"
          placeholder="01XXXXXXXXX"
          value={sender}
          onChange={(e) => setSender(e.target.value)}
          inputMode="tel"
          maxLength={11}
          className="h-10 font-mono tracking-wide"
          disabled={loading}
        />
        {errors.sender_number && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.sender_number}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="trx" className="text-xs font-medium">Transaction ID (TrxID)</Label>
        <Input
          id="trx"
          placeholder="e.g. 9A7BCDXYZ1"
          value={trx}
          onChange={(e) => setTrx(e.target.value.toUpperCase())}
          maxLength={64}
          className="h-10 font-mono tracking-wide"
          disabled={loading}
        />
        {errors.transaction_id && <p className="text-[11px] text-destructive mt-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.transaction_id}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes" className="text-xs font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
        <Textarea
          id="notes"
          placeholder="Any extra info for the platform team"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          className="resize-none text-sm"
          disabled={loading}
        />
      </div>
      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/40 border border-border/60 rounded-lg p-2.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <p className="leading-relaxed">Your purchase activates after the platform team verifies the transaction (usually within 24 hours).</p>
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/*  Shared Checkout Dialog Content (used by both plan + addon flows)          */
/* -------------------------------------------------------------------------- */

interface CheckoutDialogContentProps {
  activeProvider: MobilePaymentProvider | null;
  enabledProviders: MobilePaymentProvider[];
  setActiveProvider: (p: MobilePaymentProvider) => void;
  headerTitle: React.ReactNode;
  headerMeta: string;
  copyNumber: () => void;
  showCoupon: boolean;
  couponCurrency: string;
  baseAmount: number;
  finalAmount: number;
  appliedCoupon: {
    code: string;
    discount_type: string;
    discount_value: number;
    discount_amount: number;
  } | null;
  couponInput: string;
  setCouponInput: (s: string) => void;
  setCouponError: (s: string | null) => void;
  couponError: string | null;
  validateCoupon: () => void;
  validatingCoupon: boolean;
  removeCoupon: () => void;
  couponPlaceholder: string;
  onSubmitPayment: (form: { sender_number: string; transaction_id: string; notes?: string }) => void;
  submitting: boolean;
  /** Friendly message to show in the retry panel when the last submit failed. */
  submitError?: string | null;
  /** Called when the user clicks "Try again" — should clear submitError so the form re-renders. */
  clearSubmitError?: () => void;
  /** When provided, render a quantity stepper above the coupon section. */
  quantity?: number;
  setQuantity?: (n: number) => void;
  /** Optional cap on the quantity selector. */
  maxQuantity?: number | null;
  /** Per-unit price shown alongside the stepper for clarity. */
  unitAmount?: number;
}

function CheckoutDialogContent({
  activeProvider,
  enabledProviders,
  setActiveProvider,
  headerTitle,
  headerMeta,
  copyNumber,
  showCoupon,
  couponCurrency,
  baseAmount,
  finalAmount,
  appliedCoupon,
  couponInput,
  setCouponInput,
  setCouponError,
  couponError,
  validateCoupon,
  validatingCoupon,
  removeCoupon,
  couponPlaceholder,
  onSubmitPayment,
  submitting,
  submitError,
  clearSubmitError,
  quantity,
  setQuantity,
  maxQuantity,
  unitAmount,
}: CheckoutDialogContentProps) {
  // Always render money with the currency's symbol so plan and add-on
  // checkout dialogs display amounts identically (e.g. "৳500.00").
  const fmtAmount = (n: number) => formatMoney(couponCurrency, n);
  const fmtDiscountValue = () => {
    if (!appliedCoupon) return '';
    if (appliedCoupon.discount_type === 'percent') return `${appliedCoupon.discount_value}% off`;
    return `${formatMoney(couponCurrency, appliedCoupon.discount_value)} off`;
  };

  const theme = activeProvider ? PROVIDER_THEME[activeProvider.provider] : undefined;

  // When the quantity stepper is enabled, validate the value so we can block
  // checkout submission for invalid (non-integer / <1 / >max) quantities.
  const quantityEnabled = typeof setQuantity === 'function' && typeof quantity === 'number';
  const quantityError: string | null = (() => {
    if (!quantityEnabled) return null;
    const q = quantity as number;
    if (!Number.isFinite(q) || !Number.isInteger(q)) return 'Quantity must be a whole number.';
    if (q < 1) return 'Quantity must be at least 1.';
    if (maxQuantity != null && q > maxQuantity) return `Quantity can’t exceed ${maxQuantity}.`;
    return null;
  })();

  return (
    <DialogContent className="max-w-md p-0 gap-0 overflow-hidden max-h-[90dvh] flex flex-col">
      {/* Header */}
      <DialogHeader className="px-5 pt-5 pb-4 border-b border-border/60 bg-muted/20 space-y-2">
        <DialogTitle className="flex items-center gap-2 text-base">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${theme?.bg ?? 'bg-primary/10'} ${theme?.text ?? 'text-primary'}`}>
            <Smartphone className="h-4 w-4" />
          </span>
          <span className="flex-1">Pay with {activeProvider?.display_name || 'Mobile Banking'}</span>
        </DialogTitle>
        <DialogDescription className="text-xs leading-relaxed pl-10">
          {headerTitle}
          {headerMeta && (
            <span className="block mt-0.5 font-semibold text-foreground">{headerMeta}</span>
          )}
        </DialogDescription>
      </DialogHeader>

      {/* Scrollable body */}
      <div className="overflow-y-auto px-5 py-4 space-y-4 flex-1">
        {/* Provider selector — segmented */}
        {enabledProviders.length > 1 && (
          <div className="inline-flex w-full p-1 rounded-lg bg-muted border border-border/60">
            {enabledProviders.map((p) => {
              const t = PROVIDER_THEME[p.provider];
              const active = activeProvider?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setActiveProvider(p)}
                  disabled={submitting}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition ${
                    active
                      ? `bg-background shadow-sm ${t?.text ?? 'text-foreground'}`
                      : 'text-muted-foreground hover:text-foreground'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {p.display_name}
                </button>
              );
            })}
          </div>
        )}

        {activeProvider && (
          <>
            {/* Receiver number */}
            <div className={`rounded-xl ${theme?.bg} border ${theme?.ring} p-4`}>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-1.5">
                Send Money to this {activeProvider.display_name} {activeProvider.account_type} number
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-2xl font-bold tracking-wider text-foreground font-mono">
                  {activeProvider.receiver_number || '— not configured —'}
                </p>
                <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 hover:bg-background/60" onClick={copyNumber} disabled={!activeProvider.receiver_number}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {activeProvider.instructions && (
              <div className="rounded-lg bg-muted/40 border border-border/60 p-3 text-xs text-muted-foreground whitespace-pre-line leading-relaxed">
                {activeProvider.instructions}
              </div>
            )}

            {/* Quantity stepper — only when the parent enables multi-quantity. */}
            {setQuantity && typeof quantity === 'number' && (
              <div
                className={`rounded-lg border bg-card p-3 flex flex-col gap-2 ${
                  quantityError ? 'border-destructive/50' : 'border-border'
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <Label className="text-xs font-medium m-0">Quantity</Label>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {typeof unitAmount === 'number'
                      ? `${formatMoney(couponCurrency, unitAmount)} per unit`
                      : 'Choose how many units to buy'}
                    {maxQuantity ? ` · max ${maxQuantity}` : ''}
                  </p>
                </div>
                <div className="inline-flex items-center rounded-md border border-border bg-background overflow-hidden shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={submitting || quantity <= 1}
                    aria-label="Decrease quantity"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </Button>
                  <span
                    className="min-w-[2.5rem] text-center text-sm font-semibold tabular-nums px-2"
                    aria-live="polite"
                  >
                    {quantity}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-none"
                    onClick={() => {
                      const cap = maxQuantity ?? Infinity;
                      setQuantity(Math.min(cap, quantity + 1));
                    }}
                    disabled={submitting || (maxQuantity != null && quantity >= maxQuantity)}
                    aria-label="Increase quantity"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
                </div>
                {quantityError && (
                  <p role="alert" className="text-[11px] font-medium text-destructive">
                    {quantityError}
                  </p>
                )}
              </div>
            )}

            {/* Coupon code */}
            {showCoupon && (
              <div className="rounded-lg border border-border bg-card p-3 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <Label className="text-xs font-medium m-0">Have a coupon code?</Label>
                </div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-2 p-2.5 rounded-md bg-emerald-500/10 border border-emerald-500/30">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 font-mono">
                        {appliedCoupon.code}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {fmtDiscountValue()}
                        {' · '}
                        You save {fmtAmount(appliedCoupon.discount_amount)}
                      </p>
                    </div>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={removeCoupon} disabled={submitting}>
                      <XIcon className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={couponInput}
                      onChange={(e) => { setCouponInput(e.target.value.toUpperCase()); setCouponError(null); }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validateCoupon(); } }}
                      placeholder={couponPlaceholder}
                      className="h-9 text-xs font-mono uppercase flex-1"
                      maxLength={40}
                      disabled={validatingCoupon || submitting}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={validateCoupon}
                      disabled={!couponInput.trim() || validatingCoupon || submitting}
                    >
                      {validatingCoupon ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Apply'}
                    </Button>
                  </div>
                )}
                {couponError && (
                  <p className="text-[11px] text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> {couponError}
                  </p>
                )}
                <div className="pt-2.5 border-t border-border/60 space-y-1 text-xs">
                  {/* Unit price × quantity breakdown — only render this row
                      when the parent enables multi-quantity. When the unit
                      price isn't a positive finite number, fall back to a
                      friendly placeholder so we never display "$NaN × N" or
                      a confusingly empty line. */}
                  {quantityEnabled && (() => {
                    const hasValidUnit =
                      typeof unitAmount === 'number' &&
                      Number.isFinite(unitAmount) &&
                      unitAmount > 0;
                    return (
                      <div className="flex justify-between text-muted-foreground">
                        <span>
                          Unit price
                          <span className="text-[10px] text-muted-foreground/80 ml-1">
                            × {quantity}
                          </span>
                        </span>
                        {hasValidUnit ? (
                          <span className="tabular-nums">
                            {fmtAmount(unitAmount as number)}
                            <span className="text-muted-foreground/70"> × {quantity}</span>
                          </span>
                        ) : (
                          <span
                            className="text-[11px] italic text-muted-foreground/70"
                            title="Per-unit price isn’t available — see the subtotal below for the full amount."
                          >
                            Not available
                          </span>
                        )}
                      </div>
                    );
                  })()}
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="tabular-nums">{fmtAmount(baseAmount)}</span>
                  </div>
                  {validatingCoupon && !appliedCoupon && (
                    <div className="flex justify-between items-center">
                      <Skeleton className="h-3 w-16" />
                      <Skeleton className="h-3 w-14" />
                    </div>
                  )}
                  {appliedCoupon && (
                    (() => {
                      // Surface a clear coupon breakdown so buyers see the
                      // discount rate (e.g. "20% off" / "৳50 off") and whether
                      // the savings apply per unit or to the whole order.
                      const qty = quantityEnabled ? Math.max(1, quantity as number) : 1;
                      const totalDiscount = appliedCoupon.discount_amount;
                      const perUnitDiscount = qty > 1 ? totalDiscount / qty : null;
                      const isPercent = appliedCoupon.discount_type === 'percent';
                      const rateLabel = isPercent
                        ? `${appliedCoupon.discount_value}% off`
                        : `${fmtAmount(appliedCoupon.discount_value)} off`;
                      return (
                        <>
                          <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                            <span className="flex items-center gap-1 min-w-0">
                              <Tag className="h-3 w-3 shrink-0" />
                              <span className="truncate">
                                Coupon{' '}
                                <span className="font-mono font-semibold">
                                  {appliedCoupon.code}
                                </span>
                              </span>
                              <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 shrink-0">
                                ({rateLabel})
                              </span>
                            </span>
                            <span className="tabular-nums font-medium">
                              −{fmtAmount(totalDiscount)}
                            </span>
                          </div>
                          {perUnitDiscount != null && (
                            <div className="flex justify-between text-[10px] text-emerald-700/80 dark:text-emerald-400/80 -mt-0.5 pl-4">
                              <span>Per unit</span>
                              <span className="tabular-nums">
                                −{fmtAmount(perUnitDiscount)} × {qty}
                              </span>
                            </div>
                          )}
                        </>
                      );
                    })()
                  )}
                  <div className="flex justify-between items-baseline pt-1.5 mt-0.5 border-t border-border/40">
                    <span className="text-xs text-muted-foreground">
                      Total to send
                      {quantityEnabled && (quantity as number) > 1 && (
                        <span className="ml-1 text-[10px] text-muted-foreground/80">
                          ({quantity} units)
                        </span>
                      )}
                    </span>
                    {validatingCoupon ? (
                      <Skeleton className="h-5 w-20" />
                    ) : (
                      <span className="tabular-nums font-bold text-base text-foreground">{fmtAmount(finalAmount)}</span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {submitting ? (
              <div className="space-y-3" aria-busy="true" aria-live="polite">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-10 w-full" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-14 w-full" />
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-muted/40 border border-border/60 rounded-lg p-2.5">
                  <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  <p className="leading-relaxed">Submitting your payment to the platform team…</p>
                </div>
              </div>
            ) : submitError ? (
              <div
                role="alert"
                aria-live="assertive"
                className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Payment couldn’t be submitted
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed break-words">
                      {submitError}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="w-full h-9"
                  onClick={() => clearSubmitError?.()}
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Try again
                </Button>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Your details haven’t been sent yet — nothing was charged.
                </p>
              </div>
            ) : (
              <PaymentForm
                providerLabel={activeProvider.display_name}
                onSubmit={(form) => {
                  if (quantityError) return;
                  onSubmitPayment(form);
                }}
                loading={submitting}
              />
            )}
          </>
        )}
      </div>

      {/* Sticky footer */}
      <DialogFooter className="px-5 py-4 border-t border-border/60 bg-muted/20">
        {submitError && !submitting ? (
          <Button
            type="button"
            className="w-full h-11 text-sm font-semibold"
            onClick={() => clearSubmitError?.()}
          >
            <RefreshCw className="h-4 w-4 mr-2" /> Try again
          </Button>
        ) : (
          <Button
            type="submit"
            form="addon-checkout-form"
            className="w-full h-11 text-sm font-semibold"
            disabled={submitting || !activeProvider || !!quantityError}
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Submitting…</>
            ) : (
              <>Submit Payment · {fmtAmount(finalAmount)}</>
            )}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  );
}

/* -------------------------------------------------------------------------- */
/*  Add-ons section (merged from former /admin/addons page)                   */
/* -------------------------------------------------------------------------- */

function formatAddonPrice(addon: PlatformAddon) {
  const symbol = getCurrencySymbol(addon.currency);
  const suffix = addon.billing_type === 'monthly' ? '/mo' : ' one-time';
  return `${symbol}${Number(addon.price_amount).toFixed(2)}${suffix}`;
}

function addonStatusBadge(status: AddonPurchaseRequest['status']) {
  const map = {
    pending: { label: 'Pending review', className: 'bg-amber-500/10 text-amber-600 border-amber-500/30', Icon: Clock },
    approved: { label: 'Approved', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30', Icon: Check },
    rejected: { label: 'Rejected', className: 'bg-destructive/10 text-destructive border-destructive/30', Icon: XIcon },
    cancelled: { label: 'Cancelled', className: 'bg-muted text-muted-foreground', Icon: XIcon },
  } as const;
  const cfg = map[status] ?? map.pending;
  const Icon = cfg.Icon;
  return (
    <Badge variant="outline" className={cfg.className}>
      <Icon className="h-3 w-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

function AddonsSection({ restaurantId }: { restaurantId: string | null }) {
  const { data: catalog, isLoading: loadingCatalog } = usePlatformAddons({ publicOnly: true });
  const { data: grants, isLoading: loadingGrants } = useRestaurantAddons();
  const { data: requests, isLoading: loadingRequests } = useMyAddonRequests();

  const ownedIds = new Set((grants ?? []).map((g) => g.addon_id));
  const pendingByAddonId = new Map(
    (requests ?? []).filter((r) => r.status === 'pending').map((r) => [r.addon_id, r]),
  );

  const ownedAddons = (catalog ?? []).filter((a) => ownedIds.has(a.id));
  const availableAddons = (catalog ?? []).filter((a) => !ownedIds.has(a.id));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Puzzle className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Add-on services</h2>
          <p className="text-sm text-muted-foreground">
            Buy optional features à la carte. Requests are reviewed by the platform team and
            activated once payment is verified.
          </p>
        </div>
      </div>

      {/* Active add-ons */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">My add-ons</h3>
        {loadingGrants || loadingCatalog ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : ownedAddons.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Sparkles className="h-7 w-7 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No active add-ons yet. Browse the marketplace below.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {ownedAddons.map((addon) => {
              const grant = grants!.find((g) => g.addon_id === addon.id)!;
              return (
                <Card key={addon.id} className="border-emerald-500/30">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        {addon.name}
                        {Math.max(1, grant.quantity ?? 1) > 1 && (
                          <Badge variant="secondary" className="text-[10px] font-mono">
                            × {grant.quantity}
                          </Badge>
                        )}
                      </CardTitle>
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                        <Check className="h-3 w-3 mr-1" /> Active
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {addon.description && (
                      <p className="text-muted-foreground">{addon.description}</p>
                    )}
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground pt-2 border-t">
                      <span>Source: <span className="capitalize text-foreground">{grant.source}</span></span>
                      <span>Since: <span className="text-foreground">{format(new Date(grant.starts_at), 'MMM d, yyyy')}</span></span>
                      {grant.expires_at && (
                        <span>Expires: <span className="text-foreground">{format(new Date(grant.expires_at), 'MMM d, yyyy')}</span></span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Marketplace */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Marketplace</h3>
        {loadingCatalog ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : availableAddons.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <p className="text-sm text-muted-foreground">
                {(catalog ?? []).length === 0
                  ? 'No add-ons available right now. Check back soon.'
                  : 'You already have every available add-on. Nice!'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {availableAddons.map((addon) => (
              <AddonMarketplaceCard
                key={addon.id}
                addon={addon}
                pendingRequest={pendingByAddonId.get(addon.id)}
                restaurantId={restaurantId}
              />
            ))}
          </div>
        )}
      </div>

      {/* Requests history */}
      {(requests ?? []).length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">My requests</h3>
          {loadingRequests || loadingCatalog ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-3">
              {requests!.map((req) => {
                const addon = (catalog ?? []).find((a) => a.id === req.addon_id);
                return (
                  <Card key={req.id}>
                    <CardContent className="py-4 flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium">{addon?.name ?? 'Add-on'}</h4>
                          {addonStatusBadge(req.status)}
                          {Math.max(1, (req as any).quantity ?? 1) > 1 && (
                            <Badge variant="outline" className="text-[10px] font-mono">
                              × {(req as any).quantity}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requested {format(new Date(req.created_at), 'MMM d, yyyy')}
                          {req.payment_reference && ` • Ref: ${req.payment_reference}`}
                        </p>
                        {req.admin_notes && (
                          <p className="text-xs mt-2 p-2 rounded bg-muted/50 text-muted-foreground">
                            <span className="font-medium text-foreground">Admin note: </span>
                            {req.admin_notes}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold">
                          {getCurrencySymbol(req.currency)}{Number(req.amount).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {req.billing_type === 'monthly' ? 'Monthly' : 'One-time'}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface MarketplaceCardProps {
  addon: PlatformAddon;
  pendingRequest: AddonPurchaseRequest | undefined;
  restaurantId: string | null;
}

function AddonMarketplaceCard({ addon, pendingRequest, restaurantId }: MarketplaceCardProps) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // Mobile-banking providers (shared with plan checkout).
  const { data: providers = [] } = useQuery({
    queryKey: ['mobile-payment-providers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('mobile_payment_settings').select('*').order('sort_order', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MobilePaymentProvider[];
    },
  });
  const enabledProviders = useMemo(
    () => providers.filter((p) => p.is_enabled && p.receiver_number),
    [providers],
  );

  const [activeProvider, setActiveProvider] = useState<MobilePaymentProvider | null>(null);
  // Coupon state — separate from plan coupons (uses addon_coupons table).
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{
    coupon_id: string; code: string; description: string | null;
    discount_type: string; discount_value: number;
    discount_amount: number; final_amount: number;
  } | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Stable per-dialog submission reference. Reused on retry so a failed
  // network call followed by "Try again" can never create a duplicate
  // request on the platform side.
  const [submissionRef, setSubmissionRef] = useState<string | null>(null);
  // Quantity selected for this purchase. Locked to 1 when the catalog
  // entry doesn't allow multiples.
  const [quantity, setQuantity] = useState<number>(1);

  const unitAmount = Number(addon.price_amount);
  // Effective subtotal scales with the chosen quantity so the coupon
  // validation, displayed total, and final charge all stay in sync.
  const baseAmount = unitAmount * Math.max(1, quantity);
  const finalAmount = appliedCoupon ? appliedCoupon.final_amount : baseAmount;

  // Pick a default provider when the dialog opens.
  useEffect(() => {
    if (open && !activeProvider && enabledProviders.length > 0) {
      setActiveProvider(enabledProviders[0]);
    }
  }, [open, activeProvider, enabledProviders]);

  // Reset coupon state when dialog closes.
  useEffect(() => {
    if (!open) {
      setAppliedCoupon(null);
      setCouponInput('');
      setCouponError(null);
      setSubmitError(null);
      setSubmissionRef(null);
      setQuantity(1);
    }
  }, [open]);

  // If the buyer changes quantity after applying a coupon, drop the coupon
  // since the discounted total no longer matches the new subtotal.
  useEffect(() => {
    if (appliedCoupon) {
      setAppliedCoupon(null);
      setCouponError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantity]);

  const validateCoupon = async () => {
    if (!couponInput.trim()) return;
    setValidatingCoupon(true);
    setCouponError(null);
    try {
      const { data, error } = await (supabase as any).rpc('validate_addon_coupon', {
        _code: couponInput.trim(),
        _addon_id: addon.id,
        _billing_type: addon.billing_type,
        _amount: baseAmount,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.valid) {
        setCouponError(row?.reason || 'Invalid coupon');
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          coupon_id: row.coupon_id,
          code: row.code,
          description: row.description,
          discount_type: row.discount_type,
          discount_value: Number(row.discount_value),
          discount_amount: Number(row.discount_amount),
          final_amount: Number(row.final_amount),
        });
        toast.success(`Coupon applied — saved ${getCurrencySymbol(addon.currency)}${Number(row.discount_amount).toLocaleString()}`);
      }
    } catch (e: any) {
      setCouponError(e?.message || 'Failed to validate coupon');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponInput('');
    setCouponError(null);
  };

  const copyNumber = () => {
    if (!activeProvider?.receiver_number) return;
    navigator.clipboard.writeText(activeProvider.receiver_number);
    toast.success(`${activeProvider.display_name} number copied`);
  };

  const openCheckout = () => {
    if (enabledProviders.length === 0) {
      toast.error('No mobile payment method is configured yet. Please contact support.');
      return;
    }
    // Reset quantity to 1 each time the dialog opens so prior selections
    // from a closed/reopened dialog don't leak into a fresh purchase.
    setQuantity(1);
    const provider = enabledProviders[0];
    setActiveProvider(provider);
    const prefix = provider.reference_prefix || 'ADDON';
    const tenant = (restaurantId ?? 'XXXXXXXX').slice(0, 8).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    setSubmissionRef(`${prefix}-${tenant}-${Date.now().toString(36).toUpperCase()}${rand}`);
    setOpen(true);
  };

  const submitPayment = async (form: { sender_number: string; transaction_id: string; notes?: string }) => {
    if (!restaurantId || !activeProvider) {
      toast.error('Missing data');
      return;
    }
    // Defensive validation — block submission if the chosen quantity is
    // missing, non-integer, below 1, or above the configured cap. This
    // mirrors the inline UI error and protects against any UI bypass.
    if (addon.allow_multiple) {
      const q = quantity;
      const cap = addon.max_quantity ?? null;
      let qErr: string | null = null;
      if (!Number.isFinite(q) || !Number.isInteger(q)) qErr = 'Quantity must be a whole number.';
      else if (q < 1) qErr = 'Quantity must be at least 1.';
      else if (cap != null && q > cap) qErr = `Quantity can’t exceed ${cap}.`;
      if (qErr) {
        setSubmitError(qErr);
        toast.error('Invalid quantity', { description: qErr });
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Reuse the dialog-scoped reference across retries so duplicate
      // submissions share an identifier instead of producing fresh ones.
      const referenceCode = submissionRef
        ?? `${activeProvider.reference_prefix || 'ADDON'}-${restaurantId.slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
      const { error } = await (supabase as any).from('addon_purchase_requests').insert({
        restaurant_id: restaurantId,
        addon_id: addon.id,
        requested_by: user?.id ?? null,
        amount: finalAmount,
        original_amount: baseAmount,
        discount_amount: appliedCoupon ? appliedCoupon.discount_amount : 0,
        addon_coupon_id: appliedCoupon ? appliedCoupon.coupon_id : null,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        currency: addon.currency,
        billing_type: addon.billing_type,
        quantity: Math.max(1, quantity),
        payment_method: activeProvider.provider,
        sender_number: form.sender_number,
        transaction_id: form.transaction_id,
        reference_code: referenceCode,
        notes: form.notes || null,
        status: 'pending',
      });
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('duplicate') || msg.includes('unique')) {
          throw new Error('This Transaction ID has already been submitted.');
        }
        throw error;
      }
      toast.success('Payment submitted! Platform team will verify within 24 hours.');
      await queryClient.invalidateQueries({ queryKey: ['addon-requests', 'mine'] });
      setOpen(false);
      setActiveProvider(null);
    } catch (err: any) {
      const msg = String(err?.message || 'Failed to submit payment. Please try again.');
      setSubmitError(msg);
      toast.error('Failed to submit payment', { description: msg });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{addon.name}</CardTitle>
          {addon.badge && (
            <Badge variant="secondary" className="text-[10px]">{addon.badge}</Badge>
          )}
        </div>
        <div className="text-xl font-bold text-primary mt-1">
          {formatAddonPrice(addon)}
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <p className="text-sm text-muted-foreground flex-1">
          {addon.description || 'Optional service add-on.'}
        </p>
        {pendingRequest ? (
          <Button variant="outline" disabled className="w-full">
            <Clock className="h-4 w-4 mr-2" /> Request pending
          </Button>
        ) : (
          <>
            <Button onClick={openCheckout} className="w-full">
              <ShoppingBag className="h-4 w-4 mr-2" /> Buy add-on
            </Button>
            <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setActiveProvider(null); }}>
              <CheckoutDialogContent
                activeProvider={activeProvider}
                enabledProviders={enabledProviders}
                setActiveProvider={setActiveProvider}
                headerTitle={<>Buying <strong>{addon.name}</strong></>}
                headerMeta={`${formatAddonPrice(addon)} · ${addon.billing_type === 'monthly' ? 'monthly' : 'one-time'}`}
                copyNumber={copyNumber}
                showCoupon={baseAmount > 0}
                couponCurrency={addon.currency}
                baseAmount={baseAmount}
                finalAmount={finalAmount}
                appliedCoupon={appliedCoupon}
                couponInput={couponInput}
                setCouponInput={setCouponInput}
                setCouponError={setCouponError}
                couponError={couponError}
                validateCoupon={validateCoupon}
                validatingCoupon={validatingCoupon}
                removeCoupon={removeCoupon}
                couponPlaceholder="ADDON20"
                onSubmitPayment={submitPayment}
                submitting={submitting}
                submitError={submitError}
                clearSubmitError={() => setSubmitError(null)}
                quantity={addon.allow_multiple ? quantity : undefined}
                setQuantity={addon.allow_multiple ? setQuantity : undefined}
                maxQuantity={addon.allow_multiple ? addon.max_quantity ?? null : null}
                unitAmount={addon.allow_multiple ? unitAmount : undefined}
              />
            </Dialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
