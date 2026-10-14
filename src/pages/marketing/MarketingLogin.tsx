import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2, ArrowRight } from 'lucide-react';
import PlatformLogo from '@/components/marketing/PlatformLogo';
import { motion } from 'framer-motion';
import { useAuth, type AppRole } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import MarketingSEO from '@/components/marketing/MarketingSEO';
import FaviconInjector from '@/components/marketing/FaviconInjector';
import LogoPreloader from '@/components/marketing/LogoPreloader';
import { supabase } from '@/integrations/supabase/client';

function dashboardForRoles(roles: AppRole[]): string {
  if (roles.includes('owner')) return '/owner';
  if (roles.includes('admin') || roles.includes('manager')) return '/admin';
  if (roles.includes('kitchen')) return '/kitchen';
  if (roles.includes('waiter') || roles.includes('server')) return '/waiter';
  return '/account';
}

export default function MarketingLogin() {
  const { signIn, user, roles, loading: authLoading, getDashboardPath } = useAuth();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next');
  const ownerDestination = next?.startsWith('/owner/onboarding?') || next === '/owner/onboarding'
    ? next : null;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (authLoading || platformLoading || !user) return;
    if (isPlatformAdmin) { navigate('/platform', { replace: true }); return; }
    if (roles.length > 0) navigate(roles.includes('owner') && ownerDestination ? ownerDestination : getDashboardPath(), { replace: true });
  }, [user, roles, authLoading, platformLoading, isPlatformAdmin, navigate, getDashboardPath, ownerDestination]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);

      // Resolve destination immediately instead of waiting for context to update.
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user.id;
      if (!uid) throw new Error('Sign-in succeeded but no session was created');

      const [{ data: roleRows }, { data: isAdmin }] = await Promise.all([
        supabase.from('user_roles').select('role').eq('user_id', uid),
        supabase.rpc('is_platform_admin'),
      ]);

      toast.success('Welcome back');

      if (isAdmin === true) {
        navigate('/platform', { replace: true });
        return;
      }
      const userRoles = (roleRows ?? []).map(r => r.role as AppRole);
      navigate(userRoles.includes('owner') && ownerDestination ? ownerDestination : dashboardForRoles(userRoles), { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased relative overflow-hidden">
      <FaviconInjector />
      <LogoPreloader />
      <MarketingSEO
        title="Sign in"
        description="Sign in to your ServeOS account to manage your restaurant — orders, kitchen display, billing, and analytics in one place."
        canonical="/login"
        noindex
      />
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="min-h-screen flex flex-col">
        {/* Top brand strip */}
        <div className="px-6 py-6 lg:px-10">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <PlatformLogo size={36} />
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <div className="text-center mb-8">
              <h1 className="text-3xl font-semibold tracking-tight">Welcome back</h1>
              <p className="mt-2 text-sm text-muted-foreground">Sign in to your ServeOS account</p>
            </div>

            <div className="rounded-2xl border border-border/60 bg-card shadow-xl shadow-primary/5 p-7">
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@restaurant.com" required />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <Link to="/forgot-password" className="text-xs text-primary hover:underline">Forgot?</Link>
                  </div>
                  <Input id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                </div>
                <Button type="submit" size="lg" className="w-full gap-2" disabled={submitting}>
                  {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
                </Button>
              </form>
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              New to ServeOS?{' '}
              <Link to="/signup" className="text-primary font-medium hover:underline">Create an account</Link>
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
