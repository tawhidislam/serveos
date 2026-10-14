import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import OwnerLayout from './OwnerLayout';
import CustomDomainsSection from './CustomDomainsSection';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Globe, Loader2, AlertTriangle, Copy, Check, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { slugify } from '@/lib/slug';
import {
  getPlatformRootDomain, getTenantOrigin, isReservedSlug, isSubdomainTenancyEnabled,
} from '@/lib/tenant-host';

export default function OwnerDomain() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { data: restaurant, isLoading } = useCurrentRestaurant();
  const queryClient = useQueryClient();

  const [newSlug, setNewSlug] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const rootDomain = getPlatformRootDomain();
  const subdomainEnabled = isSubdomainTenancyEnabled();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth', { replace: true });
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (restaurant && !newSlug) setNewSlug(restaurant.slug);
  }, [restaurant, newSlug]);

  const slugError = useMemo(() => {
    if (!newSlug) return null;
    if (newSlug.length < 2) return 'Must be at least 2 characters';
    if (isReservedSlug(newSlug)) return `"${newSlug}" is reserved`;
    if (!/^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/.test(newSlug)) {
      return 'Only lowercase letters, numbers and dashes';
    }
    return null;
  }, [newSlug]);

  if (authLoading || isLoading) {
    return (
      <OwnerLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </OwnerLayout>
    );
  }

  if (!restaurant) {
    return (
      <OwnerLayout>
        <div className="p-6">
          <Card><CardContent className="p-6 text-sm text-muted-foreground">No restaurant linked.</CardContent></Card>
        </div>
      </OwnerLayout>
    );
  }

  const currentOrigin = getTenantOrigin(restaurant.slug) ?? `${window.location.origin}/r/${restaurant.slug}`;
  const previewOrigin = newSlug && !slugError && rootDomain ? `https://${newSlug}.${rootDomain}` : null;
  const slugChanged = newSlug && newSlug !== restaurant.slug && !slugError;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentOrigin);
      setCopied(true);
      toast.success('Copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('Could not copy');
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!slugChanged) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('restaurant-rename-slug', {
        body: { restaurantId: restaurant.id, newSlug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const failed = data?.failedCustomers ?? 0;
      if (failed > 0) {
        toast.warning(`Renamed, but ${failed} customer accounts could not be migrated. They may need to reset their email.`);
      } else {
        toast.success('Store URL updated');
      }

      // Refresh restaurant cache and any cached subdomain lookups.
      sessionStorage.setItem('active_restaurant_slug', newSlug);
      await queryClient.invalidateQueries({ queryKey: ['current-restaurant'] });
      await queryClient.invalidateQueries({ queryKey: ['restaurant-by-slug'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Rename failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OwnerLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Domain & store URL</h1>
          <p className="text-sm text-muted-foreground">
            Manage where your customers find your storefront.
          </p>
        </div>

        {/* Current URL */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" /> Current store URL
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 px-3 py-2 rounded-md bg-muted text-sm break-all">{currentOrigin}</code>
              <Button variant="outline" size="sm" onClick={onCopy}>
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={currentOrigin} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            </div>
            {restaurant.custom_domain && restaurant.custom_domain_verified && (
              <p className="text-xs text-muted-foreground">
                You also have a verified custom domain:{' '}
                <span className="font-medium text-foreground">{restaurant.custom_domain}</span>
              </p>
            )}
          </CardContent>
        </Card>

        {/* Rename slug */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {subdomainEnabled ? 'Change subdomain' : 'Change URL slug'}
            </CardTitle>
            <CardDescription>
              {subdomainEnabled && rootDomain
                ? `Your storefront will live at <slug>.${rootDomain}.`
                : 'Your storefront will live at /r/<slug>.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="slug">New slug</Label>
                {subdomainEnabled && rootDomain ? (
                  <div className={`flex items-center gap-1 rounded-md border bg-muted/40 px-3 ${slugError ? 'border-destructive/60' : ''}`}>
                    <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Input
                      id="slug"
                      value={newSlug}
                      onChange={(e) => setNewSlug(slugify(e.target.value))}
                      placeholder="bellas-bistro"
                      className="border-0 bg-transparent px-1 focus-visible:ring-0 min-w-0"
                    />
                    <span className="text-sm text-muted-foreground whitespace-nowrap">.{rootDomain}</span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-2 rounded-md border bg-muted/40 px-3 ${slugError ? 'border-destructive/60' : ''}`}>
                    <span className="text-sm text-muted-foreground">/r/</span>
                    <Input
                      id="slug"
                      value={newSlug}
                      onChange={(e) => setNewSlug(slugify(e.target.value))}
                      placeholder="bellas-bistro"
                      className="border-0 bg-transparent px-0 focus-visible:ring-0"
                    />
                  </div>
                )}
                {slugError && <p className="text-xs text-destructive">{slugError}</p>}
                {previewOrigin && slugChanged && (
                  <p className="text-xs text-muted-foreground">
                    New URL preview:{' '}
                    <span className="font-medium text-foreground">{previewOrigin}</span>
                  </p>
                )}
              </div>

              {slugChanged && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Heads up — this affects your customers</AlertTitle>
                  <AlertDescription className="space-y-1 text-xs">
                    <p>• Your old URL ({currentOrigin}) will stop working.</p>
                    <p>• Any printed QR codes pointing to the old URL must be reprinted.</p>
                    <p>• Existing customer accounts will be migrated automatically; a small number may need to recover their account.</p>
                  </AlertDescription>
                </Alert>
              )}

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button type="button" disabled={!slugChanged || submitting}>
                    {submitting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Renaming…</> : 'Save new URL'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Rename your store URL?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will immediately change your public URL from{' '}
                      <span className="font-medium">{currentOrigin}</span> to{' '}
                      <span className="font-medium">{previewOrigin ?? `/r/${newSlug}`}</span>.
                      This cannot be undone automatically.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onSubmit as unknown as () => void}>
                      Yes, rename
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </form>
          </CardContent>
        </Card>

        {/* Custom domains (BYO domain like restaurant.com) */}
        <CustomDomainsSection restaurantId={restaurant.id} />
      </div>
    </OwnerLayout>
  );
}
