import { edgeFunctionError } from '@/lib/edge-function-error';
import { useState, FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight, Check } from 'lucide-react';
import PlatformLogo from '@/components/marketing/PlatformLogo';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import MarketingSEO from '@/components/marketing/MarketingSEO';
import FaviconInjector from '@/components/marketing/FaviconInjector';
import LogoPreloader from '@/components/marketing/LogoPreloader';

export default function MarketingSignup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // When the user lands here from the public pricing page with a chosen plan,
  // we forward those params to the in-app subscription page after signup so
  // the checkout dialog opens automatically — no extra clicks to pay.
  const intendedPlan = searchParams.get('plan') === 'trial' ? null : searchParams.get('plan');
  const intendedCycle = searchParams.get('cycle');
  const checkoutQuery =
    intendedPlan && intendedCycle
      ? `?plan=${encodeURIComponent(intendedPlan)}&cycle=${encodeURIComponent(intendedCycle)}`
      : '';
  const postSignupPath = `/owner/onboarding${checkoutQuery ? `?next=${encodeURIComponent(`/admin/subscription${checkoutQuery}`)}` : ''}`;
  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [ownerDisplayName, setOwnerDisplayName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onNameChange = (v: string) => {
    setRestaurantName(v);
    if (!slugTouched) setSlug(slugify(v));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('restaurant-signup', {
        body: {
          restaurantName: restaurantName.trim(),
          slug: slug.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPassword,
          ownerDisplayName: ownerDisplayName.trim() || undefined,
        },
      });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);

      toast.success('Restaurant created! Your 7-day free trial has started.');
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: ownerEmail.trim(),
        password: ownerPassword,
      });
      if (signInErr) {
        navigate(`/login${checkoutQuery ? `?next=${encodeURIComponent(postSignupPath)}` : ''}`);
        return;
      }
      navigate(postSignupPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased relative overflow-hidden">
      <FaviconInjector />
      <LogoPreloader />
      <MarketingSEO
        title="Get started — Create your restaurant account"
        description="Create your ServeOS account and get QR ordering, kitchen display, POS, billing, and analytics for your restaurant in minutes."
        canonical="/signup"
        keywords="restaurant signup, QR ordering signup, free POS, kitchen display system signup"
      />
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="min-h-screen flex flex-col">
        <div className="px-6 py-6 lg:px-10">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <PlatformLogo size={36} />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6 py-10">
          <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-10 items-center">
            {/* Left: pitch */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="hidden lg:block"
            >
              <h1 className="text-4xl xl:text-5xl font-semibold tracking-tight leading-tight">
                Start running smoother shifts <span className="text-primary">today</span>
              </h1>
              <p className="mt-5 text-base text-muted-foreground leading-relaxed">
                Create your account and have QR ordering live before your next service.
              </p>
              <ul className="mt-8 space-y-3">
                {[
                  'Pick the plan that fits your restaurant',
                  'Pay securely with mobile banking',
                  'QR ordering, KDS, POS, billing included',
                  'Upgrade or change plan anytime',
                ].map(b => (
                  <li key={b} className="flex gap-3 text-sm">
                    <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="h-3 w-3 text-primary" strokeWidth={3} />
                    </div>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* Right: form */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="w-full"
            >
              <div className="text-center mb-6 lg:hidden">
                <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
                <p className="mt-2 text-sm text-muted-foreground">Get your restaurant running in minutes</p>
              </div>

              <div className="rounded-2xl border border-border/60 bg-card shadow-xl shadow-primary/5 p-7">
                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="rname">Restaurant name</Label>
                    <Input id="rname" value={restaurantName} onChange={e => onNameChange(e.target.value)} placeholder="Bella's Bistro" required minLength={2} maxLength={80} />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="slug">Public URL</Label>
                    <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 h-10">
                      <span className="text-sm text-muted-foreground">/r/</span>
                      <input
                        id="slug"
                        value={slug}
                        onChange={e => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                        placeholder="bellas-bistro"
                        required
                        minLength={2}
                        maxLength={60}
                        className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
                      />
                      <span className="text-xs text-muted-foreground">/menu</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="dname">Your name</Label>
                      <Input id="dname" value={ownerDisplayName} onChange={e => setOwnerDisplayName(e.target.value)} placeholder="Jane Doe" maxLength={80} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" type="email" autoComplete="email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="you@restaurant.com" required maxLength={120} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" autoComplete="new-password" value={ownerPassword} onChange={e => setOwnerPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} maxLength={72} />
                  </div>

                  <Button type="submit" size="lg" className="w-full gap-2 mt-6" disabled={submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating restaurant…</> : <>Create restaurant <ArrowRight className="h-4 w-4" /></>}
                  </Button>

                  <p className="text-[11px] text-center text-muted-foreground">
                    By signing up you agree to our terms of service.
                  </p>
                </form>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <Link to="/login" className="text-primary font-medium hover:underline">Sign in</Link>
              </p>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
