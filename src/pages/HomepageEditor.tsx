import { useState, useEffect, useRef } from 'react';
import { useImageUpload } from '@/hooks/useImageUpload';
import UploadProgress from '@/components/upload/UploadProgress';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { uploadWithProgress } from '@/lib/storage-upload';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { validateImageSize, maxSizeHint, validateImageFile, ACCEPT_IMAGE_ATTR, inspectImageFile, safeImageExtension, IMAGE_FORMAT_HINT } from '@/lib/upload-limits';
import { Save, Plus, Trash2, Upload, ImageIcon, X, ChefHat, GripVertical, Crop, Check, Layout, Monitor, Tablet, Smartphone, Info, Palette, ExternalLink, Undo2, Redo2, Download, Copy, ClipboardPaste, AlertTriangle, ChevronUp, ChevronDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CTA_DESTINATIONS, CTA_CUSTOM, isPresetDestination, validateCtaDestination } from '@/lib/cta-destinations';
import { useSettings } from '@/hooks/useSettings';
import LivePreviewPanel from '@/components/admin/LivePreviewPanel';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import templateClassicImg from '@/assets/template-classic.jpg';
import templateModernImg from '@/assets/template-modern.jpg';
import templateBistroImg from '@/assets/template-bistro.jpg';
import templateElegantImg from '@/assets/template-elegant.jpg';
import templateCafeImg from '@/assets/template-cafe.jpg';
import templateDefaultImg from '@/assets/template-default.jpg';
import templateMinimalImg from '@/assets/template-minimal.jpg';
import templateGrandImg from '@/assets/template-grand.jpg';

export default function HomepageEditor() {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Record<string, any>>({});
  const setDraftSection = (key: string) => (content: any) =>
    setDraft(prev => (prev[key] === content ? prev : { ...prev, [key]: content }));
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;

  const { data: sections, isLoading } = useQuery({
    queryKey: ['homepage-content-admin', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('homepage_content')
        .select('*')
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      const map: Record<string, any> = {};
      for (const row of data || []) {
        map[row.section_key] = { id: row.id, content: row.content };
      }
      return map;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ sectionKey, content }: { sectionKey: string; content: any }) => {
      const { error } = await supabase
        .from('homepage_content')
        .upsert(
          { section_key: sectionKey, content, restaurant_id: restaurantId, updated_at: new Date().toISOString() },
          { onConflict: 'restaurant_id,section_key' }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homepage-content-admin'] });
      queryClient.invalidateQueries({ queryKey: ['homepage-content'] });
      toast.success('Section saved successfully');
    },
    onError: () => toast.error('Failed to save'),
  });

  // Silent auto-save of the working (unpublished) section layout draft.
  const draftMutation = useMutation({
    mutationFn: async (content: any) => {
      if (!restaurantId) return;
      const { error } = await supabase
        .from('homepage_content')
        .upsert(
          { section_key: 'section_layout_draft', content, restaurant_id: restaurantId, updated_at: new Date().toISOString() },
          { onConflict: 'restaurant_id,section_key' }
        );
      if (error) throw error;
    },
  });

  const { data: settings } = useSettings();

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AdminLayout>
    );
  }
  const activeTemplate = settings?.homepage_template || 'classic';

  // Define which content sections each template supports
  const templateSections: Record<string, { sections: string[]; description: string }> = {
    default: { sections: ['seo'], description: 'Simple card layout — only SEO settings are used.' },
    classic: { sections: ['hero', 'stats', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Full-featured layout with all content sections.' },
    modern: { sections: ['hero', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Clean layout — no Stats strip.' },
    bistro: { sections: ['hero', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Warm-toned layout — no Stats strip.' },
    elegant: { sections: ['hero', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Luxurious layout — no Stats strip.' },
    cafe: { sections: ['hero', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Friendly layout — no Stats strip.' },
    minimal: { sections: ['hero', 'featured', 'story', 'cta', 'contact', 'colors', 'seo'], description: 'Text-focused layout — no images in hero, no Stats strip.' },
    grand: { sections: ['hero', 'stats', 'featured', 'story', 'gallery', 'layout', 'cta', 'contact', 'colors', 'seo'], description: 'Complete fine-dining layout — every section including a photo Gallery.' },
  };

  const activeSections = templateSections[activeTemplate]?.sections || templateSections.classic.sections;
  const templateDescription = templateSections[activeTemplate]?.description || '';
  const templateLabel = templates.find(t => t.id === activeTemplate)?.label || activeTemplate;

  const allTabs = [
    { id: 'hero', label: 'Hero' },
    { id: 'stats', label: 'Stats' },
    { id: 'featured', label: 'Featured Menu' },
    { id: 'story', label: 'Story' },
    { id: 'gallery', label: 'Gallery' },
    { id: 'layout', label: 'Sections' },
    { id: 'cta', label: 'CTA' },
    { id: 'contact', label: 'Contact' },
    { id: 'colors', label: 'Colors' },
    { id: 'seo', label: 'SEO' },
  ];

  return (
    <AdminLayout>
      <div className="p-6 max-w-4xl">
        <div className="mb-6 flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Homepage Editor</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Editing site for <span className="font-medium text-foreground">{restaurant?.name ?? 'your restaurant'}</span>
            </p>
          </div>
          {restaurant?.slug && (
            <a
              href={`/r/${restaurant.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" /> View live site
            </a>
          )}
        </div>

        <Tabs defaultValue="template">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="template">
              <Layout className="h-3.5 w-3.5 mr-1.5" />Template
            </TabsTrigger>
            {allTabs.map(tab => (
              <TabsTrigger
                key={tab.id}
                value={tab.id}
                disabled={!activeSections.includes(tab.id)}
                className={!activeSections.includes(tab.id) ? 'opacity-40 cursor-not-allowed' : ''}
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Template info banner */}
          <div className="mb-6 flex items-start gap-2 rounded-lg bg-muted/50 border border-border px-4 py-3">
            <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-foreground font-medium">
                Active template: <span className="text-primary">{templateLabel}</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{templateDescription}</p>
            </div>
          </div>

          <TabsContent value="template">
            <TemplateSelector />
          </TabsContent>

          <TabsContent value="hero">
            <HeroEditor
              data={sections?.hero?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'hero', content })}
              onChange={setDraftSection('hero')}
              saving={updateMutation.isPending}
              template={activeTemplate}
            />
          </TabsContent>
          <TabsContent value="stats">
            <StatsEditor
              data={sections?.stats?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'stats', content })}
              onChange={setDraftSection('stats')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="featured">
            <FeaturedMenuEditor
              data={sections?.featured_menu?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'featured_menu', content })}
              onChange={setDraftSection('featured_menu')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="story">
            <StoryEditor
              data={sections?.story?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'story', content })}
              onChange={setDraftSection('story')}
              saving={updateMutation.isPending}
              template={activeTemplate}
            />
          </TabsContent>
          <TabsContent value="gallery">
            <GalleryEditor
              data={sections?.gallery?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'gallery', content })}
              onChange={setDraftSection('gallery')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="layout">
            <SectionLayoutEditor
              data={sections?.section_layout?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'section_layout', content })}
              saving={updateMutation.isPending}
              onChange={setDraftSection('section_layout')}
              template={activeTemplate}
              draftData={sections?.section_layout_draft?.content}
              onPersistDraft={(content) => draftMutation.mutateAsync(content)}
            />
          </TabsContent>
          <TabsContent value="cta">
            <CTAEditor
              data={sections?.cta?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'cta', content })}
              onChange={setDraftSection('cta')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="contact">
            <ContactEditor
              data={sections?.contact?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'contact', content })}
              onChange={setDraftSection('contact')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="seo">
            <SEOEditor
              data={sections?.seo?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'seo', content })}
              onChange={setDraftSection('seo')}
              saving={updateMutation.isPending}
            />
          </TabsContent>
          <TabsContent value="colors">
            <ThemeColorsEditor
              data={sections?.theme_colors?.content}
              onSave={(content) => updateMutation.mutate({ sectionKey: 'theme_colors', content })}
              onChange={setDraftSection('theme_colors')}
              saving={updateMutation.isPending}
              template={activeTemplate}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <LivePreviewPanel slug={restaurant?.slug} template={activeTemplate} draft={draft} />
        </div>
      </div>
    </AdminLayout>
  );
}

function HeroEditor({ data, onSave, saving, onChange, template }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void; template?: string }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  const {
    upload, retry, cancel, uploading, progress, error: uploadError, fileName,
  } = useImageUpload({
    bucket: 'website-images',
    buildPath: (f) => `hero/hero-${Date.now()}.${f.name.split('.').pop()}`,
    upsert: true,
    compress: COMPRESS_PRESETS.hero,
    successMessage: 'Image uploaded',
    onUploaded: (url) => set('hero_image_url', url),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hero Section</CardTitle>
        <CardDescription>The main banner visitors see first</CardDescription>
        {template === 'minimal' && (
          <p className="text-xs text-amber-600 mt-1">ℹ️ Minimal template: Text-only hero — no background image is displayed.</p>
        )}
        {template === 'modern' && (
          <p className="text-xs text-amber-600 mt-1">ℹ️ Modern template: Split-screen layout — hero image shown on the right side.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1.5 block">Hero Background Image</Label>
          <div className="flex items-start gap-4">
            {form.hero_image_url ? (
              <img src={form.hero_image_url} alt="Hero preview" className="h-24 w-40 object-cover rounded-md border border-border" />
            ) : (
              <div className="h-24 w-40 rounded-md border border-dashed border-border flex items-center justify-center bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <input type="file" accept={ACCEPT_IMAGE_ATTR} onChange={handleImageUpload} className="hidden" />
                <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload Image'}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">{maxSizeHint('image')}</p>
              <UploadProgress
                uploading={uploading}
                progress={progress}
                error={uploadError}
                fileName={fileName}
                onRetry={retry}
                onCancel={cancel}
              />
              {form.hero_image_url && (
                <Button variant="ghost" size="sm" className="text-destructive justify-start" onClick={() => set('hero_image_url', '')}>
                  Remove image
                </Button>
              )}
            </div>
          </div>
        </div>
        <Field label="Overline Text" value={form.overline} onChange={v => set('overline', v)} />
        <Field label="Heading Line 1" value={form.heading_line1} onChange={v => set('heading_line1', v)} />
        <Field label="Heading Line 2" value={form.heading_line2} onChange={v => set('heading_line2', v)} />
        <div>
          <Label>Description</Label>
          <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Button Text" value={form.cta_primary_text} onChange={v => set('cta_primary_text', v)} />
          <DestinationField label="Primary Button Destination" value={form.cta_primary_link} onChange={v => set('cta_primary_link', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Secondary Button Text" value={form.cta_secondary_text} onChange={v => set('cta_secondary_text', v)} />
          <DestinationField label="Secondary Button Destination" value={form.cta_secondary_link} onChange={v => set('cta_secondary_link', v)} />
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <Switch checked={form.show_rating ?? true} onCheckedChange={v => set('show_rating', v)} />
            <Label>Show Rating Stars</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.show_stats ?? true} onCheckedChange={v => set('show_stats', v)} />
            <Label>Show Mini Stats</Label>
          </div>
        </div>
        <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Hero'}
        </Button>
      </CardContent>
    </Card>
  );
}

function StatsEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const [items, setItems] = useState<any[]>(data?.items || []);
  useEffect(() => { if (data?.items) setItems(data.items); }, [data]);
  useEffect(() => { onChange?.({ items }); }, [items]);

  const updateItem = (i: number, key: string, val: string) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [key]: val };
    setItems(updated);
  };
  const addItem = () => setItems([...items, { value: '', label: '', icon: '★' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stats Section</CardTitle>
        <CardDescription>Key metrics displayed below the hero</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item, i) => (
          <div key={i} className="grid grid-cols-[1fr_2fr_auto_auto] gap-3 items-end">
            <Field label={i === 0 ? 'Value' : undefined} value={item.value} onChange={v => updateItem(i, 'value', v)} placeholder="4.9" />
            <Field label={i === 0 ? 'Label' : undefined} value={item.label} onChange={v => updateItem(i, 'label', v)} placeholder="Google Rating" />
            <Field label={i === 0 ? 'Icon' : undefined} value={item.icon} onChange={v => updateItem(i, 'icon', v)} placeholder="★" />
            <Button variant="ghost" size="icon" onClick={() => removeItem(i)} className="text-destructive h-10 w-10">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button variant="outline" size="sm" onClick={addItem} className="gap-2">
          <Plus className="h-4 w-4" /> Add Stat
        </Button>
        <div>
          <Button onClick={() => onSave({ items })} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Stats'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StoryEditor({ data, onSave, saving, onChange, template }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void; template?: string }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  const {
    upload, retry, cancel, uploading, progress, error: uploadError, fileName,
  } = useImageUpload({
    bucket: 'website-images',
    buildPath: (f) => `story/story-${Date.now()}.${f.name.split('.').pop()}`,
    upsert: true,
    compress: COMPRESS_PRESETS.hero,
    successMessage: 'Image uploaded',
    onUploaded: (url) => set('story_image_url', url),
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Story Section</CardTitle>
        <CardDescription>Tell visitors about your restaurant</CardDescription>
        {template === 'classic' && (
          <p className="text-xs text-muted-foreground mt-1">ℹ️ Classic template: Shows story image + badge alongside text.</p>
        )}
        {(template === 'modern' || template === 'elegant' || template === 'minimal') && (
          <p className="text-xs text-muted-foreground mt-1">ℹ️ This template: Text-only story — no image or badge shown.</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="mb-1.5 block">Story Image</Label>
          <div className="flex items-start gap-4">
            {form.story_image_url ? (
              <img src={form.story_image_url} alt="Story preview" className="h-24 w-40 object-cover rounded-md border border-border" />
            ) : (
              <div className="h-24 w-40 rounded-md border border-dashed border-border flex items-center justify-center bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <input type="file" accept={ACCEPT_IMAGE_ATTR} onChange={handleImageUpload} className="hidden" />
                <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload Image'}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">{maxSizeHint('image')}</p>
              <UploadProgress
                uploading={uploading}
                progress={progress}
                error={uploadError}
                fileName={fileName}
                onRetry={retry}
                onCancel={cancel}
              />
              {form.story_image_url && (
                <Button variant="ghost" size="sm" className="text-destructive justify-start" onClick={() => set('story_image_url', '')}>
                  Remove image
                </Button>
              )}
            </div>
          </div>
        </div>
        <Field label="Overline" value={form.overline} onChange={v => set('overline', v)} />
        <Field label="Heading Line 1" value={form.heading_line1} onChange={v => set('heading_line1', v)} />
        <Field label="Heading Line 2" value={form.heading_line2} onChange={v => set('heading_line2', v)} />
        <div>
          <Label>Paragraph 1</Label>
          <Textarea value={form.paragraph1 || ''} onChange={e => set('paragraph1', e.target.value)} rows={3} />
        </div>
        <div>
          <Label>Paragraph 2</Label>
          <Textarea value={form.paragraph2 || ''} onChange={e => set('paragraph2', e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Button Text" value={form.cta_text} onChange={v => set('cta_text', v)} />
          <DestinationField label="Button Destination" value={form.cta_link} onChange={v => set('cta_link', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Badge Value" value={form.badge_value} onChange={v => set('badge_value', v)} placeholder="5+" />
          <Field label="Badge Label" value={form.badge_label} onChange={v => set('badge_label', v)} placeholder="Years" />
        </div>
        <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Story'}
        </Button>
      </CardContent>
    </Card>
  );
}

function CTAEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Call to Action</CardTitle>
        <CardDescription>Final section encouraging action</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Overline" value={form.overline} onChange={v => set('overline', v)} />
        <Field label="Heading Line 1" value={form.heading_line1} onChange={v => set('heading_line1', v)} />
        <Field label="Heading Line 2" value={form.heading_line2} onChange={v => set('heading_line2', v)} />
        <div>
          <Label>Description</Label>
          <Textarea value={form.description || ''} onChange={e => set('description', e.target.value)} rows={3} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Primary Button Text" value={form.cta_primary_text} onChange={v => set('cta_primary_text', v)} />
          <DestinationField label="Primary Button Destination" value={form.cta_primary_link} onChange={v => set('cta_primary_link', v)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Secondary Button Text" value={form.cta_secondary_text} onChange={v => set('cta_secondary_text', v)} />
          <DestinationField label="Secondary Button Destination" value={form.cta_secondary_link} onChange={v => set('cta_secondary_link', v)} />
        </div>
        <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save CTA'}
        </Button>
      </CardContent>
    </Card>
  );
}

interface GalleryImage {
  id?: string;
  url: string;
  thumb_url?: string;
  caption?: string;
  alt?: string;
  focus_x?: number;
  focus_y?: number;
  zoom?: number;
}

const GALLERY_MAX_IMAGES = 12;

const FOCUS_PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Top left', x: 0, y: 0 }, { label: 'Top', x: 50, y: 0 }, { label: 'Top right', x: 100, y: 0 },
  { label: 'Left', x: 0, y: 50 }, { label: 'Center', x: 50, y: 50 }, { label: 'Right', x: 100, y: 50 },
  { label: 'Bottom left', x: 0, y: 100 }, { label: 'Bottom', x: 50, y: 100 }, { label: 'Bottom right', x: 100, y: 100 },
];

const ALT_MIN = 5;
const ALT_MAX = 125;
const ALT_REDUNDANT = /^(image|photo|picture|pic|img)(\s+(of|showing))?\b[\s:_-]*$/i;
const ALT_PREFIX = /^\s*(image|photo|picture|graphic)\s+of\s+/i;

type AltCheck = { level: 'error' | 'warning' | 'ok'; message: string };

/** Validates gallery alt text: required, sane length, no filenames or redundant prefixes. */
function validateAltText(raw: string | undefined): AltCheck {
  const value = (raw || '').trim();
  if (!value) return { level: 'error', message: 'Alt text is required — screen readers will otherwise announce a generic label.' };
  if (value.length < ALT_MIN) return { level: 'error', message: `Too short — use at least ${ALT_MIN} characters to describe the photo.` };
  if (value.length > ALT_MAX) return { level: 'error', message: `Too long — keep it under ${ALT_MAX} characters.` };
  if (/\.(jpe?g|png|webp|gif|avif)\s*$/i.test(value)) return { level: 'error', message: 'This looks like a file name. Describe what the photo shows instead.' };
  if (ALT_REDUNDANT.test(value)) return { level: 'error', message: 'Describe the subject of the photo, not that it is an image.' };
  if (/^https?:\/\//i.test(value)) return { level: 'error', message: 'Alt text cannot be a URL.' };
  if (ALT_PREFIX.test(value)) return { level: 'warning', message: 'Drop the “image of” prefix — screen readers already announce it as an image.' };
  if (value.length > 100) return { level: 'warning', message: 'Quite long — aim for a concise, single-sentence description.' };
  return { level: 'ok', message: 'Looks good.' };
}


function SortableGalleryTile({
  image,
  index,
  total,
  onMove,
  onField,
  onRemove,
}: {
  image: GalleryImage;
  index: number;
  total: number;
  onMove: (to: number) => void;
  onField: (patch: Partial<GalleryImage>) => void;
  onRemove: () => void;
}) {
  const id = image.id || image.url;
  const reduceMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition: reduceMotion ? 'none' : transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const altId = `gallery-alt-${id}`;
  const altMsgId = `gallery-alt-msg-${id}`;
  const altCheck = validateAltText(image.alt);
  const altLen = (image.alt || '').length;
  const capId = `gallery-caption-${id}`;

  const posId = `gallery-pos-${id}`;
  const fx = typeof image.focus_x === 'number' ? image.focus_x : 50;
  const fy = typeof image.focus_y === 'number' ? image.focus_y : 50;
  const zoom = Math.min(2, Math.max(1, Number(image.zoom) || 1));
  const [cropOpen, setCropOpen] = useState(false);
  const cropPanelRef = useRef<HTMLDivElement>(null);
  const cropToggleRef = useRef<HTMLButtonElement>(null);
  const focusPickerRef = useRef<HTMLDivElement>(null);
  const cropPanelId = `gallery-crop-panel-${id}`;

  const focusHelpId = `gallery-focus-help-${id}`;

  // Move focus into the panel when it opens so screen reader users land on the control they asked for.
  useEffect(() => {
    if (!cropOpen) return;
    const target = focusPickerRef.current
      || cropPanelRef.current?.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    target?.focus();
  }, [cropOpen]);

  const closeCrop = () => {
    setCropOpen(false);
    // Return focus to the disclosure trigger so context is never lost.
    requestAnimationFrame(() => cropToggleRef.current?.focus());
  };

  // Trap Tab inside the open panel; Escape closes and restores focus.
  const handlePanelKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      closeCrop();
      return;
    }
    if (e.key !== 'Tab') return;
    const panel = cropPanelRef.current;
    if (!panel) return;
    const focusables = Array.from(
      panel.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'),
    ).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && (active === first || !panel.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  };


  const setFocusFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
    onField({ focus_x: x, focus_y: y });
  };

  const handleFocusKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 10 : 2;
    const clamp = (n: number) => Math.min(100, Math.max(0, n));
    const moves: Record<string, () => void> = {
      ArrowLeft: () => onField({ focus_x: clamp(fx - step) }),
      ArrowRight: () => onField({ focus_x: clamp(fx + step) }),
      ArrowUp: () => onField({ focus_y: clamp(fy - step) }),
      ArrowDown: () => onField({ focus_y: clamp(fy + step) }),
      Home: () => onField({ focus_x: 0, focus_y: 0 }),
      End: () => onField({ focus_x: 100, focus_y: 100 }),
      Enter: () => onField({ focus_x: 50, focus_y: 50 }),
      ' ': () => onField({ focus_x: 50, focus_y: 50 }),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    move();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      role="listitem"
      aria-label={`Gallery image ${index + 1}${image.alt ? `: ${image.alt}` : ''}`}
      className="rounded-md border border-border overflow-hidden bg-muted/30"
    >
      <div className="relative">
        <img
          src={image.thumb_url || image.url}
          alt={image.alt || image.caption || `Gallery ${index + 1}`}
          loading="lazy"
          className="w-full h-28 object-cover"
          style={{ objectPosition: `${fx}% ${fy}%`, transform: zoom !== 1 ? `scale(${zoom})` : undefined }}
        />
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Reorder image ${index + 1}. Press space, then use arrow keys to move it.`}
          aria-roledescription="Sortable image handle"
          className="absolute top-1.5 left-1.5 rounded bg-background/80 backdrop-blur p-1 cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="absolute top-1.5 right-1.5 rounded bg-background/80 backdrop-blur px-1.5 text-[11px] font-medium text-muted-foreground">
          {index + 1}
        </span>
      </div>
      <div className="p-2 space-y-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={index === 0}
            aria-label={`Move image ${index + 1} earlier`}
            onClick={() => onMove(index - 1)}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            disabled={index === total - 1}
            aria-label={`Move image ${index + 1} later`}
            onClick={() => onMove(index + 1)}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <label htmlFor={posId} className="sr-only">Position of image {index + 1}</label>
            <select
              id={posId}
              value={index + 1}
              onChange={e => onMove(Number(e.target.value) - 1)}
              className="h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {Array.from({ length: total }, (_, n) => (
                <option key={n} value={n + 1}>Position {n + 1} of {total}</option>
              ))}
            </select>
          </div>
        </div>


        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor={altId} className="text-[11px] text-muted-foreground">Alt text (for screen readers)</Label>
            <span className={`text-[10px] tabular-nums ${altLen > ALT_MAX ? 'text-destructive' : 'text-muted-foreground'}`}>
              {altLen}/{ALT_MAX}
            </span>
          </div>
          <Input
            id={altId}
            value={image.alt || ''}
            placeholder="e.g. Wood-fired lamb chops plated with charred lemon"
            maxLength={ALT_MAX}
            aria-invalid={altCheck.level === 'error'}
            aria-describedby={altMsgId}
            onChange={e => onField({ alt: e.target.value })}
            onBlur={e => {
              const trimmed = e.target.value.replace(/\s+/g, ' ').trim();
              if (trimmed !== e.target.value) onField({ alt: trimmed });
            }}
            className={altCheck.level === 'error' ? 'border-destructive focus-visible:ring-destructive' : undefined}
          />
          <p
            id={altMsgId}
            className={`text-[11px] ${altCheck.level === 'error' ? 'text-destructive' : altCheck.level === 'warning' ? 'text-amber-600 dark:text-amber-500' : 'text-muted-foreground'}`}
          >
            {altCheck.message}
          </p>
        </div>

        <div className="space-y-1">
          <Label htmlFor={capId} className="text-[11px] text-muted-foreground">Caption (shown on hover)</Label>
          <Input id={capId} value={image.caption || ''} placeholder="Caption (optional)" onChange={e => onField({ caption: e.target.value })} />
        </div>

        <div className="rounded-md border border-border/60 bg-background/60">
          <button
            type="button"
            ref={cropToggleRef}
            onClick={() => (cropOpen ? closeCrop() : setCropOpen(true))}
            className="w-full flex items-center justify-between px-2 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            aria-expanded={cropOpen}
            aria-controls={cropPanelId}
          >
            <span className="inline-flex items-center gap-1.5"><Crop className="h-3.5 w-3.5" /> Crop &amp; focus</span>
            <span>{fx === 50 && fy === 50 && zoom === 1 ? 'Default' : `${fx}% ${fy}% · ${zoom.toFixed(2)}x`}</span>
          </button>
          {cropOpen && (
            <div
              id={cropPanelId}
              ref={cropPanelRef}
              role="group"
              aria-label={`Crop and focus controls for image ${index + 1}`}
              onKeyDown={handlePanelKeyDown}
              className="p-2 pt-0 space-y-2"
            >
              <p id={focusHelpId} className="text-[11px] text-muted-foreground">
                Click the photo — or focus it and use the arrow keys (hold Shift for larger steps) — to set the point that must stay visible on every screen size. Press Escape to close these controls and return to the Crop &amp; focus button.
              </p>
              <div
                ref={focusPickerRef}
                className="relative w-full aspect-[4/5] overflow-hidden rounded cursor-crosshair bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                onClick={setFocusFromEvent}
                onKeyDown={handleFocusKeyDown}
                tabIndex={0}
                role="application"
                aria-label={`Focal point for image ${index + 1}: ${fx}% from left, ${fy}% from top. Use arrow keys to adjust.`}
                aria-describedby={focusHelpId}
              >

                <img
                  src={image.thumb_url || image.url}
                  alt=""
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: `${fx}% ${fy}%`, transform: zoom !== 1 ? `scale(${zoom})` : undefined }}
                />
                <span
                  className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary bg-primary/30 pointer-events-none"
                  style={{ left: `${fx}%`, top: `${fy}%` }}
                />
              </div>
              <p aria-live="polite" className="sr-only">{`Focal point ${fx}% from left, ${fy}% from top, zoom ${zoom.toFixed(2)} times`}</p>
              <div role="group" aria-label={`Focal point presets for image ${index + 1}`} className="grid grid-cols-3 gap-1">
                {FOCUS_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    aria-label={`${p.label} focus for image ${index + 1}`}
                    aria-pressed={fx === p.x && fy === p.y}
                    title={p.label}
                    onClick={() => onField({ focus_x: p.x, focus_y: p.y })}
                    className={`h-7 rounded border text-[10px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${fx === p.x && fy === p.y ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
                  >
                    <span aria-hidden="true">•</span>
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <Label htmlFor={`gallery-zoom-${id}`} className="text-[11px] text-muted-foreground">Zoom {zoom.toFixed(2)}x</Label>
                <input
                  id={`gallery-zoom-${id}`}
                  type="range"
                  min={1}
                  max={2}
                  step={0.05}
                  value={zoom}
                  onChange={e => onField({ zoom: Number(e.target.value) })}
                  className="w-full accent-primary"
                />
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 flex-1 text-[11px]"
                  onClick={() => onField({ focus_x: 50, focus_y: 50, zoom: 1 })}
                >
                  Reset crop
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 flex-1 text-[11px]"
                  onClick={closeCrop}
                >
                  Done
                </Button>
              </div>

            </div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">{image.thumb_url ? 'Thumbnail ready' : 'Full size only'}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label={`Remove image ${index + 1}`} onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function GalleryEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const [form, setForm] = useState<any>(data || {});
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!data) return;
    // Backfill stable ids so drag-and-drop keys never collide on duplicate URLs.
    const withIds = {
      ...data,
      images: (data.images || []).map((img: GalleryImage, i: number) => ({
        ...img,
        id: img.id || `${img.url || 'img'}-${i}`,
      })),
    };
    setForm(withIds);
    setDirty(false);
  }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));
  const images: GalleryImage[] = form.images || [];
  const columns = Number(form.columns) || 4;

  const setImages = (next: GalleryImage[]) => { setDirty(true); set('images', next); };

  const [orderAnnouncement, setOrderAnnouncement] = useState('');

  const moveImage = (from: number, to: number) => {
    const list: GalleryImage[] = form.images || [];
    if (to < 0 || to >= list.length || to === from) return;
    setImages(arrayMove(list, from, to));
    const label = list[from]?.alt || list[from]?.caption || `Image ${from + 1}`;
    setOrderAnnouncement(`${label} moved to position ${to + 1} of ${list.length}.`);
  };


  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = images.map((img, i) => img.id || img.url || String(i));

  const altIssues = images.reduce(
    (acc, img, i) => {
      const level = validateAltText(img.alt).level;
      if (level === 'error') { acc.errors += 1; acc.errorPositions.push(i + 1); }
      else if (level === 'warning') acc.warnings += 1;
      return acc;
    },
    { errors: 0, warnings: 0, errorPositions: [] as number[] },
  );



  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(active.id as string);
    const newIndex = ids.indexOf(over.id as string);
    if (oldIndex < 0 || newIndex < 0) return;
    setImages(arrayMove(images, oldIndex, newIndex));
  };

  const uploadFiles = async (files: File[]) => {
    const room = GALLERY_MAX_IMAGES - images.length;
    if (room <= 0) {
      toast.error(`Gallery is limited to ${GALLERY_MAX_IMAGES} images`);
      return;
    }
    const batch = files.slice(0, room);
    if (files.length > room) toast.info(`Only the first ${room} image(s) were added`);

    setUploading(true);
    setUploadError(null);
    const added: GalleryImage[] = [];
    const rejected: string[] = [];

    try {
      for (let i = 0; i < batch.length; i++) {
        const file = batch[i];
        setFileName(file.name);
        setProgress(0);

        const check = await inspectImageFile(file, 'image');
        if (!check.ok) {
          rejected.push(`${file.name} — ${check.reason}`);
          continue;
        }

        const stamp = `${Date.now()}-${i}`;
        const ext = safeImageExtension(file, check.mime);

        const full = await compressImage(file, COMPRESS_PRESETS.content);
        const { publicUrl } = await uploadWithProgress({
          bucket: 'website-images',
          path: `gallery/gallery-${stamp}.${ext}`,
          file: full,
          upsert: true,
          onProgress: p => setProgress(Math.round(p * 0.8)),
        });

        // Automatic thumbnail for fast grid rendering.
        let thumbUrl: string | undefined;
        try {
          const thumb = await compressImage(file, COMPRESS_PRESETS.thumbnail);
          const res = await uploadWithProgress({
            bucket: 'website-images',
            path: `gallery/thumb-${stamp}.${ext}`,
            file: thumb,
            upsert: true,
            onProgress: p => setProgress(80 + Math.round(p * 0.2)),
          });
          thumbUrl = res.publicUrl;
        } catch {
          thumbUrl = undefined;
        }

        added.push({ id: `${stamp}-${Math.random().toString(36).slice(2, 8)}`, url: publicUrl, thumb_url: thumbUrl, caption: '' });
      }

      if (added.length) {
        setForm((p: any) => ({ ...p, images: [...(p.images || []), ...added] }));
        toast.success(`${added.length} image${added.length > 1 ? 's' : ''} added to gallery`);
      }
      if (rejected.length) {
        toast.error(
          `${rejected.length} file${rejected.length > 1 ? 's were' : ' was'} skipped`,
          { description: rejected.slice(0, 4).join('\n') + (rejected.length > 4 ? `\n+${rejected.length - 4} more` : '') },
        );
      }

    } catch (e: any) {
      const message = e?.message || 'Upload failed';
      setUploadError(message);
      toast.error(message);
    } finally {
      setUploading(false);
      setProgress(0);
      setFileName(null);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length) await uploadFiles(files);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Gallery Section</CardTitle>
        <CardDescription>Photo grid shown on the homepage. Drag tiles to reorder; thumbnails are generated automatically.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Overline Text" value={form.overline} onChange={v => set('overline', v)} placeholder="Gallery" />
        <Field label="Heading" value={form.heading} onChange={v => set('heading', v)} placeholder="Moments at the Table" />
        <Field label="Description" value={form.description} onChange={v => set('description', v)} placeholder="A glimpse inside the dining room" />

        <div>
          <Label className="mb-1.5 block">Images per row</Label>
          <Select value={String(columns)} onValueChange={v => set('columns', Number(v))}>
            <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map(n => (
                <SelectItem key={n} value={String(n)}>{n} per row</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Applies on large screens; mobile always shows two per row.</p>
        </div>

        <div>
          <Label className="mb-1.5 flex items-center gap-2">
            <span>Images ({images.length}/{GALLERY_MAX_IMAGES}) — drag, or use the move buttons on each tile</span>
            {dirty && <span className="text-xs font-normal text-amber-600">Unsaved order — click Save Gallery to publish</span>}
          </Label>

          <p aria-live="polite" className="sr-only">{orderAnnouncement}</p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={ids} strategy={rectSortingStrategy}>
              <div role="list" aria-label="Gallery images. Each tile has move earlier and move later buttons, and a position selector." className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map((img, i) => (
                  <SortableGalleryTile
                    key={ids[i]}
                    image={img}
                    index={i}
                    total={images.length}
                    onMove={(to) => moveImage(i, to)}
                    onField={(patch) => {
                      const next = [...images];
                      next[i] = { ...next[i], ...patch };
                      setImages(next);
                    }}
                    onRemove={() => setImages(images.filter((_, idx) => idx !== i))}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>


          <div className="mt-3 flex flex-col gap-2">
            <label className={`cursor-pointer ${images.length >= GALLERY_MAX_IMAGES || uploading ? 'pointer-events-none opacity-50' : ''}`}>
              <input type="file" accept={ACCEPT_IMAGE_ATTR} multiple onChange={handleUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent transition-colors">
                <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Add Images'}
              </span>
            </label>
            <p className="text-xs text-muted-foreground">Select multiple files at once · {IMAGE_FORMAT_HINT} · {maxSizeHint('image')} · min 32×32px</p>
            <UploadProgress uploading={uploading} progress={progress} error={uploadError} fileName={fileName} onRetry={() => {}} onCancel={() => {}} />
          </div>
        </div>

        {altIssues.errors > 0 && (
          <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              {altIssues.errors} image{altIssues.errors > 1 ? 's need' : ' needs'} valid alt text before you can save
              {altIssues.errorPositions.length > 0 && <> (position{altIssues.errorPositions.length > 1 ? 's' : ''} {altIssues.errorPositions.join(', ')})</>}.
            </span>
          </div>
        )}
        {altIssues.errors === 0 && altIssues.warnings > 0 && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            {altIssues.warnings} alt text{altIssues.warnings > 1 ? 's' : ''} could be improved — check the highlighted tiles.
          </p>
        )}

        <Button
          onClick={() => {
            if (altIssues.errors > 0) {
              toast.error('Add alt text to every gallery image before saving');
              return;
            }
            onSave({ ...form, images: images.map(img => ({ ...img, alt: (img.alt || '').replace(/\s+/g, ' ').trim() })) });
            setDirty(false);
          }}
          disabled={saving || altIssues.errors > 0}
          className="gap-2"
        >
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Gallery'}
        </Button>


      </CardContent>
    </Card>
  );
}

function ContactEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Information</CardTitle>
        <CardDescription>Address, phone, email, and hours shown on the Contact page</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Address Line 1" value={form.address_line1} onChange={v => set('address_line1', v)} placeholder="123 Culinary Street" />
        <Field label="Address Line 2" value={form.address_line2} onChange={v => set('address_line2', v)} placeholder="Food District, FC 12345" />
        <Field label="Phone" value={form.phone} onChange={v => set('phone', v)} placeholder="+1 (555) 123-4567" />
        <Field label="Email" value={form.email} onChange={v => set('email', v)} placeholder="hello@restaurant.com" />
        <Field label="Weekday Hours" value={form.hours_weekday} onChange={v => set('hours_weekday', v)} placeholder="Mon–Fri: 11am – 10pm" />
        <Field label="Weekend Hours" value={form.hours_weekend} onChange={v => set('hours_weekend', v)} placeholder="Sat–Sun: 10am – 11pm" />
        <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Contact'}
        </Button>
      </CardContent>
    </Card>
  );
}

function FeaturedMenuEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [form, setForm] = useState(data || { item_ids: [], heading: 'Popular Dishes', overline: 'Our Menu' });
  const [selectedIds, setSelectedIds] = useState<string[]>(data?.item_ids || []);
  useEffect(() => { onChange?.({ ...form, item_ids: selectedIds }); }, [form, selectedIds]);
  useEffect(() => {
    if (data) {
      setForm(data);
      setSelectedIds(data.item_ids || []);
    }
  }, [data]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  const { data: allItems } = useQuery({
    queryKey: ['all-menu-items-for-featured', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data: items } = await supabase
        .from('menu_items')
        .select('id, name, image_url, price, categories(name)')
        .eq('restaurant_id', restaurantId!)
        .eq('is_available', true)
        .order('sort_order');
      return items || [];
    },
  });

  const toggleItem = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds(prev => {
        const oldIndex = prev.indexOf(active.id as string);
        const newIndex = prev.indexOf(over.id as string);
        return arrayMove(prev, oldIndex, newIndex);
      });
    }
  };

  const handleSave = () => {
    onSave({ ...form, item_ids: selectedIds });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Featured Menu</CardTitle>
        <CardDescription>Choose which menu items to highlight on the homepage (select up to 6)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Section Overline" value={form.overline} onChange={v => set('overline', v)} placeholder="Our Menu" />
          <Field label="Section Heading" value={form.heading} onChange={v => set('heading', v)} placeholder="Popular Dishes" />
        </div>

        {selectedIds.length > 0 && (
          <div>
            <Label className="mb-1.5 block">Selected Items ({selectedIds.length}) — drag to reorder</Label>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                <div className="rounded-lg border border-border divide-y divide-border">
                  {selectedIds.map(id => {
                    const item = allItems?.find(i => i.id === id);
                    return (
                      <SortableSelectedItem key={id} id={id} name={item?.name || id.slice(0, 8)} imageUrl={item?.image_url} onRemove={() => toggleItem(id)} />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        <div>
          <Label className="mb-1.5 block">All Menu Items</Label>
          <div className="max-h-80 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {(allItems || []).map(item => (
              <label key={item.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors">
                <Checkbox
                  checked={selectedIds.includes(item.id)}
                  onCheckedChange={() => toggleItem(item.id)}
                />
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                      <ChefHat className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{(item as any).categories?.name}</p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Featured Menu'}
        </Button>
      </CardContent>
    </Card>
  );
}

function SEOEditor({ data, onSave, saving, onChange }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void }) {
  const [form, setForm] = useState(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);
  const set = (key: string, val: any) => setForm((p: any) => ({ ...p, [key]: val }));

  const {
    upload, retry, cancel, uploading, progress, error: uploadError, fileName,
  } = useImageUpload({
    bucket: 'website-images',
    buildPath: (f) => `seo/og-image-${Date.now()}.${f.name.split('.').pop()}`,
    upsert: true,
    // Social previews (WhatsApp, LinkedIn…) handle WebP poorly — keep JPEG/PNG.
    compress: { ...COMPRESS_PRESETS.hero, format: 'original' },
    successMessage: 'OG image uploaded',
    onUploaded: (url) => set('og_image_url', url),
  });

  const handleOgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) await upload(file);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>SEO Settings</CardTitle>
        <CardDescription>Meta title, description, and social sharing image for search engines</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Meta Title" value={form.meta_title} onChange={v => set('meta_title', v)} placeholder="My Restaurant — Fine Dining" />
        <p className="text-xs text-muted-foreground -mt-2">{(form.meta_title || '').length}/60 characters recommended</p>
        <div>
          <Label className="mb-1.5 block">Meta Description</Label>
          <Textarea value={form.meta_description || ''} onChange={e => set('meta_description', e.target.value)} rows={3} placeholder="A brief description of your restaurant for search results..." />
          <p className="text-xs text-muted-foreground mt-1">{(form.meta_description || '').length}/160 characters recommended</p>
        </div>
        <div>
          <Label className="mb-1.5 block">OG / Social Share Image</Label>
          <p className="text-xs text-muted-foreground mb-2">Recommended size: 1200×630px. Shown when your site is shared on social media.</p>
          <div className="flex items-start gap-4">
            {form.og_image_url ? (
              <img src={form.og_image_url} alt="OG preview" className="h-24 w-[calc(24*1200/630)] max-w-48 object-cover rounded-md border border-border" />
            ) : (
              <div className="h-24 w-44 rounded-md border border-dashed border-border flex items-center justify-center bg-muted">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex flex-col gap-2">
              <label className="cursor-pointer">
                <input type="file" accept={ACCEPT_IMAGE_ATTR} onChange={handleOgUpload} className="hidden" />
                <span className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md border border-input bg-background hover:bg-accent transition-colors">
                  <Upload className="h-4 w-4" /> {uploading ? 'Uploading...' : 'Upload Image'}
                </span>
              </label>
              <p className="text-xs text-muted-foreground">{maxSizeHint('image')}</p>
              <UploadProgress
                uploading={uploading}
                progress={progress}
                error={uploadError}
                fileName={fileName}
                onRetry={retry}
                onCancel={cancel}
              />
              {form.og_image_url && (
                <Button variant="ghost" size="sm" className="text-destructive justify-start" onClick={() => set('og_image_url', '')}>
                  Remove image
                </Button>
              )}
            </div>
          </div>
        </div>
        <Field
          label="Canonical URL (optional)"
          value={form.canonical_url}
          onChange={v => set('canonical_url', v)}
          placeholder="https://yourrestaurant.com/"
        />
        <p className="text-xs text-muted-foreground -mt-2">
          Leave blank to use the page's own address. Set this only if your site is reachable at several domains.
        </p>
        <div className="flex items-center gap-2 rounded-md border border-border p-3">
          <Switch checked={!!form.noindex} onCheckedChange={v => set('noindex', v)} />
          <div>
            <Label>Hide from search engines</Label>
            <p className="text-xs text-muted-foreground">Adds a noindex tag — use while your site is still under construction.</p>
          </div>
        </div>
        <div className="rounded-md border border-border p-4 bg-muted/30">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Search result preview</p>
          <p className="text-xs text-emerald-600 truncate">{form.canonical_url || 'yourrestaurant.serveos.net'}</p>
          <p className="text-base text-primary truncate">{form.meta_title || 'Your Restaurant — Menu & Reservations'}</p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {form.meta_description || 'Add a meta description so search engines show your own wording here.'}
          </p>
        </div>
        <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save SEO'}
        </Button>
      </CardContent>
    </Card>
  );
}


function SortableSelectedItem({ id, name, imageUrl, onRemove }: { id: string; name: string; imageUrl?: string | null; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-3 px-3 py-2.5 bg-background">
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground shrink-0">
        <GripVertical className="h-4 w-4" />
      </button>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-8 w-8 rounded object-cover shrink-0" />
      ) : (
        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
          <ChefHat className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className="text-sm font-medium text-foreground flex-1 truncate">{name}</span>
      <button onClick={onRemove} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}



// Template-specific color configurations
const templateColorConfigs: Record<string, { label: string; fields: { key: string; label: string; defaultValue: string; description: string }[] }> = {
  classic: {
    label: 'Classic',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#070707', description: 'Main background color' },
      { key: 'accent', label: 'Accent Color', defaultValue: '#f59e0b', description: 'Buttons, highlights, and accents' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#ffffff', description: 'Main heading text color' },
    ],
  },
  modern: {
    label: 'Modern',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#0a0a0a', description: 'Main dark background' },
      { key: 'accent', label: 'Accent Color', defaultValue: '#f59e0b', description: 'Amber highlights and buttons' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#ffffff', description: 'Heading text color' },
    ],
  },
  bistro: {
    label: 'Bistro',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#1a120b', description: 'Warm brown background' },
      { key: 'accent', label: 'Accent Color', defaultValue: '#d97706', description: 'Amber/gold buttons and accents' },
      { key: 'accent_light', label: 'Accent Light', defaultValue: '#fbbf24', description: 'Stars, ratings, lighter accent' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#ffffff', description: 'Heading text color' },
    ],
  },
  elegant: {
    label: 'Elegant',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#0d0d0d', description: 'Deep black background' },
      { key: 'accent', label: 'Gold Accent', defaultValue: '#f59e0b', description: 'Gold highlights and accents' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#ffffff', description: 'Heading text color' },
    ],
  },
  cafe: {
    label: 'Café',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#faf6f1', description: 'Warm cream background' },
      { key: 'bg_secondary', label: 'Story Background', defaultValue: '#f3ece3', description: 'Slightly darker section background' },
      { key: 'accent', label: 'Accent Color', defaultValue: '#f59e0b', description: 'Amber buttons and accents' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#2a1f14', description: 'Dark brown heading text' },
    ],
  },
  minimal: {
    label: 'Minimal',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#ffffff', description: 'Clean white background' },
      { key: 'bg_secondary', label: 'Section Background', defaultValue: '#fafafa', description: 'Subtle section contrast' },
      { key: 'accent', label: 'Button Color', defaultValue: '#171717', description: 'Button and strong text color' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#171717', description: 'Main heading color' },
    ],
  },
  grand: {
    label: 'Grand',
    fields: [
      { key: 'bg_primary', label: 'Page Background', defaultValue: '#0a0a0a', description: 'Deep black background' },
      { key: 'bg_secondary', label: 'Story Background', defaultValue: '#1a1508', description: 'Warm panel behind the story section' },
      { key: 'accent', label: 'Gold Accent', defaultValue: '#c9a227', description: 'Buttons, rules and overlines' },
      { key: 'accent_light', label: 'Gold Light', defaultValue: '#e6c65c', description: 'Prices, italic headings, highlights' },
      { key: 'text_primary', label: 'Primary Text', defaultValue: '#f5f0e6', description: 'Cream heading and body text' },
    ],
  },
};

function ThemeColorsEditor({ data, onSave, saving, onChange, template }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void; template: string }) {
  const config = templateColorConfigs[template];
  const [form, setForm] = useState<Record<string, Record<string, string>>>(data || {});
  useEffect(() => { if (data) setForm(data); }, [data]);
  useEffect(() => { onChange?.(form); }, [form]);

  if (!config) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Theme Colors</CardTitle>
          <CardDescription>Color customization is not available for this template.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const templateColors = form[template] || {};
  const setColor = (key: string, val: string) => {
    setForm(prev => ({
      ...prev,
      [template]: { ...(prev[template] || {}), [key]: val },
    }));
  };

  const resetToDefaults = () => {
    const defaults: Record<string, string> = {};
    config.fields.forEach(f => { defaults[f.key] = f.defaultValue; });
    setForm(prev => ({ ...prev, [template]: defaults }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Theme Colors</CardTitle>
        <CardDescription>
          Customize the color palette for the <span className="font-semibold text-foreground">{config.label}</span> template.
          Colors are saved per-template — switching templates preserves each template's colors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {config.fields.map(field => (
            <div key={field.key} className="space-y-1.5">
              <Label className="text-sm">{field.label}</Label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={templateColors[field.key] || field.defaultValue}
                    onChange={e => setColor(field.key, e.target.value)}
                    className="h-10 w-14 rounded-md border border-input cursor-pointer bg-transparent p-0.5"
                  />
                </div>
                <Input
                  value={templateColors[field.key] || field.defaultValue}
                  onChange={e => setColor(field.key, e.target.value)}
                  className="flex-1 font-mono text-xs"
                  placeholder={field.defaultValue}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{field.description}</p>
            </div>
          ))}
        </div>

        {/* Preview strip */}
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="px-4 py-2 bg-muted text-xs font-medium text-muted-foreground">Color Preview</div>
          <div
            className="p-6 flex items-center justify-center gap-4"
            style={{ backgroundColor: templateColors.bg_primary || config.fields.find(f => f.key === 'bg_primary')?.defaultValue }}
          >
            <span
              className="text-lg font-bold"
              style={{ color: templateColors.text_primary || config.fields.find(f => f.key === 'text_primary')?.defaultValue }}
            >
              Sample Heading
            </span>
            <span
              className="px-4 py-2 rounded-full text-sm font-semibold"
              style={{
                backgroundColor: templateColors.accent || config.fields.find(f => f.key === 'accent')?.defaultValue,
                color: template === 'minimal' || template === 'cafe' ? '#ffffff' : '#000000',
              }}
            >
              Button
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={() => onSave(form)} disabled={saving} className="gap-2">
            <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Colors'}
          </Button>
          <Button variant="outline" onClick={resetToDefaults} className="text-sm">
            Reset to Defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, placeholder }: { label?: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <Input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function DestinationField({ label, value, onChange }: { label?: string; value: string; onChange: (v: string) => void }) {
  const preset = isPresetDestination(value) ? value : (value ? CTA_CUSTOM : '/menu');
  const [custom, setCustom] = useState(preset === CTA_CUSTOM ? value || '' : '');

  useEffect(() => {
    if (!isPresetDestination(value) && value) setCustom(value);
  }, [value]);

  const validation = validateCtaDestination(custom);

  return (
    <div>
      {label && <Label className="mb-1.5 block">{label}</Label>}
      <Select
        value={preset}
        onValueChange={v => {
          if (v === CTA_CUSTOM) onChange(custom || '');
          else onChange(v);
        }}
      >
        <SelectTrigger><SelectValue placeholder="Choose destination" /></SelectTrigger>
        <SelectContent className="bg-popover z-50">
          {CTA_DESTINATIONS.map(d => (
            <SelectItem key={d.value} value={d.value}>
              {d.label}{d.hint ? ` — ${d.hint}` : ''}
            </SelectItem>
          ))}
          <SelectItem value={CTA_CUSTOM}>Custom link…</SelectItem>
        </SelectContent>
      </Select>
      {preset === CTA_CUSTOM && (
        <>
          <Input
            className={`mt-2 ${validation.level === 'error' ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            value={custom}
            placeholder="/menu?order=pickup or https://…"
            onChange={e => { setCustom(e.target.value); onChange(e.target.value); }}
            aria-invalid={validation.level === 'error'}
          />
          {validation.level !== 'ok' && validation.message && (
            <p className={`mt-1.5 flex items-start gap-1.5 text-xs ${validation.level === 'error' ? 'text-destructive' : 'text-amber-600 dark:text-amber-500'}`}>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-px" />
              <span>{validation.message}</span>
            </p>
          )}
          {validation.level === 'ok' && custom.trim() && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Opens: <span className="font-mono">{custom.trim()}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}



const templates = [
  { id: 'default', label: 'Default', description: 'Simple centered card layout with Browse Menu and Sign In buttons. Clean and minimal.', img: templateDefaultImg },
  { id: 'classic', label: 'Classic', description: 'Full-screen hero with stats strip, featured menu grid, story section, and CTA.', img: templateClassicImg },
  { id: 'modern', label: 'Modern', description: 'Split-screen hero, minimal grid menu, centered story block. Clean and bold.', img: templateModernImg },
  { id: 'bistro', label: 'Bistro', description: 'Warm earthy tones, centered hero with restaurant name, horizontal menu carousel.', img: templateBistroImg },
  { id: 'elegant', label: 'Elegant', description: 'Full-bleed hero with serif typography, gold accents, luxurious fine dining feel.', img: templateElegantImg },
  { id: 'cafe', label: 'Café', description: 'Light cream background, rounded corners, friendly and inviting cafe atmosphere.', img: templateCafeImg },
  { id: 'minimal', label: 'Minimal', description: 'Text-only hero, no images, lots of whitespace. Ultra-clean and modern.', img: templateMinimalImg },
  { id: 'grand', label: 'Grand', description: 'Complete fine-dining layout: cinematic hero, stats, à-la-carte menu list, story, photo gallery, contact strip and gold CTA.', img: templateGrandImg },
];

function TemplateSelector() {
  const { data: settings } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const queryClient = useQueryClient();
  const current = settings?.homepage_template || 'classic';
  const [saving, setSaving] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const deviceSizes = {
    desktop: { width: 1440, height: 900, scale: 0.55, label: 'Desktop' },
    tablet: { width: 768, height: 1024, scale: 0.5, label: 'Tablet' },
    mobile: { width: 375, height: 812, scale: 0.45, label: 'Mobile' },
  };

  const selectTemplate = async (templateId: string) => {
    if (templateId === current || saving) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_settings')
        .update({ homepage_template: templateId } as any)
        .eq('id', settings!.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
      toast.success(`Template changed to "${templates.find(t => t.id === templateId)?.label}"`);
      setPreviewId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  const previewTemplate = previewId ? templates.find(t => t.id === previewId) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Homepage Template</CardTitle>
        <CardDescription>Choose a layout design for your landing page. Click "Preview" to see a full preview, or click to activate.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {templates.map(t => (
            <div
              key={t.id}
              className={`group relative rounded-xl overflow-hidden border-2 transition-all text-left ${
                current === t.id
                  ? 'border-primary ring-2 ring-primary/20'
                  : previewId === t.id
                  ? 'border-amber-500 ring-2 ring-amber-500/20'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="aspect-[5/4] overflow-hidden bg-muted relative">
                <img
                  src={t.img}
                  alt={t.label}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  width={640}
                  height={512}
                />
                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="text-xs w-full"
                    onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                  >
                    <Layout className="h-3 w-3 mr-1" />
                    {previewId === t.id ? 'Close Preview' : 'Preview'}
                  </Button>
                  {current !== t.id && (
                    <Button
                      size="sm"
                      className="text-xs w-full"
                      onClick={() => selectTemplate(t.id)}
                      disabled={saving}
                    >
                      <Check className="h-3 w-3 mr-1" />
                      Activate
                    </Button>
                  )}
                </div>
              </div>
              <div className="p-2.5">
                <div className="flex items-center gap-1.5">
                  {current === t.id && (
                    <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="h-2.5 w-2.5 text-primary-foreground" />
                    </span>
                  )}
                  <h3 className="font-semibold text-xs text-card-foreground">{t.label}</h3>
                </div>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">{t.description}</p>
              </div>
              {current === t.id && (
                <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-primary text-primary-foreground text-[9px] uppercase tracking-wider font-bold rounded-full">
                  Active
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Live Preview Panel */}
        {previewTemplate && (() => {
          const device = deviceSizes[previewDevice];
          const iframeW = device.width;
          const iframeH = device.height;
          const scale = device.scale;

          return (
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between bg-muted px-4 py-2.5 border-b border-border flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Layout className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-card-foreground">
                    Preview: <span className="text-primary">{previewTemplate.label}</span>
                  </span>
                  {current === previewTemplate.id && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold bg-muted-foreground/10 px-2 py-0.5 rounded-full">Current</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Device toggles */}
                  <div className="flex items-center bg-background border border-border rounded-lg p-0.5 mr-2">
                    {([
                      { key: 'desktop' as const, icon: Monitor, label: 'Desktop' },
                      { key: 'tablet' as const, icon: Tablet, label: 'Tablet' },
                      { key: 'mobile' as const, icon: Smartphone, label: 'Mobile' },
                    ]).map(({ key, icon: Icon, label }) => (
                      <button
                        key={key}
                        onClick={() => setPreviewDevice(key)}
                        title={label}
                        className={`p-1.5 rounded-md transition-colors ${
                          previewDevice === key
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
                    {iframeW}×{iframeH}
                  </span>
                  {current !== previewTemplate.id && (
                    <Button size="sm" onClick={() => selectTemplate(previewTemplate.id)} disabled={saving} className="text-xs h-7">
                      <Check className="h-3 w-3 mr-1" /> Activate
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setPreviewId(null)} className="text-xs h-7">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="relative bg-muted/30 flex justify-center py-4 overflow-auto" style={{ maxHeight: '70vh' }}>
                <div
                  className="relative overflow-hidden rounded-lg border border-border/50 shadow-lg bg-background"
                  style={{
                    width: iframeW * scale,
                    height: iframeH * scale,
                  }}
                >
                  <iframe
                    key={`${previewTemplate.id}-${previewDevice}`}
                    src={
                      restaurant?.slug
                        ? `/r/${restaurant.slug}?_preview_template=${previewTemplate.id}`
                        : `/?_preview_template=${previewTemplate.id}`
                    }
                    className="border-0 origin-top-left bg-background"
                    title={`Preview ${previewTemplate.label} template`}
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    style={{
                      width: iframeW,
                      height: iframeH,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </CardContent>
    </Card>
  );
}


const GRAND_SECTION_META: { key: string; label: string; description: string }[] = [
  { key: 'hero', label: 'Hero', description: 'Full-screen cinematic header with headline and buttons' },
  { key: 'stats', label: 'Stats strip', description: 'Numbers row (years, dishes, guests…)' },
  { key: 'featured', label: 'Signature Plates', description: 'Editorial featured-menu price list' },
  { key: 'story', label: 'Story', description: 'Image + narrative panel with badge' },
  { key: 'gallery', label: 'Gallery', description: 'Photo grid of your restaurant' },
  { key: 'contact', label: 'Contact strip', description: 'Address, hours and reservations' },
  { key: 'cta', label: 'Closing CTA', description: 'Gold call-to-action band at the bottom' },
];

interface LayoutState { order: string[]; hidden: string[] }

function SectionLayoutEditor({ data, onSave, saving, onChange, template, draftData, onPersistDraft }: { data: any; onSave: (c: any) => void; saving: boolean; onChange?: (c: any) => void; template: string; draftData?: any; onPersistDraft?: (c: any) => Promise<void> | void }) {
  const defaultOrder = GRAND_SECTION_META.map(s => s.key);

  const normalize = (s: any): LayoutState => {
    const o = (s?.order || []).filter((k: string) => defaultOrder.includes(k));
    return {
      order: [...o, ...defaultOrder.filter(k => !o.includes(k))],
      hidden: (s?.hidden || []).filter((k: string) => defaultOrder.includes(k)),
    };
  };

  const { data: currentRestaurant } = useCurrentRestaurant();
  const draftKey = `grand-layout-draft:${currentRestaurant?.id ?? 'anon'}:${template}`;

  const savedState = normalize(data?.[template]);
  const [state, setState] = useState<LayoutState>(savedState);
  const [past, setPast] = useState<LayoutState[]>([]);
  const [future, setFuture] = useState<LayoutState[]>([]);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [viewMode, setViewMode] = useState<'draft' | 'published'>('draft');
  const hydratedRef = useRef(false);
  const viewState = viewMode === 'draft' ? state : savedState;
  const { order, hidden } = viewState;
  const readOnly = viewMode === 'published';

  const sameState = (a: LayoutState, b: LayoutState) =>
    a.order.join('|') === b.order.join('|') &&
    [...a.hidden].sort().join('|') === [...b.hidden].sort().join('|');

  const dirty = !sameState(state, savedState);

  // Load the published state, restoring any draft saved to the account (or, as a
  // fallback, this browser) that differs from it.
  useEffect(() => {
    const base = normalize(data?.[template]);
    let next = base;
    let restored = false;

    const remote = draftData?.[template];
    if (remote) {
      const parsed = normalize(remote);
      if (!sameState(parsed, base)) {
        next = parsed;
        restored = true;
      }
    }

    if (!restored) {
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const parsed = normalize(JSON.parse(raw));
          if (!sameState(parsed, base)) {
            next = parsed;
            restored = true;
          } else {
            localStorage.removeItem(draftKey);
          }
        }
      } catch { /* ignore malformed draft */ }
    }

    hydratedRef.current = false;
    setRestoredDraft(restored);
    setState(next);
    setPast([]);
    setFuture([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, draftData, template, draftKey]);

  useEffect(() => {
    onChange?.({ ...(data || {}), [template]: viewMode === 'draft' ? state : normalize(data?.[template]) });
    try {
      if (sameState(state, normalize(data?.[template]))) localStorage.removeItem(draftKey);
      else localStorage.setItem(draftKey, JSON.stringify(state));
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, viewMode]);

  /** Debounced auto-save of the working draft to the database. */
  useEffect(() => {
    if (!onPersistDraft) return;
    if (!hydratedRef.current) { hydratedRef.current = true; return; }

    const isDirty = !sameState(state, normalize(data?.[template]));
    const next = { ...(draftData || {}) };
    if (isDirty) next[template] = state;
    else delete next[template];

    setDraftStatus('saving');
    const timer = setTimeout(() => {
      Promise.resolve(onPersistDraft(next))
        .then(() => setDraftStatus('saved'))
        .catch(() => setDraftStatus('idle'));
    }, 700);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const clearStoredDraft = () => {
    try { localStorage.removeItem(draftKey); } catch { /* storage unavailable */ }
    const next = { ...(draftData || {}) };
    delete next[template];
    onPersistDraft?.(next);
  };

  const handleSave = () => {
    clearStoredDraft();
    setRestoredDraft(false);
    setDraftStatus('idle');
    hydratedRef.current = false;
    onSave({ ...(data || {}), [template]: state });
  };

  const discardDraft = () => {
    clearStoredDraft();
    setRestoredDraft(false);
    setDraftStatus('idle');
    hydratedRef.current = false;
    setPast([]);
    setFuture([]);
    setState(normalize(data?.[template]));
  };


  /** Records the current state on the undo stack before applying the next one. */
  const commit = (next: LayoutState) => {
    setPast(p => [...p.slice(-49), state]);
    setFuture([]);
    setState(next);
  };

  const undo = () => {
    setPast(p => {
      if (!p.length) return p;
      const prev = p[p.length - 1];
      setFuture(f => [state, ...f]);
      setState(prev);
      return p.slice(0, -1);
    });
  };

  const redo = () => {
    setFuture(f => {
      if (!f.length) return f;
      setPast(p => [...p, state]);
      setState(f[0]);
      return f.slice(1);
    });
  };

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return;
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const importInputRef = useRef<HTMLInputElement>(null);

  /** Serializable payload of the currently viewed layout. */
  const buildExport = () => ({
    type: 'serveos.homepage-section-layout',
    version: 1,
    template,
    exported_at: new Date().toISOString(),
    layout: viewState,
  });

  const exportLayout = () => {
    const blob = new Blob([JSON.stringify(buildExport(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `section-layout-${template}-${viewMode}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Layout exported');
  };

  const copyLayout = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(buildExport(), null, 2));
      toast.success('Layout JSON copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  };

  const applyImported = (raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      const layout = parsed?.layout ?? parsed;
      if (!layout || !Array.isArray(layout.order)) throw new Error('bad shape');
      const known = layout.order.filter((k: unknown) => typeof k === 'string' && defaultOrder.includes(k));
      if (!known.length) throw new Error('no known sections');
      setViewMode('draft');
      commit(normalize({ order: known, hidden: layout.hidden }));
      toast.success('Layout imported — review and save to publish');
    } catch {
      toast.error('Invalid layout file');
    }
  };

  const importFromFile = async (file: File) => applyImported(await file.text());

  const importFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return toast.error('Clipboard is empty');
      applyImported(text);
    } catch {
      toast.error('Could not read clipboard — use “Import file” instead');
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    if (readOnly) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    commit({
      ...state,
      order: arrayMove(state.order, state.order.indexOf(active.id as string), state.order.indexOf(over.id as string)),
    });
  };

  const toggle = (key: string) => {
    if (readOnly) return;
    commit({ ...state, hidden: state.hidden.includes(key) ? state.hidden.filter(k => k !== key) : [...state.hidden, key] });
  };

  if (template !== 'grand') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sections</CardTitle>
          <CardDescription>Section reordering is only available on the Grand template.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              Section Order & Visibility
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  dirty
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {dirty ? <Info className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                {dirty ? 'Pending changes' : 'All changes saved'}
              </span>
              {dirty && (
                <span className="text-[11px] font-normal text-muted-foreground">
                  {draftStatus === 'saving' ? 'Saving draft…' : draftStatus === 'saved' ? 'Draft saved to your account' : ''}
                </span>
              )}
            </CardTitle>
            <CardDescription>Drag to reorder sections on your homepage, and toggle any section off to hide it.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={undo} disabled={readOnly || !canUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" /> Undo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={redo} disabled={readOnly || !canRedo} title="Redo (Ctrl+Shift+Z)">
              <Redo2 className="h-4 w-4" /> Redo
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={exportLayout} title="Download this layout as JSON">
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={copyLayout} title="Copy layout JSON">
              <Copy className="h-4 w-4" /> Copy
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => importInputRef.current?.click()} title="Import a layout JSON file">
              <Upload className="h-4 w-4" /> Import
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={importFromClipboard} title="Paste layout JSON from clipboard">
              <ClipboardPaste className="h-4 w-4" /> Paste
            </Button>
            <input
              ref={importInputRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) importFromFile(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
            {(['draft', 'published'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                  viewMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'draft' ? 'Draft (editing)' : 'Published (live)'}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? 'Showing the currently published layout — switch to Draft to edit.'
              : dirty
                ? 'Preview reflects your unsaved draft.'
                : 'Draft matches the published layout.'}
          </p>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {restoredDraft && (
          <div className="flex items-start justify-between gap-3 flex-wrap rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
            <p className="text-xs text-amber-700 dark:text-amber-300">
              Restored your unsaved section layout draft — it is stored on your account, so it survives refreshes and other devices.
            </p>
            <button onClick={discardDraft} className="text-xs font-medium underline text-amber-700 dark:text-amber-300">
              Discard draft
            </button>
          </div>
        )}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {order.map((key, i) => {
                const meta = GRAND_SECTION_META.find(m => m.key === key)!;
                const changed =
                  !readOnly &&
                  (savedState.order.indexOf(key) !== i || savedState.hidden.includes(key) !== hidden.includes(key));
                return (
                  <SortableSectionRow
                    key={key}
                    id={key}
                    index={i}
                    label={meta.label}
                    description={meta.description}
                    visible={!hidden.includes(key)}
                    onToggle={() => toggle(key)}
                    readOnly={readOnly}
                    changed={changed}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex items-center justify-between gap-3 flex-wrap pt-2">
          <p className="text-xs text-muted-foreground">
            {order.length - hidden.length} of {order.length} sections visible
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => commit({ order: defaultOrder, hidden: [] })}
              disabled={saving || readOnly}
            >
              Reset to default
            </Button>
            <Button onClick={handleSave} disabled={saving || !dirty} className="gap-2">
              <Save className="h-4 w-4" /> {saving ? 'Saving...' : dirty ? 'Save Layout' : 'Saved'}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SortableSectionRow({ id, index, label, description, visible, onToggle, readOnly = false, changed = false }: { id: string; index: number; label: string; description: string; visible: boolean; onToggle: () => void; readOnly?: boolean; changed?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: readOnly });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5 ${changed ? 'border-amber-500/50 bg-amber-500/5' : 'border-border'} ${!visible ? 'opacity-60' : ''}`}
    >
      <button
        {...attributes}
        {...listeners}
        disabled={readOnly}
        className={`text-muted-foreground shrink-0 ${readOnly ? 'opacity-40 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:text-foreground'}`}
        aria-label={`Reorder ${label}`}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span className="text-xs tabular-nums text-muted-foreground w-5 shrink-0">{index + 1}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-card-foreground truncate">{label}</p>
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      </div>
      {changed && <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 shrink-0">changed</span>}
      <Switch checked={visible} onCheckedChange={onToggle} disabled={readOnly} aria-label={`${visible ? 'Hide' : 'Show'} ${label}`} />
    </div>
  );
}
