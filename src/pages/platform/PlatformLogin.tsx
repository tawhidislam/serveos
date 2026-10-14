import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { usePlatformAdmin } from '@/hooks/usePlatformAdmin';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Shield, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Dedicated login page for platform super-admins.
 * Verifies the email is on the platform_admins allowlist before redirecting.
 * Non-platform users are signed out and shown an error.
 */
export default function PlatformLogin() {
  const { signIn, user, loading: authLoading } = useAuth();
  const { isPlatformAdmin, loading: platformLoading } = usePlatformAdmin();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If a verified platform admin lands here while logged in → go straight in
  useEffect(() => {
    if (authLoading || platformLoading || !user) return;
    if (isPlatformAdmin) {
      navigate('/platform', { replace: true });
    }
  }, [authLoading, platformLoading, user, isPlatformAdmin, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      // Re-check platform admin status server-side after sign-in
      const { data: isAdmin } = await supabase.rpc('is_platform_admin');
      if (isAdmin === true) {
        toast.success('Welcome back, super-admin');
        navigate('/platform', { replace: true });
      } else {
        await supabase.auth.signOut();
        toast.error('This account is not authorized for platform access');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Sign-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle gold glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />

      <Card className="w-full max-w-md p-8 relative z-10 border-border/50 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mb-4 shadow-lg">
            <Shield className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform Console</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Super-admin access only
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={submitting || authLoading}
          >
            {submitting ? 'Verifying…' : (
              <>
                Sign in <ArrowRight className="h-4 w-4 ml-1.5" />
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-border/50 text-center">
          <p className="text-xs text-muted-foreground">
            Tenant owner or staff?{' '}
            <a href="/auth" className="text-primary hover:underline">
              Sign in here
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
}
