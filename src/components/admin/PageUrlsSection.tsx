import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { Restaurant } from '@/hooks/useCurrentRestaurant';
import { PAGE_KEYS, DEFAULT_PAGE_PATHS, type PageKey } from '@/hooks/usePageSlugs';
import { invalidateSitemap } from '@/lib/sitemapInvalidate';

interface Props {
  restaurant: Restaurant;
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const PAGE_LABELS: Record<PageKey, string> = {
  menu: 'Menu page',
  about: 'About page',
  gallery: 'Gallery page',
  contact: 'Contact page',
};

/**
 * Lets restaurant admins rename their public static page URLs while keeping the
 * originals working. Persisted to `restaurants.page_slugs` (JSONB).
 */
export default function PageUrlsSection({ restaurant }: Props) {
  const qc = useQueryClient();
  const initial = ((restaurant as any).page_slugs ?? {}) as Partial<Record<PageKey, string>>;
  const [slugs, setSlugs] = useState<Record<PageKey, string>>({
    menu: initial.menu ?? '',
    about: initial.about ?? '',
    gallery: initial.gallery ?? '',
    contact: initial.contact ?? '',
  });

  useEffect(() => {
    const next = ((restaurant as any).page_slugs ?? {}) as Partial<Record<PageKey, string>>;
    setSlugs({
      menu: next.menu ?? '',
      about: next.about ?? '',
      gallery: next.gallery ?? '',
      contact: next.contact ?? '',
    });
  }, [restaurant]);

  const save = useMutation({
    mutationFn: async () => {
      const cleaned: Record<string, string> = {};
      for (const key of PAGE_KEYS) {
        const val = slugs[key].trim().toLowerCase();
        if (!val) continue;
        if (!SLUG_RE.test(val) || val.length > 80) {
          throw new Error(`"${val}" is not a valid slug — use lowercase letters, numbers and hyphens.`);
        }
        if ((['menu', 'about', 'gallery', 'contact', 'admin', 'platform', 'auth', 'kitchen', 'waiter', 'orders', 'order', 'profile', 'r', 'table', 'login', 'signup'] as string[]).includes(val)) {
          if (val !== DEFAULT_PAGE_PATHS[key]) {
            throw new Error(`"${val}" is reserved — please choose a different slug.`);
          }
        }
        cleaned[key] = val;
      }
      const seen = new Set<string>();
      for (const v of Object.values(cleaned)) {
        if (seen.has(v)) throw new Error(`Duplicate slug "${v}" — each page needs a unique URL.`);
        seen.add(v);
      }
      const { error } = await supabase
        .from('restaurants')
        .update({ page_slugs: cleaned } as any)
        .eq('id', restaurant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-restaurant'] });
      qc.invalidateQueries({ queryKey: ['custom-domain-restaurant'] });
      toast.success('Page URLs saved');

      // Page slugs feed the public sitemap — refresh the edge cache so
      // crawlers see the new URLs on the next hit. Show feedback toast.
      toast.promise(invalidateSitemap(), {
        loading: 'Refreshing sitemap cache...',
        success: 'Sitemap cache refreshed — new URLs will be picked up by crawlers',
        error: (err: any) => `Sitemap refresh failed: ${err?.message || String(err)}`,
      });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-card-foreground">Page URLs</h2>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">
        Give your public pages friendlier URLs (only active on your custom domain). The originals (e.g. <code>/menu</code>) keep working alongside the new ones.
      </p>

      <div className="grid gap-3">
        {PAGE_KEYS.map(key => (
          <div key={key} className="grid grid-cols-[140px_1fr] items-center gap-3">
            <Label className="text-sm text-muted-foreground">{PAGE_LABELS[key]}</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground shrink-0">/</span>
              <Input
                placeholder={DEFAULT_PAGE_PATHS[key]}
                value={slugs[key]}
                maxLength={80}
                onChange={e => setSlugs(p => ({ ...p, [key]: e.target.value }))}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending} className="gap-1.5">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" strokeWidth={1.5} />}
          Save URLs
        </Button>
      </div>
    </section>
  );
}
