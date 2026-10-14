import { edgeFunctionError } from '@/lib/edge-function-error';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, Store, ArrowRight, Globe } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import MarketingSEO from '@/components/marketing/MarketingSEO';

import {
  getPlatformRootDomain,
  isSubdomainTenancyEnabled,
} from '@/lib/tenant-host';

export default function RestaurantSignupPage() {
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState('');
  const [ownerDisplayName, setOwnerDisplayName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const rootDomain = getPlatformRootDomain();
  const subdomainEnabled = isSubdomainTenancyEnabled();

  // Auto-derived preview slug — server picks the final value (with -2/-3 on collision).
  const previewSlug = useMemo(
    () => slugify(restaurantName) || 'your-restaurant',
    [restaurantName],
  );

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('restaurant-signup', {
        body: {
          restaurantName: restaurantName.trim(),
          ownerEmail: ownerEmail.trim(),
          ownerPassword,
          ownerDisplayName: ownerDisplayName.trim() || undefined,
        },
      });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);

      toast.success(
        `Created at ${data.restaurant?.slug ?? previewSlug}! Signing you in…`,
      );

      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: ownerEmail.trim(),
        password: ownerPassword,
      });
      if (signInErr) {
        navigate('/auth');
        return;
      }
      navigate('/owner/onboarding', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <MarketingSEO
        title="Start your restaurant"
        description="Create your restaurant account and get an instant storefront, QR ordering, kitchen display and POS — no credit card required."
        canonical="/signup-restaurant"
        noindex
      />

      <Card className="w-full max-w-lg p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Store className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Start your restaurant</h1>
          <p className="text-sm text-muted-foreground">
            Free plan — no credit card required. Upgrade anytime.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="rname">Restaurant name</Label>
            <Input
              id="rname"
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Bella's Bistro"
              required
              maxLength={80}
            />
            <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 px-3 py-2 text-sm">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">Your store will be live at</span>
              <span className="font-medium text-foreground truncate">
                {subdomainEnabled && rootDomain
                  ? `${previewSlug}.${rootDomain}`
                  : `/r/${previewSlug}/menu`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              We'll auto-assign your subdomain so it works instantly. You can rename it later from the Domain settings.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dname">Your name</Label>
              <Input
                id="dname"
                value={ownerDisplayName}
                onChange={(e) => setOwnerDisplayName(e.target.value)}
                placeholder="Jane Doe"
                maxLength={80}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
                placeholder="you@restaurant.com"
                required
                maxLength={120}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={ownerPassword}
              onChange={(e) => setOwnerPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              maxLength={72}
            />
          </div>

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating restaurant…
              </>
            ) : (
              <>
                Create restaurant
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link to="/auth" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
