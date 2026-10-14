import { useEffect, useRef, useState } from 'react';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { useImageUpload } from '@/hooks/useImageUpload';
import UploadProgress from '@/components/upload/UploadProgress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { Plus, Save, Trash2, Loader2, Upload } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import {
  useDemoPageConfig,
  DemoPageConfig,
  DemoEmbed,
  DemoFeature,
  DEMO_CONFIG_FALLBACK,
} from '@/hooks/useDemoPageConfig';
import { toast } from 'sonner';

const ICON_OPTIONS = [
  'Sparkles', 'UtensilsCrossed', 'Star', 'ClipboardList',
  'LayoutDashboard', 'ChefHat', 'Receipt', 'BarChart3',
  'ShoppingBag', 'TrendingUp', 'DollarSign',
];

export default function PlatformDemoEditor() {
  const { data, isLoading } = useDemoPageConfig();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DemoPageConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setDraft(data);
    else if (!isLoading && !data) {
      setDraft({ id: '', ...DEMO_CONFIG_FALLBACK } as DemoPageConfig);
    }
  }, [data, isLoading]);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        hero: draft.hero,
        credentials: draft.credentials,
        features: draft.features,
        embeds: draft.embeds,
        cta: draft.cta,
      };
      let error;
      if (draft.id) {
        ({ error } = await supabase.from('demo_page_config' as any).update(payload).eq('id', draft.id));
      } else {
        ({ error } = await supabase.from('demo_page_config' as any).insert(payload as any));
      }
      if (error) throw error;
      toast.success('Demo page saved');
      qc.invalidateQueries({ queryKey: ['demo-page-config'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !draft) {
    return (
      <PlatformLayout>
        <div className="p-10 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading demo config…
        </div>
      </PlatformLayout>
    );
  }

  const update = <K extends keyof DemoPageConfig>(key: K, value: DemoPageConfig[K]) =>
    setDraft({ ...draft, [key]: value });

  const addEmbed = () =>
    update('embeds', [
      ...draft.embeds,
      { title: 'New preview', description: '', iframeSrc: '/r/demo', ctaLabel: 'View Demo', ctaHref: '/r/demo', icon: 'Sparkles', badge: '' },
    ]);
  const removeEmbed = (i: number) => update('embeds', draft.embeds.filter((_, idx) => idx !== i));
  const updateEmbed = (i: number, patch: Partial<DemoEmbed>) =>
    update('embeds', draft.embeds.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));

  const addFeature = () =>
    update('features', [...draft.features, { icon: 'Sparkles', title: 'New feature', description: '' }]);
  const removeFeature = (i: number) => update('features', draft.features.filter((_, idx) => idx !== i));
  const updateFeature = (i: number, patch: Partial<DemoFeature>) =>
    update('features', draft.features.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
        <header className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Demo page editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Controls the public <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/demo</code> marketing page.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/demo" target="_blank" rel="noopener">Preview /demo</a>
            </Button>
            <Button onClick={save} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </Button>
          </div>
        </header>

        <Tabs defaultValue="hero" className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 w-full max-w-2xl h-auto">
            <TabsTrigger value="hero">Hero</TabsTrigger>
            <TabsTrigger value="credentials">Login</TabsTrigger>
            <TabsTrigger value="features">Features</TabsTrigger>
            <TabsTrigger value="embeds">Embeds</TabsTrigger>
            <TabsTrigger value="cta">CTA</TabsTrigger>
          </TabsList>

          {/* HERO */}
          <TabsContent value="hero">
            <Card>
              <CardHeader><CardTitle>Hero section</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Eyebrow" value={draft.hero.eyebrow ?? ''} onChange={(v) => update('hero', { ...draft.hero, eyebrow: v })} />
                <Field label="Title" value={draft.hero.title ?? ''} onChange={(v) => update('hero', { ...draft.hero, title: v })} />
                <Field label="Description" multiline value={draft.hero.description ?? ''} onChange={(v) => update('hero', { ...draft.hero, description: v })} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* CREDENTIALS */}
          <TabsContent value="credentials">
            <Card>
              <CardHeader><CardTitle>Demo credentials & login card</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Heading" value={draft.credentials.heading ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, heading: v })} />
                <Field label="Subheading" multiline value={draft.credentials.subheading ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, subheading: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Email" value={draft.credentials.email ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, email: v })} />
                  <Field label="Password" value={draft.credentials.password ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, password: v })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Primary button label" value={draft.credentials.primaryCtaLabel ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, primaryCtaLabel: v })} />
                  <Field label="Primary button link" value={draft.credentials.primaryCtaHref ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, primaryCtaHref: v })} />
                  <Field label="Secondary button label" value={draft.credentials.secondaryCtaLabel ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, secondaryCtaLabel: v })} />
                  <Field label="Secondary button link" value={draft.credentials.secondaryCtaHref ?? ''} onChange={(v) => update('credentials', { ...draft.credentials, secondaryCtaHref: v })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FEATURES */}
          <TabsContent value="features">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Feature highlights</CardTitle>
                <Button size="sm" variant="outline" onClick={addFeature} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {draft.features.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No features yet. Click Add to create one.</p>
                )}
                {draft.features.map((f, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 space-y-3 relative">
                    <button onClick={() => removeFeature(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <IconSelect value={f.icon} onChange={(v) => updateFeature(i, { icon: v })} />
                      <div className="sm:col-span-2">
                        <Field label="Title" value={f.title} onChange={(v) => updateFeature(i, { title: v })} />
                      </div>
                    </div>
                    <Field label="Description" multiline value={f.description} onChange={(v) => updateFeature(i, { description: v })} />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EMBEDS */}
          <TabsContent value="embeds">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Laptop preview embeds</CardTitle>
                <Button size="sm" variant="outline" onClick={addEmbed} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {draft.embeds.map((e, i) => (
                  <div key={i} className="rounded-lg border border-border p-4 space-y-3 relative">
                    <button onClick={() => removeEmbed(i)} className="absolute top-2 right-2 text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <IconSelect value={e.icon} onChange={(v) => updateEmbed(i, { icon: v })} />
                      <Field label="Title" value={e.title} onChange={(v) => updateEmbed(i, { title: v })} />
                      <Field label="Badge (optional)" value={e.badge ?? ''} onChange={(v) => updateEmbed(i, { badge: v })} />
                    </div>
                    <Field label="Description" multiline value={e.description} onChange={(v) => updateEmbed(i, { description: v })} />
                    <ScreenshotField
                      value={e.iframeSrc}
                      onChange={(v) => updateEmbed(i, { iframeSrc: v })}
                      index={i}
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Button label" value={e.ctaLabel} onChange={(v) => updateEmbed(i, { ctaLabel: v })} />
                      <Field label="Live link (opens in new tab)" value={e.ctaHref} onChange={(v) => updateEmbed(i, { ctaHref: v })} />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          {/* CTA */}
          <TabsContent value="cta">
            <Card>
              <CardHeader><CardTitle>Bottom call-to-action</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <Field label="Heading" value={draft.cta.heading ?? ''} onChange={(v) => update('cta', { ...draft.cta, heading: v })} />
                <Field label="Subheading" multiline value={draft.cta.subheading ?? ''} onChange={(v) => update('cta', { ...draft.cta, subheading: v })} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Primary label" value={draft.cta.primaryLabel ?? ''} onChange={(v) => update('cta', { ...draft.cta, primaryLabel: v })} />
                  <Field label="Primary link" value={draft.cta.primaryHref ?? ''} onChange={(v) => update('cta', { ...draft.cta, primaryHref: v })} />
                  <Field label="Secondary label" value={draft.cta.secondaryLabel ?? ''} onChange={(v) => update('cta', { ...draft.cta, secondaryLabel: v })} />
                  <Field label="Secondary link" value={draft.cta.secondaryHref ?? ''} onChange={(v) => update('cta', { ...draft.cta, secondaryHref: v })} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PlatformLayout>
  );
}

function Field({
  label, value, onChange, multiline,
}: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function IconSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Icon</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {ICON_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
      </select>
    </div>
  );
}

function ScreenshotField({
  value, onChange, index,
}: { value: string; onChange: (v: string) => void; index: number }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    upload, retry, cancel, uploading, progress, error: uploadError, fileName,
  } = useImageUpload({
    bucket: 'demo-screenshots',
    buildPath: (f) => `embed-${index}-${Date.now()}.${(f.name.split('.').pop() || 'png').toLowerCase()}`,
    upsert: true,
    limit: 'large',
    compress: COMPRESS_PRESETS.hero,
    successMessage: 'Screenshot uploaded',
    onUploaded: (url) => onChange(url),
  });

  const handleFile = async (file: File) => {
    await upload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">Screenshot (shown in laptop frame)</Label>
      <UploadProgress
        uploading={uploading}
        progress={progress}
        error={uploadError}
        fileName={fileName}
        onRetry={retry}
        onCancel={cancel}
      />
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Paste URL or upload below"
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="gap-1 shrink-0"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_IMAGE_ATTR}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {value && (
        <div className="rounded-md border border-border overflow-hidden bg-muted/30 mt-2">
          <img src={value} alt="Preview" className="w-full max-h-48 object-cover object-top" />
        </div>
      )}
    </div>
  );
}
