import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertCircle, ArrowRight, LifeBuoy, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useAuth } from '@/hooks/useAuth';
import { Helmet } from 'react-helmet-async';

/**
 * Full-page block shown when the active restaurant's paid subscription has
 * lapsed. Funnels the owner toward renewal — admin features remain locked
 * until the platform admin reactivates the plan.
 */
export default function SubscriptionExpiredPage() {
  const { data: status } = useSubscriptionStatus();
  const { data: restaurant } = useCurrentRestaurant();
  const { signOut } = useAuth();

  const expiredOn =
    status?.currentPeriodEnd
      ? format(new Date(status.currentPeriodEnd), 'MMMM d, yyyy')
      : null;

  return (
    <>
      <Helmet>
        <title>Subscription expired — renew to continue</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <main className="min-h-screen flex items-center justify-center bg-background px-4 py-12">
        <Card className="w-full max-w-xl border-destructive/30 shadow-lg">
          <CardContent className="p-8 sm:p-10 space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                <AlertCircle className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  Subscription
                </p>
                <h1 className="text-2xl font-semibold text-foreground">
                  Your subscription has expired
                </h1>
              </div>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
              <p>
                {restaurant?.name ? (
                  <>
                    <strong className="text-foreground">{restaurant.name}</strong>'s
                    {' '}
                  </>
                ) : (
                  'Your '
                )}
                <span className="capitalize">{status?.plan ?? 'paid'}</span> plan
                {expiredOn ? <> ended on <strong className="text-foreground">{expiredOn}</strong>.</> : ' has ended.'}
              </p>
              <p>
                Admin features are paused until the subscription is renewed.
                Place a new payment to restore full access — your data, menu,
                and settings remain safe.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm space-y-1.5">
              <p className="font-medium text-foreground">What happens next?</p>
              <ul className="list-disc pl-5 text-muted-foreground space-y-1">
                <li>Submit a renewal payment from the subscription page.</li>
                <li>Once an admin approves it, your plan reactivates instantly.</li>
                <li>You'll be redirected back to the dashboard automatically.</li>
              </ul>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild size="lg" className="flex-1 gap-2">
                <Link to="/admin/subscription">
                  Renew subscription
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="gap-2">
                <Link to="/contact">
                  <LifeBuoy className="h-4 w-4" />
                  Contact support
                </Link>
              </Button>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
              <Link to="/" className="hover:text-foreground transition-colors">
                ← Back to website
              </Link>
              <button
                type="button"
                onClick={() => signOut()}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                <LogOut className="h-3 w-3" />
                Sign out
              </button>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}