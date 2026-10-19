import { Apple, ArrowUpRight, CalendarDays, Download, Laptop, Monitor, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { APP_PLATFORMS, APP_PLATFORM_DETAILS, appInstaller, appReleaseAvailable, formatAppFileSize, safeAppDownloadUrl, safeAppStoreUrl, type AppDownloadsConfig } from '@/lib/app-downloads';

const icons = { android: Smartphone, ios: Apple, windows: Monitor, macos: Laptop };

export default function AppDownloadCards({ config, compact = false }: { config: AppDownloadsConfig; compact?: boolean }) {
  const platforms = APP_PLATFORMS.filter(platform => config[platform].enabled);
  if (!platforms.length) return <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">Downloads are being prepared. You can keep using the web dashboard.</div>;
  return (
    <div className={`grid gap-5 ${compact ? '' : 'md:grid-cols-2'}`}>
      {platforms.map(platform => {
        const release = config[platform], available = appReleaseAvailable(config, platform);
        const store = safeAppStoreUrl(release.store_url, platform);
        const installer = appInstaller(config, platform), download = safeAppDownloadUrl(installer.url);
        const beta = platform === 'ios' && store && new URL(store).hostname === 'testflight.apple.com';
        const Icon = icons[platform], details = APP_PLATFORM_DETAILS[platform];
        const storeLabel = platform === 'android' ? 'Get it on Google Play' : platform === 'windows' ? 'Get it from Microsoft Store' : beta ? 'Join the iOS beta' : platform === 'macos' ? 'Download on the Mac App Store' : 'Download on the App Store';
        const downloadLabel = platform === 'android' ? 'Download Android APK' : `Download for ${details.name}`;
        return (
          <article key={platform} className="flex min-w-0 flex-col rounded-2xl border bg-card p-6 sm:p-7" aria-label={`${details.name} app download`}>
            <div className="mb-6 flex items-start justify-between gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></div>
              <Badge variant="outline" className={available ? 'border-success/30 bg-success/10 text-success' : 'text-muted-foreground'}>{available ? 'Available now' : 'Coming soon'}</Badge>
            </div>
            <h3 className="text-xl font-semibold">{details.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{details.description}</p>
            {(release.version || release.min_os || release.released_at || (available && download && installer.file_size_bytes)) && (
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                {release.version && <span>Version {release.version}</span>}
                {release.min_os && <span>{release.min_os}</span>}
                {available && download && installer.file_size_bytes && <span>{formatAppFileSize(installer.file_size_bytes)}</span>}
                {release.released_at && <span className="inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" />{new Date(`${release.released_at}T00:00:00Z`).toLocaleDateString(undefined, { dateStyle: 'medium', timeZone: 'UTC' })}</span>}
              </div>
            )}
            <div className="mt-auto pt-6 space-y-3">
              {available ? <>
                {store && <Button asChild className="w-full gap-2 rounded-xl"><a href={store} target="_blank" rel="noopener noreferrer">{storeLabel}<ArrowUpRight className="h-4 w-4" /></a></Button>}
                {download && <Button asChild variant={store ? 'outline' : 'default'} className="w-full gap-2 rounded-xl"><a href={download} target="_blank" rel="noopener noreferrer" download={platform === 'android' ? 'ServeOS-Restaurant.apk' : undefined}><Download className="h-4 w-4" />{downloadLabel}</a></Button>}
              </> : <Button disabled variant="secondary" className="w-full rounded-xl">Coming soon</Button>}
              {!available && <p className="text-xs text-muted-foreground">We’ll add the download here when this release is ready.</p>}
              {available && download && <p className="text-xs leading-relaxed text-muted-foreground">{platform === 'android' ? 'For a direct install, open the APK on your Android device and follow its installation prompts.' : `Download the installer on your ${platform === 'macos' ? 'Mac' : 'Windows PC'}, then open it to get started.`}</p>}
            </div>
            {release.release_notes && <details className="mt-5 border-t pt-4 text-sm"><summary className="cursor-pointer font-medium">Release notes</summary><p className="mt-3 whitespace-pre-wrap text-muted-foreground">{release.release_notes}</p></details>}
          </article>
        );
      })}
    </div>
  );
}
