import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import type { AppRole } from '@/hooks/useAuth';

const STAFF_ROLES: AppRole[] = ['owner', 'admin', 'manager', 'kitchen', 'waiter', 'server'];

export default function StaffLoginPage() {
  const { signIn, signOut, user, roles, loading: authLoading, getDashboardPath } = useAuth();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const { restaurant } = useResolvedRestaurant();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [wrongPage, setWrongPage] = useState(false);

  const redirectTo = searchParams.get('redirect');
  const resolveDest = () => {
    if (redirectTo) return redirectTo;
    if (roles.includes('kitchen')) return '/kitchen';
    if (roles.includes('waiter') || roles.includes('server')) return '/waiter';
    if (roles.includes('admin') || roles.includes('manager')) return '/admin';
    if (roles.includes('owner')) return '/owner';
    return getDashboardPath();
  };

  useEffect(() => {
    if (authLoading || platformLoading || !user) return;
    if (isPlatformAdmin) {
      navigate('/platform', { replace: true });
      return;
    }
    if (roles.length === 0) return;
    const isStaff = roles.some(r => STAFF_ROLES.includes(r));
    if (isStaff) {
      navigate(resolveDest(), { replace: true });
    } else {
      setWrongPage(true);
    }
  }, [user, roles, authLoading, platformLoading, isPlatformAdmin, navigate, getDashboardPath, redirectTo]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    setWrongPage(false);
    try {
      await signIn(email.trim(), password);
      toast.success('Signed in');
    } catch (err: any) {
      toast.error(err.message || 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOutAndRedirect = async () => {
    await signOut();
    setWrongPage(false);
    navigate(restaurant?.slug ? `/r/${restaurant.slug}/login` : '/auth', { replace: true });
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Helmet>
        <title>{restaurant?.name ? `${restaurant.name} — Staff sign in` : 'Staff sign in'}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>
      <div className="w-full max-w-sm animate-scale-in">
        <div className="card-shadow ring-subtle rounded-lg bg-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-card-foreground">
                {restaurant?.name ? `${restaurant.name} — Staff` : 'Staff sign in'}
              </h1>
              <p className="text-sm text-muted-foreground">Admin, kitchen & waiter access</p>
            </div>
          </div>

          {wrongPage && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p>This page is for restaurant staff only. Your account is a customer account.</p>
                <Button size="sm" variant="outline" className="w-full" onClick={handleSignOutAndRedirect}>
                  Go to customer sign in
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="label-ui">Email</Label>
              <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@restaurant.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="label-ui">Password</Label>
              <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Signing in…</> : 'Sign In'}
            </Button>
            <div className="text-center">
              <Link to="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Forgot your password?
              </Link>
            </div>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Staff accounts are created by your restaurant owner.
          </p>
        </div>
      </div>
    </div>
  );
}
