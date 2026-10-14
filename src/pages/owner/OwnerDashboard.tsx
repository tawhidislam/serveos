import FreeTrialBanner from '@/components/admin/FreeTrialBanner';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Store, Users, Building2, ExternalLink, Settings, LogOut, ShoppingBag, Copy, Check, Globe } from 'lucide-react';
import { buildTenantUrl, getTenantOrigin, isSubdomainTenancyEnabled } from '@/lib/tenant-host';
import { toast } from 'sonner';

export default function OwnerDashboard() {
  const { user, signOut, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { data: restaurant, isLoading } = useCurrentRestaurant();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  // Redirect to onboarding wizard if the tenant hasn't completed setup yet
  useEffect(() => {
    if (restaurant && (restaurant as { onboarding_completed?: boolean }).onboarding_completed === false) {
      navigate('/owner/onboarding', { replace: true });
    }
  }, [restaurant, navigate]);

  // Stats for the owner
  const { data: stats } = useQuery({
    queryKey: ['owner-stats', restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const [branches, members, orders] = await Promise.all([
        supabase.from('branches').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant!.id),
        supabase.from('restaurant_members').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant!.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('restaurant_id', restaurant!.id),
      ]);
      return {
        branches: branches.count ?? 0,
        members: members.count ?? 0,
        orders: orders.count ?? 0,
      };
    },
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No restaurant linked</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to a restaurant yet.
            </p>
            <Button asChild className="w-full">
              <Link to="/signup">Create a restaurant</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // URL resolution priority: verified custom domain > subdomain > /r/:slug fallback
  const customDomainUrl =
    restaurant.custom_domain && restaurant.custom_domain_verified
      ? `https://${restaurant.custom_domain}`
      : null;
  const subdomainOrigin = getTenantOrigin(restaurant.slug);
  const homeUrl = customDomainUrl ?? subdomainOrigin ?? buildTenantUrl(restaurant.slug, '/');
  const menuUrl = customDomainUrl
    ? `${customDomainUrl}/menu`
    : subdomainOrigin
      ? `${subdomainOrigin}/menu`
      : buildTenantUrl(restaurant.slug, '/menu');
  const adminUrl = subdomainOrigin ? `${subdomainOrigin}/admin` : `${window.location.origin}/admin`;
  const subdomainEnabled = isSubdomainTenancyEnabled();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Store className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">{restaurant.name}</h1>
              <p className="text-xs text-muted-foreground">
                {subdomainEnabled && subdomainOrigin
                  ? subdomainOrigin.replace(/^https?:\/\//, '')
                  : `/r/${restaurant.slug}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin"><Settings className="h-4 w-4 mr-1.5" />Admin</Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => navigate('/auth'))}>
              <LogOut className="h-4 w-4 mr-1.5" />Sign out
            </Button>
          </div>
        </div>
      </header>
      <FreeTrialBanner />

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Public URLs — Shopify-style "Your store URL" card */}
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-primary" />
                <h2 className="text-base font-semibold">Your store URL</h2>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/owner/domain">Manage domain</Link>
              </Button>
            </div>

            <UrlRow label="Storefront homepage" url={homeUrl} primary />
            <UrlRow label="Public ordering menu" url={menuUrl} />
            {subdomainEnabled && <UrlRow label="Admin dashboard" url={adminUrl} muted />}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.branches ?? 0}</p>
                <p className="text-xs text-muted-foreground">Branches</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.members ?? 0}</p>
                <p className="text-xs text-muted-foreground">Team members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-semibold">{stats?.orders ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total orders</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link to="/admin/menu">
                <div className="text-left">
                  <p className="font-medium">Manage menu</p>
                  <p className="text-xs text-muted-foreground">Add categories & items</p>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link to="/admin/staff">
                <div className="text-left">
                  <p className="font-medium">Invite staff</p>
                  <p className="text-xs text-muted-foreground">Add managers, kitchen, waiters</p>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link to="/admin/branches">
                <div className="text-left">
                  <p className="font-medium">Branches</p>
                  <p className="text-xs text-muted-foreground">Manage locations</p>
                </div>
              </Link>
            </Button>
            <Button variant="outline" className="justify-start h-auto py-3" asChild>
              <Link to="/admin/settings">
                <div className="text-left">
                  <p className="font-medium">Settings</p>
                  <p className="text-xs text-muted-foreground">Branding, tax, currency</p>
                </div>
              </Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function UrlRow({ label, url, primary, muted }: { label: string; url: string; primary?: boolean; muted?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
        primary ? '' : 'border-t border-primary/10 pt-4'
      } ${muted ? 'opacity-80' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium mb-1">{label}</p>
        <p className="text-xs text-muted-foreground break-all font-mono">{url}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button asChild variant={primary ? 'default' : 'outline'} size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            Open <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          </a>
        </Button>
      </div>
    </div>
  );
}
