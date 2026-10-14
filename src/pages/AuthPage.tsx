import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UtensilsCrossed, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/hooks/useAuth';

const STAFF_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server'];

// Supabase functions.invoke surfaces only "Edge Function returned a non-2xx status code"
// for HTTP errors. Read the response body to recover the actual error message.
async function extractFnError(error: any, data: any): Promise<string | null> {
  if (data?.error) return data.error;
  if (!error) return null;
  try {
    const ctx = error.context;
    if (ctx && typeof ctx.json === 'function') {
      const body = await ctx.clone().json();
      if (body?.error) return body.error;
    }
    if (ctx && typeof ctx.text === 'function') {
      const txt = await ctx.clone().text();
      if (txt) return txt;
    }
  } catch { /* ignore */ }
  return error.message ?? 'Request failed';
}

export default function AuthPage() {
  const { signOut, user, roles, loading: authLoading, getDashboardPath } = useAuth();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const { restaurant, restaurantId, isLoading: restaurantLoading } = useResolvedRestaurant();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect');
  const isSignupRoute = location.pathname.endsWith('/signup');
  const [isLogin, setIsLogin] = useState(!isSignupRoute);
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [wrongPage, setWrongPage] = useState(false);

  useEffect(() => {
    if (authLoading || platformLoading || !user) return;
    if (isPlatformAdmin) {
      setWrongPage(true);
      return;
    }
    if (roles.length === 0) return;
    const isStaff = roles.some(r => STAFF_ROLES.includes(r));
    if (isStaff) {
      setWrongPage(true);
    } else {
      const customerDest = restaurant?.slug ? `/r/${restaurant.slug}/account` : getDashboardPath();
      navigate(redirectTo || customerDest, { replace: true });
    }
  }, [user, roles, authLoading, platformLoading, isPlatformAdmin, navigate, getDashboardPath, redirectTo, restaurant]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    if (!restaurantId) {
      toast.error('No restaurant context — please open a restaurant page first.');
      return;
    }
    setLoading(true);
    setWrongPage(false);
    try {
      if (isLogin) {
        // Resolve namespaced auth email for this restaurant + email
        const { data, error } = await supabase.functions.invoke('customer-signin', {
          body: { restaurantId, email: email.trim() },
        });
        const errMsg = await extractFnError(error, data);
        if (errMsg) throw new Error(errMsg);
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: data.namespacedEmail,
          password,
        });
        if (siErr) throw siErr;
        toast.success('Signed in');
      } else {
        const { data, error } = await supabase.functions.invoke('customer-signup', {
          body: {
            restaurantId,
            email: email.trim(),
            password,
            displayName: displayName.trim() || undefined,
            phone: phone.trim() || undefined,
          },
        });
        const errMsg = await extractFnError(error, data);
        if (errMsg) throw new Error(errMsg);
        const { error: siErr } = await supabase.auth.signInWithPassword({
          email: data.namespacedEmail,
          password,
        });
        if (siErr) throw siErr;
        toast.success(`Welcome to ${restaurant?.name ?? 'your account'}!`);
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOutAndRedirect = async () => {
    await signOut();
    setWrongPage(false);
    navigate('/staff-login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-scale-in">
        <div className="card-shadow ring-subtle rounded-lg bg-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <UtensilsCrossed className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-card-foreground">
                {restaurant?.name ?? 'Welcome'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {isLogin ? 'Sign in to order' : 'Create your customer account'}
              </p>
            </div>
          </div>

          {wrongPage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>This is the customer sign-in page. Your account is a staff/admin account.</p>
                <Button size="sm" variant="outline" className="w-full" onClick={handleSignOutAndRedirect}>
                  Go to staff sign in
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!restaurantLoading && !restaurantId && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                No restaurant detected. Please open this page from a restaurant URL (e.g. <code>/r/your-restaurant</code>).
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name" className="label-ui">Name</Label>
                  <Input id="name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your name" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="label-ui">Phone (optional)</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880…" />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="email" className="label-ui">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="label-ui">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !restaurantId}>
              {loading ? 'Loading...' : isLogin ? 'Sign In' : 'Create Account'}
            </Button>
            {isLogin && (
              <div className="text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Forgot your password?
                </Link>
              </div>
            )}
          </form>

          <div className="mt-6 text-center">
            <Link
              to={restaurant?.slug ? `/r/${restaurant.slug}/${isLogin ? 'signup' : 'login'}` : (isLogin ? '/signup' : '/auth')}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors block w-full"
            >
              {isLogin ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
