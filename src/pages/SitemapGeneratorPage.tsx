import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useAuth } from '@/hooks/useAuth';
import { ShieldAlert } from 'lucide-react';
import {
  buildSeoExport,
  buildSitemapUrls,
  renderRobotsTxt,
  renderSeoExportCsv,
  renderSeoExportJson,
  renderSitemapXml,
  type MenuItemForSitemap,
} from '@/lib/sitemap';
import { Globe, Download, Copy, FileCode2, RefreshCw, Info, Languages, Link2 } from 'lucide-react';
import { toast } from 'sonner';

/** Pick a sensible default origin: verified custom domain → platform published URL → window.origin. */
function defaultOrigin(opts: { customDomain?: string | null; verified?: boolean }) {
  if (opts.customDomain && opts.verified) return `https://${opts.customDomain}`;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'https://example.com';
}

function downloadFile(filename: string, contents: string, mime = 'application/xml') {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function SitemapGeneratorPage() {
  const { data: restaurant, isLoading: loadingRestaurant } = useCurrentRestaurant();
  const { user, hasRole } = useAuth();

  const [origin, setOrigin] = useState<string>('');
  const [includeLegacySlug, setIncludeLegacySlug] = useState<boolean>(true);
  const [defaultLanguage, setDefaultLanguage] = useState<string>('en');
  const [additionalLanguagesRaw, setAdditionalLanguagesRaw] = useState<string>('');

  // Resolve a default origin once the restaurant loads
  const resolvedOrigin = useMemo(() => {
    if (origin) return origin.trim().replace(/\/+$/, '');
    return defaultOrigin({
      customDomain: restaurant?.custom_domain,
      verified: restaurant?.custom_domain_verified ?? false,
    });
  }, [origin, restaurant?.custom_domain, restaurant?.custom_domain_verified]);

  const platformOrigin = useMemo(() => {
    if (typeof window !== 'undefined') return window.location.origin.replace(/\/+$/, '');
    return 'https://serveos.net';
  }, []);

  const additionalLanguages = useMemo(
    () =>
      additionalLanguagesRaw
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [additionalLanguagesRaw]
  );

  const { data: menuItems, isLoading: loadingItems, refetch: refetchItems } = useQuery({
    queryKey: ['sitemap-menu-items', restaurant?.id ?? null],
    enabled: !!restaurant?.id,
    queryFn: async (): Promise<MenuItemForSitemap[]> => {
      // Owner-only path: this RPC internally checks
      // restaurants.owner_id = auth.uid(), so even if a non-owner somehow
      // reaches this page they get an empty list instead of leaking
      // another tenant's menu URLs.
      const { data, error } = await supabase.rpc('get_owner_sitemap_menu_items', {
        _restaurant_id: restaurant!.id,
      });
      if (error) throw error;
      return (data ?? []) as MenuItemForSitemap[];
    },
  });

  const urls = useMemo(
    () =>
      buildSitemapUrls({
        origin: resolvedOrigin,
        slug: includeLegacySlug ? restaurant?.slug ?? null : null,
        restaurantUpdatedAt: restaurant?.created_at ?? null,
        menuItems: menuItems ?? [],
        platformOrigin,
        defaultLanguage: defaultLanguage || 'en',
        additionalLanguages,
      }),
    [
      resolvedOrigin,
      includeLegacySlug,
      restaurant?.slug,
      restaurant?.created_at,
      menuItems,
      platformOrigin,
      defaultLanguage,
      additionalLanguages,
    ]
  );

  const sitemapXml = useMemo(() => renderSitemapXml(urls), [urls]);
  const robotsTxt = useMemo(() => renderRobotsTxt(resolvedOrigin), [resolvedOrigin]);
  const seoRows = useMemo(() => buildSeoExport(urls), [urls]);
  const seoCsv = useMemo(() => renderSeoExportCsv(seoRows), [seoRows]);
  const seoJson = useMemo(() => renderSeoExportJson(seoRows), [seoRows]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied to clipboard`);
    } catch {
      toast.error('Could not copy. Select & copy manually.');
    }
  };

  const isLoading = loadingRestaurant || loadingItems;

  // Defense in depth: even though the route is gated to the `owner` role,
  // confirm the current authenticated user actually owns the loaded
  // restaurant before exposing its sitemap & SEO data.
  const isOwnerOfRestaurant =
    !!user && hasRole('owner') && !!restaurant && restaurant.owner_id === user.id;

  if (!loadingRestaurant && !isOwnerOfRestaurant) {
    return (
      <AdminLayout>
        <div className="p-4 sm:p-6 lg:p-8 max-w-2xl mx-auto">
          <div className="bg-card rounded-lg border border-border p-8 text-center space-y-3">
            <div className="mx-auto h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <ShieldAlert className="h-5 w-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h1 className="text-lg font-semibold">Owner access only</h1>
            <p className="text-sm text-muted-foreground">
              Only the restaurant owner can generate or download this restaurant's
              sitemap and SEO data. Please ask the owner to sign in to manage these
              settings.
            </p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" strokeWidth={1.75} />
              <h1 className="text-2xl font-semibold tracking-tight">Sitemap Generator</h1>
            </div>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Generate a search-engine-friendly <code className="text-xs">sitemap.xml</code> for your
              restaurant's public site. Download it and host it at the root of your domain so
              Google, Bing, and others can crawl every menu item.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchItems()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Settings */}
        <section className="bg-card rounded-lg border border-border p-5 space-y-4">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <FileCode2 className="h-4 w-4 text-muted-foreground" />
            Configuration
          </h2>

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="origin">Site origin</Label>
              <Input
                id="origin"
                placeholder="https://yourdomain.com"
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Leave blank to auto-detect from{' '}
                {restaurant?.custom_domain && restaurant?.custom_domain_verified ? (
                  <>your verified custom domain (<code>{restaurant.custom_domain}</code>)</>
                ) : (
                  <>this browser's URL</>
                )}
                .
              </p>
            </div>
            <div className="flex items-end">
              <Badge variant="secondary" className="font-mono text-xs">
                {resolvedOrigin}
              </Badge>
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeLegacySlug}
              onChange={(e) => setIncludeLegacySlug(e.target.checked)}
              className="mt-0.5"
            />
            <span>
              Include legacy <code className="text-xs">/r/{restaurant?.slug ?? 'your-slug'}</code> URLs
              <span className="block text-xs text-muted-foreground">
                Helpful if QR codes still point to the platform domain. Listed at lower priority.
              </span>
            </span>
          </label>

          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="default-language" className="flex items-center gap-1.5">
                <Languages className="h-3.5 w-3.5 text-muted-foreground" />
                Default language
              </Label>
              <Input
                id="default-language"
                placeholder="en"
                value={defaultLanguage}
                onChange={(e) => setDefaultLanguage(e.target.value)}
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground">
                BCP-47 tag (e.g. <code>en</code>, <code>en-US</code>, <code>bn</code>).
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="alt-languages">Alternate languages</Label>
              <Input
                id="alt-languages"
                placeholder="bn, fr-CA"
                value={additionalLanguagesRaw}
                onChange={(e) => setAdditionalLanguagesRaw(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated. Each gets its own <code>hreflang</code> alternate.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">{urls.length} URL{urls.length === 1 ? '' : 's'}</Badge>
            <Badge variant="outline">{menuItems?.length ?? 0} menu item{(menuItems?.length ?? 0) === 1 ? '' : 's'}</Badge>
            <Badge variant="outline">
              {1 + additionalLanguages.length} hreflang variant{1 + additionalLanguages.length === 1 ? '' : 's'}
            </Badge>
            {restaurant?.custom_domain_verified && (
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Custom domain verified
              </Badge>
            )}
          </div>
        </section>

        {/* sitemap.xml */}
        <section className="bg-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold">sitemap.xml</h2>
              <p className="text-xs text-muted-foreground">Upload this file to the root of your site.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copy('sitemap.xml', sitemapXml)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
              <Button size="sm" onClick={() => downloadFile('sitemap.xml', sitemapXml)}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download
              </Button>
            </div>
          </div>
          <Textarea
            readOnly
            value={sitemapXml}
            className="font-mono text-xs h-72 resize-none"
            spellCheck={false}
          />
        </section>

        {/* robots.txt */}
        <section className="bg-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold">robots.txt</h2>
              <p className="text-xs text-muted-foreground">
                Recommended companion file pointing crawlers at your sitemap.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copy('robots.txt', robotsTxt)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadFile('robots.txt', robotsTxt, 'text/plain')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> Download
              </Button>
            </div>
          </div>
          <Textarea
            readOnly
            value={robotsTxt}
            className="font-mono text-xs h-32 resize-none"
            spellCheck={false}
          />
        </section>

        {/* SEO export — canonical + hreflang */}
        <section className="bg-card rounded-lg border border-border p-5 space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-1.5">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                SEO export — canonical URLs &amp; hreflang
              </h2>
              <p className="text-xs text-muted-foreground">
                Flat list of every public URL with its canonical target and language alternates.
                Useful for audits, Search Console submissions, or feeding into other SEO tooling.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => copy('SEO export (CSV)', seoCsv)}>
                <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => downloadFile('seo-export.csv', seoCsv, 'text/csv')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
              </Button>
              <Button size="sm" onClick={() => downloadFile('seo-export.json', seoJson, 'application/json')}>
                <Download className="h-3.5 w-3.5 mr-1.5" /> JSON
              </Button>
            </div>
          </div>

          <div className="rounded-md border border-border overflow-hidden">
            <div className="max-h-80 overflow-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 sticky top-0">
                  <tr className="text-left">
                    <th className="px-3 py-2 font-medium">URL</th>
                    <th className="px-3 py-2 font-medium">Canonical</th>
                    <th className="px-3 py-2 font-medium">Hreflang</th>
                  </tr>
                </thead>
                <tbody>
                  {seoRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">
                        No URLs yet — add menu items or set an origin.
                      </td>
                    </tr>
                  ) : (
                    seoRows.map((row) => (
                      <tr key={row.loc} className="border-t border-border/60 align-top">
                        <td className="px-3 py-2 font-mono break-all max-w-[28ch]">{row.loc}</td>
                        <td className="px-3 py-2 font-mono break-all max-w-[28ch] text-muted-foreground">
                          {row.canonical === row.loc ? (
                            <span className="text-primary">self</span>
                          ) : (
                            row.canonical
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {row.alternates.map((a) => (
                              <Badge
                                key={`${row.loc}-${a.hreflang}-${a.href}`}
                                variant="outline"
                                className="font-mono text-[10px]"
                                title={a.href}
                              >
                                {a.hreflang}
                              </Badge>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>


        <section className="bg-muted/30 rounded-lg border border-border p-5 space-y-2">
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Info className="h-4 w-4 text-muted-foreground" />
            How to publish your sitemap
          </h2>
          <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1.5 ml-1">
            <li>Download <code>sitemap.xml</code> and <code>robots.txt</code> above.</li>
            <li>Upload both files to the root of your website (so they are reachable at <code>{resolvedOrigin}/sitemap.xml</code>).</li>
            <li>
              Submit the sitemap to{' '}
              <a
                href="https://search.google.com/search-console"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Google Search Console
              </a>{' '}
              and{' '}
              <a
                href="https://www.bing.com/webmasters"
                target="_blank"
                rel="noreferrer"
                className="text-primary underline underline-offset-2"
              >
                Bing Webmaster Tools
              </a>
              .
            </li>
            <li>Re-generate after adding new menu items so search engines can index them.</li>
          </ol>
        </section>
      </div>
    </AdminLayout>
  );
}
