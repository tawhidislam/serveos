import { useEffect, useRef, useState } from 'react';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { useImageUpload } from '@/hooks/useImageUpload';
import UploadProgress from '@/components/upload/UploadProgress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, ArrowUp, ArrowDown, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  ABOUT_ICON_OPTIONS,
  useMarketingAbout,
  type MarketingAboutSettings,
  type AboutPillar,
} from '@/hooks/useMarketingAbout';

export default function PlatformAboutEditor() {
  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">About page</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit the public /about marketing page — hero, mission, values, story and CTAs.
          </p>
        </div>
        <Editor />
      </div>
    </PlatformLayout>
  );
}

function Editor() {
  const qc = useQueryClient();
  const { data, isLoading } = useMarketingAbout();
  const [draft, setDraft] = useState<MarketingAboutSettings | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (d: MarketingAboutSettings) => {
      const payload = {
        hero_eyebrow: d.hero_eyebrow,
        hero_title: d.hero_title,
        hero_description: d.hero_description,
        hero_image_url: d.hero_image_url,
        pillars: d.pillars as any,
        why_eyebrow: d.why_eyebrow,
        why_title: d.why_title,
        values_items: d.values_items as any,
        story_eyebrow: d.story_eyebrow,
        story_title: d.story_title,
        story_paragraphs: d.story_paragraphs as any,
        story_image_url: d.story_image_url,
        cta_title: d.cta_title,
        cta_primary_label: d.cta_primary_label,
        cta_primary_href: d.cta_primary_href,
        cta_secondary_label: d.cta_secondary_label,
        cta_secondary_href: d.cta_secondary_href,
        meta_title: d.meta_title,
        meta_description: d.meta_description,
      };
      if (d.id) {
        const { error } = await supabase.from('marketing_about_settings').update(payload).eq('id', d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_about_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('About page saved');
      qc.invalidateQueries({ queryKey: ['marketing-about-settings'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  if (isLoading || !draft) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const update = (patch: Partial<MarketingAboutSettings>) => setDraft({ ...draft, ...patch });

  return (
    <div className="space-y-6">
      {/* SEO */}
      <Card>
        <CardHeader><CardTitle>SEO</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Meta title</Label>
            <Input value={draft.meta_title} onChange={e => update({ meta_title: e.target.value })} maxLength={120} />
          </div>
          <div className="space-y-2">
            <Label>Meta description</Label>
            <Textarea value={draft.meta_description} onChange={e => update({ meta_description: e.target.value })} rows={2} maxLength={300} />
          </div>
        </CardContent>
      </Card>

      {/* Hero */}
      <Card>
        <CardHeader><CardTitle>Hero</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input value={draft.hero_eyebrow} onChange={e => update({ hero_eyebrow: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={draft.hero_title} onChange={e => update({ hero_title: e.target.value })} maxLength={150} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={draft.hero_description} onChange={e => update({ hero_description: e.target.value })} rows={3} maxLength={500} />
          </div>
          <ImageUploader
            label="Hero image (optional)"
            url={draft.hero_image_url}
            folder="about/hero"
            onChange={(u) => update({ hero_image_url: u })}
          />
        </CardContent>
      </Card>

      {/* Pillars */}
      <ListEditor
        title="Mission & Vision pillars"
        items={draft.pillars}
        onChange={(items) => update({ pillars: items })}
        emptyHint="No pillars. Typically 2 (mission + vision)."
      />

      {/* Why choose */}
      <Card>
        <CardHeader><CardTitle>Why-choose section heading</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input value={draft.why_eyebrow} onChange={e => update({ why_eyebrow: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={draft.why_title} onChange={e => update({ why_title: e.target.value })} maxLength={150} />
            </div>
          </div>
        </CardContent>
      </Card>

      <ListEditor
        title="Value cards"
        items={draft.values_items}
        onChange={(items) => update({ values_items: items })}
        emptyHint="No value cards yet. Add one to populate the grid."
      />

      {/* Story */}
      <Card>
        <CardHeader><CardTitle>Story</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input value={draft.story_eyebrow} onChange={e => update({ story_eyebrow: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={draft.story_title} onChange={e => update({ story_title: e.target.value })} maxLength={150} />
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Paragraphs</Label>
              <Button size="sm" variant="outline" onClick={() => update({ story_paragraphs: [...draft.story_paragraphs, ''] })}>
                <Plus className="h-4 w-4 mr-1" /> Add paragraph
              </Button>
            </div>
            {draft.story_paragraphs.length === 0 && (
              <p className="text-sm text-muted-foreground">No paragraphs.</p>
            )}
            {draft.story_paragraphs.map((p, i) => (
              <div key={i} className="flex items-start gap-2">
                <Textarea
                  value={p}
                  onChange={(e) => {
                    const next = [...draft.story_paragraphs];
                    next[i] = e.target.value;
                    update({ story_paragraphs: next });
                  }}
                  rows={3}
                  maxLength={1500}
                />
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (i === 0) return;
                    const next = [...draft.story_paragraphs];
                    [next[i - 1], next[i]] = [next[i], next[i - 1]];
                    update({ story_paragraphs: next });
                  }} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    if (i === draft.story_paragraphs.length - 1) return;
                    const next = [...draft.story_paragraphs];
                    [next[i + 1], next[i]] = [next[i], next[i + 1]];
                    update({ story_paragraphs: next });
                  }} disabled={i === draft.story_paragraphs.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => update({ story_paragraphs: draft.story_paragraphs.filter((_, k) => k !== i) })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            ))}
          </div>
          <ImageUploader
            label="Story image (optional, side image)"
            url={draft.story_image_url}
            folder="about/story"
            onChange={(u) => update({ story_image_url: u })}
          />
        </CardContent>
      </Card>

      {/* CTA */}
      <Card>
        <CardHeader><CardTitle>Call-to-action</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Heading</Label>
            <Input value={draft.cta_title} onChange={e => update({ cta_title: e.target.value })} maxLength={150} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Primary button label</Label>
              <Input value={draft.cta_primary_label} onChange={e => update({ cta_primary_label: e.target.value })} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Primary button link</Label>
              <Input value={draft.cta_primary_href} onChange={e => update({ cta_primary_href: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label>Secondary button label</Label>
              <Input value={draft.cta_secondary_label} onChange={e => update({ cta_secondary_label: e.target.value })} maxLength={50} />
            </div>
            <div className="space-y-2">
              <Label>Secondary button link</Label>
              <Input value={draft.cta_secondary_href} onChange={e => update({ cta_secondary_href: e.target.value })} maxLength={200} />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border border-border">
        <Button variant="outline" onClick={() => data && setDraft(data)}>Reset</Button>
        <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function ListEditor({
  title,
  items,
  onChange,
  emptyHint,
}: {
  title: string;
  items: AboutPillar[];
  onChange: (items: AboutPillar[]) => void;
  emptyHint: string;
}) {
  const updateItem = (i: number, patch: Partial<AboutPillar>) => {
    const next = [...items];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => onChange([...items, { icon: 'target', title: 'New item', body: '' }])}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && <p className="text-sm text-muted-foreground">{emptyHint}</p>}
        {items.map((it, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Select value={it.icon} onValueChange={(v) => updateItem(i, { icon: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ABOUT_ICON_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Title</Label>
                <Input value={it.title} onChange={e => updateItem(i, { title: e.target.value })} maxLength={120} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Body</Label>
              <Textarea value={it.body} onChange={e => updateItem(i, { body: e.target.value })} rows={3} maxLength={600} />
            </div>
            <div className="flex items-center gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="sm" onClick={() => onChange(items.filter((_, k) => k !== i))} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ImageUploader({
  label,
  url,
  folder,
  onChange,
}: {
  label: string;
  url: string | null;
  folder: string;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    upload, retry, cancel, uploading, progress, error: uploadError, fileName,
  } = useImageUpload({
    bucket: 'platform-assets',
    buildPath: (f) => `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${f.name.split('.').pop() || 'jpg'}`,
    compress: COMPRESS_PRESETS.hero,
    onUploaded: (url) => onChange(url),
  });

  const handleFile = async (file: File) => {
    await upload(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <UploadProgress
        uploading={uploading}
        progress={progress}
        error={uploadError}
        fileName={fileName}
        onRetry={retry}
        onCancel={cancel}
      />
      <div className="flex items-start gap-3">
        {url ? (
          <div className="relative">
            <img src={url} alt="" className="h-24 w-40 object-cover rounded-md border border-border" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
              aria-label="Remove image"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="h-24 w-40 rounded-md border border-dashed border-border flex items-center justify-center text-xs text-muted-foreground">
            No image
          </div>
        )}
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT_IMAGE_ATTR}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            {url ? 'Replace' : 'Upload'}
          </Button>
          <Input
            placeholder="Or paste image URL"
            value={url ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="w-full sm:w-72"
          />
        </div>
      </div>
    </div>
  );
}