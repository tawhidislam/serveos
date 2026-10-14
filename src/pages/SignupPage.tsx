import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UtensilsCrossed, Store } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';

export default function SignupPage() {
  const { signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [restaurantName, setRestaurantName] = useState('');
  const [slug, setSlug] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);

  // Auto-generate slug from restaurant name unless user typed one
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(restaurantName));
  }, [restaurantName, slugTouched]);

  // If somehow already authenticated, send them home
  useEffect(() => {
    if (!authLoading && user) navigate('/owner', { replace: true });
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantName.trim() || !slug.trim() || !email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      // 1. Verify slug is available
      const { data: existing } = await supabase
        .from('restaurants')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (existing) {
        toast.error('That URL is already taken. Please choose another.');
        setSubmitting(false);
        return;
      }

      // 2. Sign up + sign in (auto-confirm is enabled in auth config)
      await signUp(email.trim(), password, ownerName.trim() || undefined);
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInErr || !signInData.user) throw signInErr ?? new Error('Sign-in failed');
      const userId = signInData.user.id;

      // 3. Create restaurant — DB trigger handles membership, owner role, default branch
      const { data: restaurant, error: restErr } = await supabase
        .from('restaurants')
        .insert({
          name: restaurantName.trim(),
          slug: slug.trim(),
          owner_id: userId,
        })
        .select()
        .single();
      if (restErr || !restaurant) throw restErr ?? new Error('Failed to create restaurant');

      toast.success(`Welcome to ${restaurant.name}!`);
      // Force a page navigation so AuthProvider picks up the new owner role
      window.location.href = '/owner';
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-scale-in">
        <div className="card-shadow ring-subtle rounded-lg bg-card p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-card-foreground">Start your restaurant</h1>
              <p className="text-sm text-muted-foreground">Create your account & menu in minutes</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="rname" className="label-ui">Restaurant name</Label>
              <Input
                id="rname"
                value={restaurantName}
                onChange={(e) => setRestaurantName(e.target.value)}
                placeholder="Bella Trattoria"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug" className="label-ui">Public URL</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground whitespace-nowrap">/r/</span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); setSlugTouched(true); }}
                  placeholder="bella-trattoria"
                  required
                  pattern="[a-z0-9-]+"
                />
              </div>
              <p className="text-xs text-muted-foreground">Customers will order at: yoursite/r/{slug || 'your-slug'}/menu</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="oname" className="label-ui">Your name</Label>
              <Input
                id="oname"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Anna Rossi"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="label-ui">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
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
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? 'Creating your restaurant…' : 'Create restaurant'}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link to="/auth" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              <UtensilsCrossed className="inline h-3.5 w-3.5 mr-1" />
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
