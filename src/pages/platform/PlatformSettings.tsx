import { useEffect, useRef, useState } from 'react';
import UploadProgress from '@/components/upload/UploadProgress';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Globe, Save, ImageIcon, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  usePlatformSettings,
  useUpdateCnameTarget,
  useUploadPlatformLogo,
  useRemovePlatformLogo,
  useUploadPlatformFavicon,
  useRemovePlatformFavicon,
  useUpdateSiteName,
  usePlatformBranding,
} from '@/hooks/usePlatformSettings';

export default function PlatformSettings() {
  const { data: settings, isLoading } = usePlatformSettings();
  const update = useUpdateCnameTarget();
  const uploadLogo = useUploadPlatformLogo();
  const removeLogo = useRemovePlatformLogo();
  const uploadFavicon = useUploadPlatformFavicon();
  const removeFavicon = useRemovePlatformFavicon();
  const updateName = useUpdateSiteName();
  const { logoUrl, siteName, faviconUrl } = usePlatformBranding();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const faviconRef = useRef<HTMLInputElement | null>(null);
  const [cnameTarget, setCnameTarget] = useState('');
  const [siteNameDraft, setSiteNameDraft] = useState('');
  const [logoProgress, setLogoProgress] = useState(0);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [logoName, setLogoName] = useState<string | null>(null);
  const logoAbort = useRef<AbortController | null>(null);
  const lastLogoFile = useRef<File | null>(null);
  const [faviconProgress, setFaviconProgress] = useState(0);
  const [faviconError, setFaviconError] = useState<string | null>(null);
  const [faviconName, setFaviconName] = useState<string | null>(null);
  const faviconAbort = useRef<AbortController | null>(null);
  const lastFaviconFile = useRef<File | null>(null);

  useEffect(() => {
    if (settings?.custom_domain_cname_target) {
      setCnameTarget(settings.custom_domain_cname_target);
    }
    if (settings?.site_name) {
      setSiteNameDraft(settings.site_name);
    }
  }, [settings?.custom_domain_cname_target, settings?.site_name]);

  const handleSave = async () => {
    try {
      await update.mutateAsync(cnameTarget);
      toast.success('CNAME target updated. Restaurants will see the new value in their setup guide.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save');
    }
  };

  const handleSaveName = async () => {
    try {
      await updateName.mutateAsync(siteNameDraft);
      toast.success('Site name updated across the marketing site.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save');
    }
  };

  const handleLogoFile = async (file: File | null | undefined) => {
    if (!file) return;
    const ctrl = new AbortController();
    logoAbort.current = ctrl;
    setLogoName(file.name);
    setLogoError(null);
    setLogoProgress(0);
    try {
      await uploadLogo.mutateAsync({ file, onProgress: setLogoProgress, signal: ctrl.signal });
      toast.success('Logo updated. It now appears across the marketing site.');
      setLogoName(null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setLogoError(err?.message ?? 'Upload failed');
        toast.error(err?.message ?? 'Upload failed');
      }
    } finally {
      logoAbort.current = null;
      lastLogoFile.current = file;
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleRemoveLogo = async () => {
    if (!confirm('Remove the custom logo and revert to the default icon?')) return;
    try {
      await removeLogo.mutateAsync();
      toast.success('Logo removed.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove');
    }
  };

  const handleFaviconFile = async (file: File | null | undefined) => {
    if (!file) return;
    const ctrl = new AbortController();
    faviconAbort.current = ctrl;
    setFaviconName(file.name);
    setFaviconError(null);
    setFaviconProgress(0);
    try {
      await uploadFavicon.mutateAsync({ file, onProgress: setFaviconProgress, signal: ctrl.signal });
      toast.success('Favicon updated. Browsers will pick it up after a refresh.');
      setFaviconName(null);
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setFaviconError(err?.message ?? 'Upload failed');
        toast.error(err?.message ?? 'Upload failed');
      }
    } finally {
      faviconAbort.current = null;
      lastFaviconFile.current = file;
      if (faviconRef.current) faviconRef.current.value = '';
    }
  };


  const handleRemoveFavicon = async () => {
    if (!confirm('Remove the custom favicon and revert to the default browser icon?')) return;
    try {
      await removeFavicon.mutateAsync();
      toast.success('Favicon removed.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to remove');
    }
  };

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight">Platform settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure SaaS-wide values shown to all restaurant tenants.
          </p>
        </header>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <ImageIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Site branding</CardTitle>
                <CardDescription>
                  Logo and site name shown in the marketing site nav, footer, and copyright. Recommended logo: square PNG or SVG, transparent background, ≤ 2MB.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Current logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border border-border bg-background flex items-center justify-center overflow-hidden">
                  {logoUrl ? (
                    <img src={logoUrl} alt={`${siteName} logo`} className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground text-center px-1">No custom logo</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="hidden"
                    onChange={(e) => handleLogoFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadLogo.isPending}
                  >
                    {uploadLogo.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />{logoUrl ? 'Replace logo' : 'Upload logo'}</>
                    )}
                  </Button>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRemoveLogo}
                      disabled={removeLogo.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <UploadProgress
                uploading={uploadLogo.isPending}
                progress={logoProgress}
                error={logoError}
                fileName={logoName}
                onCancel={() => logoAbort.current?.abort()}
                onRetry={() => lastLogoFile.current && handleLogoFile(lastLogoFile.current)}
              />
            </div>


            <div className="space-y-2">
              <Label>Browser favicon</Label>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden">
                  {faviconUrl ? (
                    <img src={faviconUrl} alt="Favicon preview" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-muted-foreground text-center px-1">Default</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={faviconRef}
                    type="file"
                    accept="image/png,image/svg+xml,image/x-icon,.ico"
                    className="hidden"
                    onChange={(e) => handleFaviconFile(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => faviconRef.current?.click()}
                    disabled={uploadFavicon.isPending}
                  >
                    {uploadFavicon.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />{faviconUrl ? 'Replace favicon' : 'Upload favicon'}</>
                    )}
                  </Button>
                  {faviconUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={handleRemoveFavicon}
                      disabled={removeFavicon.isPending}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
              </div>
              <UploadProgress
                uploading={uploadFavicon.isPending}
                progress={faviconProgress}
                error={faviconError}
                fileName={faviconName}
                onCancel={() => faviconAbort.current?.abort()}
                onRetry={() => lastFaviconFile.current && handleFaviconFile(lastFaviconFile.current)}
              />
              <p className="text-xs text-muted-foreground">
                PNG, SVG, or ICO. Square recommended (32×32 or 64×64). Max 512KB. Browsers may cache favicons — hard refresh to see changes.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="site-name">Site name</Label>
              <Input
                id="site-name"
                placeholder="ServeOS"
                value={siteNameDraft}
                onChange={(e) => setSiteNameDraft(e.target.value)}
                disabled={isLoading}
                maxLength={60}
              />
              <p className="text-xs text-muted-foreground">
                Shown next to the logo and in the footer copyright.
              </p>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleSaveName}
                disabled={updateName.isPending || !siteNameDraft.trim() || siteNameDraft.trim() === (settings?.site_name ?? '')}
              >
                <Save className="h-4 w-4 mr-2" />
                {updateName.isPending ? 'Saving…' : 'Save site name'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="rounded-md bg-primary/10 p-2 text-primary">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-base">Custom domain CNAME target</CardTitle>
                <CardDescription>
                  The hostname tenants point their <b>subdomain</b> (or apex via ALIAS) at — shown in the setup guide.
                  Use your Cloudflare for SaaS fallback origin (e.g. <code className="font-mono">customers.serveos.net</code>).
                  The verification function reads this value too.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cname-target">CNAME target</Label>
              <Input
                id="cname-target"
                placeholder="customers.serveos.net"
                value={cnameTarget}
                onChange={(e) => setCnameTarget(e.target.value)}
                disabled={isLoading}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                No <code>https://</code>, no path, no trailing slash. Saved in lowercase.
              </p>
            </div>

            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={update.isPending || !cnameTarget.trim()}>
                <Save className="h-4 w-4 mr-2" />
                {update.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </CardContent>
        </Card>

      </div>
    </PlatformLayout>
  );
}
