import { useEffect, useRef, useState } from 'react';
import { Apple, ExternalLink, Laptop, Loader2, Monitor, RotateCcw, Save, Smartphone, Upload } from 'lucide-react';
import { toast } from 'sonner';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppDownloadCards from '@/components/marketing/AppDownloadCards';
import UploadProgress from '@/components/upload/UploadProgress';
import { useAppDownloads, useSaveAppDownloads } from '@/hooks/useAppDownloads';
import { APP_INSTALLER_BUCKET, APP_PLATFORMS, APP_PLATFORM_DETAILS, INSTALLER_EXTENSIONS, appDownloadsSchema, appInstaller, formatAppFileSize, validateInstallerFile, type AppDownloadsConfig, type AppDownloadsRecord, type AppPlatform, type AppRelease, type InstallerPlatform } from '@/lib/app-downloads';
import { uploadWithProgress } from '@/lib/storage-upload';

const platformIcons = { android: Smartphone, ios: Apple, windows: Monitor, macos: Laptop };

function Field({ id, label, value, onChange, placeholder, multiline, type = 'text', maxLength }: { id: string; label: string; value: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean; type?: string; maxLength?: number }) {
  const props = { id, value, placeholder, maxLength, onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(event.target.value) };
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{multiline ? <Textarea {...props} rows={4} /> : <Input {...props} type={type} />}</div>;
}

export default function PlatformAppDownloads() {
  const query = useAppDownloads(), save = useSaveAppDownloads();
  const [draft, setDraft] = useState<AppDownloadsRecord | null>(null);
  const [uploading, setUploading] = useState(false), [progress, setProgress] = useState(0), [fileName, setFileName] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const uploadAbort = useRef<AbortController | null>(null);
  const fileInputs = useRef<Partial<Record<InstallerPlatform, HTMLInputElement>>>({});
  useEffect(() => { if (query.data) setDraft(previous => previous ?? query.data); }, [query.data]);
  useEffect(() => () => uploadAbort.current?.abort(), []);

  const update = <K extends keyof AppDownloadsConfig>(field: K, value: AppDownloadsConfig[K]) => setDraft(previous => previous ? { ...previous, config: { ...previous.config, [field]: value } } : previous);
  const updateRelease = <K extends keyof AppRelease>(platform: AppPlatform, field: K, value: AppRelease[K]) => setDraft(previous => previous ? { ...previous, config: { ...previous.config, [platform]: { ...previous.config[platform], [field]: value } } } : previous);
  const updateInstaller = (platform: InstallerPlatform, url: string, size: number | null = null) => setDraft(previous => {
    if (!previous) return previous;
    const config = { ...previous.config };
    if (platform === 'android') config.android = { ...config.android, apk_url: url, file_size_bytes: size };
    else config[platform] = { ...config[platform], installer_url: url, file_size_bytes: size };
    return { ...previous, config };
  });

  const publish = async () => {
    if (!draft) return;
    const parsed = appDownloadsSchema.safeParse(draft.config);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? 'Check the release settings.'); return; }
    const submitted = draft;
    try {
      const result = await save.mutateAsync({ config: parsed.data, updated_at: draft.updated_at });
      setDraft(current => {
        if (!current || JSON.stringify(current.config) === JSON.stringify(submitted.config)) return result;
        // Keep edits made while this save was running, using the new saved version.
        return { ...current, updated_at: result.updated_at };
      });
      toast.success('App download page saved');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save the download page.'); }
  };

  const reload = async () => {
    const atStart = draft;
    const result = await query.refetch();
    if (result.data) { setDraft(current => current === atStart ? result.data : current); setUploadError(null); }
    else toast.error('Could not reload saved settings.');
  };

  const uploadInstaller = async (file: File, platform: InstallerPlatform) => {
    setUploading(true); setProgress(0); setUploadError(null); setFileName(file.name);
    const controller = new AbortController(); uploadAbort.current = controller;
    try {
      const { extension, contentType } = await validateInstallerFile(file, platform);
      controller.signal.throwIfAborted();
      const { publicUrl } = await uploadWithProgress({ bucket: APP_INSTALLER_BUCKET, path: `${platform}/${crypto.randomUUID()}.${extension}`, file, contentType, signal: controller.signal, onProgress: setProgress });
      updateInstaller(platform, publicUrl, file.size);
      toast.success(`${APP_PLATFORM_DETAILS[platform].name} installer uploaded. Save changes to publish its download link.`);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') toast.info('Upload cancelled');
      else setUploadError(error instanceof Error ? error.message : 'Installer upload failed.');
    } finally { setUploading(false); uploadAbort.current = null; }
  };

  if (query.isError && !draft) return <PlatformLayout><div className="mx-auto max-w-5xl p-8" role="alert"><h1 className="text-2xl font-semibold">App downloads</h1><p className="my-4 text-muted-foreground">Could not load app download settings. Check that the app downloads migration has been applied.</p><Button onClick={reload}>Try again</Button></div></PlatformLayout>;
  if (!draft) return <PlatformLayout><div role="status" className="flex items-center gap-2 p-10 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" />Loading app downloads…</div></PlatformLayout>;

  const config = draft.config, dirty = JSON.stringify(config) !== JSON.stringify(query.data?.config);
  const previewConfig = appDownloadsSchema.safeParse(config);
  const renderInstaller = (platform: InstallerPlatform) => {
    const installer = appInstaller(config, platform), name = APP_PLATFORM_DETAILS[platform].name;
    const android = platform === 'android';
    const extensions = INSTALLER_EXTENSIONS[platform].map(extension => `.${extension}`).join(', ');
    const uploadLabel = android ? 'Upload Android APK' : `Upload ${name} installer`;
    return (
      <div className="space-y-4 rounded-xl border border-dashed p-4">
        <div>
          <h3 className="text-sm font-medium">Direct {android ? 'APK' : name} download</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Upload {extensions} files up to 50 MB, or paste an external HTTPS download link for larger installers. Save changes to publish the link.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="outline" className="gap-2" disabled={uploading || save.isPending} onClick={() => fileInputs.current[platform]?.click()}>
            <Upload className="h-4 w-4" />{uploadLabel}
          </Button>
          <input ref={element => { fileInputs.current[platform] = element; }} aria-label={uploadLabel} type="file" accept={extensions} className="hidden" disabled={uploading || save.isPending} onChange={event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) void uploadInstaller(file, platform);
          }} />
          {installer.file_size_bytes && <span className="text-xs text-muted-foreground">{formatAppFileSize(installer.file_size_bytes)}</span>}
        </div>
        <Field id={`${platform}-installer`} label={android ? 'APK download URL' : `${name} installer URL`} value={installer.url} placeholder={`https://downloads.example.com/serveos.${INSTALLER_EXTENSIONS[platform][0]}`} maxLength={2000} onChange={value => updateInstaller(platform, value)} />
        {installer.url && <Button type="button" variant="ghost" size="sm" onClick={() => updateInstaller(platform, '')}>Clear {android ? 'APK' : 'installer'} link</Button>}
      </div>
    );
  };

  const renderRelease = (platform: AppPlatform) => {
    const release = config[platform], details = APP_PLATFORM_DETAILS[platform], Icon = platformIcons[platform];
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><Icon className="h-5 w-5 text-primary" />{details.name} release</CardTitle>
          <p className="text-sm text-muted-foreground">Add your release details, then make the download available when it is ready.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4 rounded-xl border p-4">
            <div><Label htmlFor={`${platform}-enabled`}>Show {details.name} on the download page</Label><p className="mt-1 text-xs text-muted-foreground">Turn off to hide this platform’s card.</p></div>
            <Switch id={`${platform}-enabled`} checked={release.enabled} onCheckedChange={value => updateRelease(platform, 'enabled', value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`${platform}-status`}>Availability</Label>
            <Select value={release.status} onValueChange={(value: AppRelease['status']) => updateRelease(platform, 'status', value)}>
              <SelectTrigger id={`${platform}-status`}><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="coming_soon">Coming soon</SelectItem><SelectItem value="available">Available now</SelectItem></SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Available releases need at least one working download link.</p>
          </div>
          <Field id={`${platform}-store`} label={details.storeLabel} value={release.store_url} onChange={value => updateRelease(platform, 'store_url', value)} placeholder={details.storePlaceholder} maxLength={2000} />
          {platform !== 'ios' && renderInstaller(platform)}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id={`${platform}-version`} label="Version" value={release.version} onChange={value => updateRelease(platform, 'version', value)} placeholder="e.g. 1.0.0" maxLength={40} />
            <Field id={`${platform}-minimum`} label="Minimum OS" value={release.min_os} onChange={value => updateRelease(platform, 'min_os', value)} placeholder={details.minOsPlaceholder} maxLength={80} />
          </div>
          <Field id={`${platform}-date`} label="Release date" type="date" value={release.released_at} onChange={value => updateRelease(platform, 'released_at', value)} />
          <Field id={`${platform}-notes`} label="Release notes" multiline value={release.release_notes} onChange={value => updateRelease(platform, 'release_notes', value)} placeholder="What changed in this release?" maxLength={4000} />
        </CardContent>
      </Card>
    );
  };

  return <PlatformLayout><div className="mx-auto max-w-7xl space-y-7 p-4 sm:p-6 lg:p-9">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-semibold tracking-tight">App downloads</h1><Badge variant="outline">{dirty ? 'Unsaved changes' : 'Saved'}</Badge></div><p className="mt-2 max-w-xl text-sm text-muted-foreground">Manage downloads for Android, iOS, Windows, and macOS, along with your public page content.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><a href="/download" target="_blank" rel="noopener noreferrer">View download page<ExternalLink className="ml-2 h-4 w-4" /></a></Button><Button onClick={publish} disabled={!dirty || save.isPending || uploading} className="gap-2">{save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save changes</Button></div></header>
    <UploadProgress uploading={uploading} progress={progress} error={uploadError} fileName={fileName} onCancel={() => uploadAbort.current?.abort()} />
    {query.data && query.data.updated_at !== draft.updated_at && <div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">Saved settings changed in another tab. Reload them before saving your changes.</div>}
    <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,1fr)]"><div className="min-w-0 space-y-5">
      <Tabs defaultValue="android">
        <TabsList className="mb-5 grid h-auto w-full grid-cols-2 gap-1 sm:grid-cols-5">
          {APP_PLATFORMS.map(platform => <TabsTrigger key={platform} value={platform}>{APP_PLATFORM_DETAILS[platform].name}</TabsTrigger>)}
          <TabsTrigger value="page" className="col-span-2 sm:col-span-1">Page content</TabsTrigger>
        </TabsList>
        {APP_PLATFORMS.map(platform => <TabsContent key={platform} value={platform}>{renderRelease(platform)}</TabsContent>)}
        <TabsContent value="page">
          <Card><CardHeader><CardTitle className="text-base">Download page content</CardTitle></CardHeader><CardContent className="space-y-5">
            <Field id="app-name" label="App name" value={config.app_name} onChange={value => update('app_name', value)} maxLength={100} />
            <Field id="app-title" label="Page heading" value={config.title} onChange={value => update('title', value)} maxLength={140} />
            <Field id="app-description" label="Page description" multiline value={config.description} onChange={value => update('description', value)} maxLength={700} />
            <Field id="app-support" label="Sign-in guidance" multiline value={config.support_note} onChange={value => update('support_note', value)} maxLength={500} />
          </CardContent></Card>
        </TabsContent>
      </Tabs>
      <Button variant="ghost" size="sm" onClick={reload} disabled={uploading || save.isPending} className="gap-2 text-muted-foreground"><RotateCcw className="h-3.5 w-3.5" />Reload saved settings</Button>
    </div>
    <aside className="min-w-0 space-y-4 rounded-2xl bg-secondary/40 p-4 sm:p-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Live preview</p><h2 className="mt-2 text-lg font-semibold">{config.app_name}</h2><p className="mt-1 text-xs text-muted-foreground">Your edits are published when you save changes.</p></div>{!previewConfig.success && <p role="status" className="rounded-xl border border-warning/40 p-3 text-xs text-muted-foreground">{previewConfig.error.issues[0]?.message}</p>}<AppDownloadCards config={config} compact /></aside></div>
  </div></PlatformLayout>;
}
