import { useId, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Eye, Loader2, MoreHorizontal, Palette, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import PlatformLayout from './PlatformLayout';
import ThemeStylePreview from '@/components/platform/ThemeStylePreview';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { usePlatformThemes, type PlatformTheme, type ThemeColors, type ThemeTokens } from '@/hooks/usePlatformThemes';
import { DEFAULT_THEME_TOKENS, normalizeThemeTokens, THEME_FONTS, THEME_TEMPLATES } from '@/lib/theme-presets';
import { edgeFunctionError } from '@/lib/edge-function-error';
import { slugify } from '@/lib/slug';

type ThemeDraft = Pick<PlatformTheme, 'key' | 'name' | 'description' | 'preview_image' | 'tokens' | 'is_active' | 'sort_order'> & { id?: string };
const emptyTheme = (): ThemeDraft => ({ key: '', name: '', description: '', preview_image: null, tokens: structuredClone(DEFAULT_THEME_TOKENS), is_active: true, sort_order: 100 });

export default function PlatformThemes() {
  const { data: themes = [], isLoading, isError, refetch } = usePlatformThemes();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState<ThemeDraft | null>(null);
  const [preview, setPreview] = useState<PlatformTheme | null>(null);
  const [deleting, setDeleting] = useState<PlatformTheme | null>(null);
  const [restaurantId, setRestaurantId] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const { data: restaurants = [] } = useQuery({
    queryKey: ['platform-theme-assignments'],
    queryFn: async () => {
      const { data, error } = await supabase.from('restaurants').select('id, name, theme_id').order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
  const usage = (id: string) => restaurants.filter(restaurant => restaurant.theme_id === id).length;
  const q = search.trim().toLowerCase();
  const filtered = themes.filter(theme => `${theme.name} ${theme.description ?? ''} ${theme.tokens.homepage_template ?? ''}`.toLowerCase().includes(q) && (filter === 'all' || (filter === 'active' ? theme.is_active : !theme.is_active)));
  const invalidate = async () => {
    await Promise.all([['platform-themes'], ['platform-theme'], ['platform-theme-assignments'], ['current-restaurant'], ['restaurant-by-slug'], ['platform-tenants']].map(queryKey => qc.invalidateQueries({ queryKey })));
  };
  const openPreview = (theme: PlatformTheme) => { setPreview(theme); setRestaurantId(''); setActionError(''); };
  const assign = async () => {
    if (!preview?.is_active || !restaurantId) return;
    setBusy(true); setActionError('');
    try {
      const { data, error } = await supabase.functions.invoke('platform-manage-tenant', { body: { action: 'assign_theme', tenantId: restaurantId, themeId: preview.id } });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);
      await invalidate(); setPreview(null); toast.success('Theme applied to restaurant');
    } catch (error) { setActionError(error instanceof Error ? error.message : 'Could not apply this theme.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!deleting) return;
    setBusy(true); setActionError('');
    try {
      const { error } = await supabase.from('platform_themes').delete().eq('id', deleting.id).select('id').single();
      if (error) throw error;
      await invalidate(); setDeleting(null); toast.success('Theme deleted');
    } catch (error) { setActionError(typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Could not delete theme.'); }
    finally { setBusy(false); }
  };

  return <PlatformLayout>
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-10">
      <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">Restaurant websites</p><h1 className="text-3xl font-semibold tracking-tight">Themes</h1><p className="mt-2 text-sm text-muted-foreground">Find a look, preview it, and apply it to a restaurant.</p></div><Button onClick={() => setEditing(emptyTheme())}><Plus className="mr-2 h-4 w-4" /> New theme</Button></header>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground"><span className="inline-flex items-center gap-2"><Palette className="h-4 w-4" /> {themes.length} themes</span><span className="text-border">/</span><span>{themes.filter(theme => theme.is_active).length} available to use</span><span className="text-border">/</span><span>{restaurants.filter(restaurant => restaurant.theme_id).length} restaurants with a theme</span></div>
      <div className="flex flex-wrap gap-3"><div className="relative min-w-0 flex-1 sm:max-w-md"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Search themes" placeholder="Search a style, name or restaurant type" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} /></div><select aria-label="Theme availability" className="h-10 rounded-md border bg-background px-3 text-sm" value={filter} onChange={event => setFilter(event.target.value)}><option value="all">All themes</option><option value="active">Available</option><option value="inactive">Inactive</option></select></div>
      {isLoading ? <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Loading themes…</div>
        : isError ? <div className="space-y-3 rounded-2xl border p-10 text-center"><p>Could not load themes.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>
        : filtered.length === 0 ? <div className="space-y-3 rounded-2xl border p-10 text-center"><Palette className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">{themes.length ? 'No matching themes' : 'Create your first theme'}</h2><p className="text-sm text-muted-foreground">{themes.length ? 'Try another search or availability filter.' : 'Start with a style and customize its colors.'}</p>{themes.length > 0 && <Button variant="outline" onClick={() => { setSearch(''); setFilter('all'); }}>Clear filters</Button>}</div>
        : <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{filtered.map(theme => <article key={theme.id} aria-label={theme.name} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition-shadow hover:shadow-md">
          <button aria-label={`Preview ${theme.name}`} onClick={() => openPreview(theme)} className="block w-full text-left outline-offset-4"><ThemeStylePreview tokens={theme.tokens} /></button>
          <div className="flex flex-1 flex-col gap-3 p-5"><div className="flex items-start justify-between gap-2"><h2 className="font-semibold">{theme.name}</h2><Badge variant="outline" className={theme.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-muted-foreground'}>{theme.is_active ? 'Available' : 'Inactive'}</Badge></div><p className="min-h-10 text-xs leading-relaxed text-muted-foreground">{theme.description || 'A custom look for your restaurant website.'}</p><div className="flex items-center justify-between text-xs text-muted-foreground"><span className="capitalize">{theme.tokens.homepage_template ?? 'classic'} layout</span><span>Used by {usage(theme.id)} restaurant{usage(theme.id) === 1 ? '' : 's'}</span></div><div className="mt-auto flex items-center gap-2 border-t pt-4"><Button variant="outline" size="sm" className="flex-1" onClick={() => openPreview(theme)} aria-label={`Preview and apply ${theme.name}`}><Eye className="mr-2 h-3.5 w-3.5" /> Preview & apply</Button><Button variant="ghost" size="sm" onClick={() => setEditing({ ...theme, tokens: normalizeThemeTokens(theme.tokens) })} aria-label={`Edit ${theme.name}`}><Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit</Button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`More actions for ${theme.name}`}><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setEditing({ ...theme, id: undefined, key: `${theme.key.slice(0, 40)}-copy-${Date.now().toString(36)}`, name: `${theme.name} copy`, is_active: false, tokens: structuredClone(theme.tokens) })}><Copy className="mr-2 h-4 w-4" /> Duplicate theme</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => { setDeleting(theme); setActionError(''); }}><Trash2 className="mr-2 h-4 w-4" /> Delete theme</DropdownMenuItem></DropdownMenuContent></DropdownMenu></div></div>
        </article>)}</div>}
      <p className="text-xs text-muted-foreground">Themes are shared styles. Editing a theme updates every restaurant using it.</p>
    </div>
    {editing && <ThemeEditor theme={editing} usage={editing.id ? usage(editing.id) : 0} onClose={() => setEditing(null)} onSaved={invalidate} />}
    <Dialog open={preview !== null} onOpenChange={open => { if (!open && !busy) setPreview(null); }}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>{preview?.name}</DialogTitle><DialogDescription>{preview?.description} This is a sample style preview.</DialogDescription></DialogHeader>{preview && <ThemeStylePreview tokens={preview.tokens} large />}<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"><label className="min-w-0 space-y-2"><span className="text-sm font-medium">Apply to restaurant</span><select aria-label="Apply to restaurant" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={restaurantId} onChange={event => setRestaurantId(event.target.value)} disabled={!preview?.is_active || busy}><option value="">Choose a restaurant</option>{restaurants.map(restaurant => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}{restaurant.theme_id === preview?.id ? ' — current theme' : ''}</option>)}</select></label><Button className="self-end" onClick={assign} disabled={!restaurantId || !preview?.is_active || busy}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />} Apply theme</Button></div>{!preview?.is_active && <p className="text-xs text-muted-foreground">Enable this theme before assigning it to another restaurant.</p>}{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}</DialogContent></Dialog>
    <AlertDialog open={deleting !== null} onOpenChange={open => { if (!open && !busy) setDeleting(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle><AlertDialogDescription>{deleting && usage(deleting.id) > 0 ? `${usage(deleting.id)} restaurant(s) will return to their default branding. ` : ''}This removes the theme permanently.</AlertDialogDescription></AlertDialogHeader>{actionError && <p role="alert" className="text-sm text-destructive">{actionError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep theme</AlertDialogCancel><AlertDialogAction className="bg-destructive hover:bg-destructive/90" disabled={busy} onClick={event => { event.preventDefault(); void remove(); }}>{busy ? 'Deleting…' : 'Delete theme'}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </PlatformLayout>;
}

function ThemeEditor({ theme, usage, onClose, onSaved }: { theme: ThemeDraft; usage: number; onClose: () => void; onSaved: () => Promise<void> }) {
  const [draft, setDraft] = useState(() => ({ ...structuredClone(theme), tokens: normalizeThemeTokens(theme.tokens) }));
  const [initial] = useState(() => JSON.stringify({ ...theme, tokens: normalizeThemeTokens(theme.tokens) }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const dirty = JSON.stringify(draft) !== initial;
  const close = () => { if (saving) return; if (dirty) setDiscard(true); else onClose(); };
  const patch = (changes: Partial<ThemeDraft>) => { setDraft(previous => ({ ...previous, ...changes })); setError(''); };
  const tokens = (changes: Partial<ThemeTokens>) => patch({ tokens: { ...draft.tokens, ...changes } });
  const color = (key: keyof ThemeColors, value: string) => tokens({ colors: { ...draft.tokens.colors, [key]: value } });
  const font = (field: 'heading_family' | 'body_family', value: string) => {
    const fonts = { ...draft.tokens.fonts, [field]: value };
    fonts.google_fonts = [...new Set([fonts.heading_family, fonts.body_family].flatMap(family => { const choice = THEME_FONTS.find(item => item.family === family); return choice && 'google' in choice ? [choice.google] : []; }))];
    tokens({ fonts });
  };
  const save = async () => {
    if (!draft.name.trim() || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.key)) { setError('Enter a name and a valid theme identifier.'); return; }
    if (!Number.isInteger(draft.sort_order) || draft.sort_order < 0) { setError('Display position must be a whole number, zero or greater.'); return; }
    if (Object.values(draft.tokens.colors ?? {}).some(value => !value || !CSS.supports('color', value))) { setError('Enter a valid color in each color field.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { key: draft.key, name: draft.name.trim(), description: draft.description?.trim() || null, preview_image: draft.preview_image, is_active: draft.is_active, sort_order: draft.sort_order, tokens: { ...draft.tokens, colors: { ...draft.tokens.colors }, fonts: { ...draft.tokens.fonts } } };
      const request = draft.id ? supabase.from('platform_themes').update(payload).eq('id', draft.id).select('id').single() : supabase.from('platform_themes').insert(payload).select('id').single();
      const { error: saveError } = await request;
      if (saveError) throw saveError;
      await onSaved(); toast.success(draft.id ? 'Theme saved' : 'Theme created'); onClose();
    } catch (cause) { setError(typeof cause === 'object' && cause && 'message' in cause ? String(cause.message) : 'Could not save this theme.'); }
    finally { setSaving(false); }
  };
  const colorField = (key: keyof ThemeColors, label: string) => <ColorField key={key} label={label} value={draft.tokens.colors?.[key] ?? '#000000'} onChange={value => color(key, value)} />;
  return <>
    <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent className="flex max-h-[92dvh] max-w-5xl flex-col gap-0 overflow-hidden p-0 sm:p-0"><DialogHeader className="border-b px-5 py-5 text-left sm:px-7"><DialogTitle>{draft.id ? `Edit ${theme.name}` : 'New theme'}</DialogTitle><DialogDescription>{usage ? `Changes will update ${usage} restaurant(s) using this theme.` : 'Customize the style and watch the preview update.'}</DialogDescription></DialogHeader>
      <div className="grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[minmax(0,1fr)_360px]">
        <Tabs defaultValue="details" className="min-w-0 p-5 sm:p-7"><TabsList className="mb-5 grid h-auto w-full grid-cols-3"><TabsTrigger value="details" className="py-2">Details</TabsTrigger><TabsTrigger value="colors" className="py-2">Colors</TabsTrigger><TabsTrigger value="style" className="py-2">Type & layout</TabsTrigger></TabsList>
          <TabsContent value="details" className="space-y-5"><Field label="Theme name" value={draft.name} onChange={name => patch({ name, ...(!draft.id && !theme.key ? { key: slugify(name) } : {}) })} placeholder="e.g. Garden Bistro" /><Field label="Best suited for" value={draft.description ?? ''} onChange={description => patch({ description })} multiline placeholder="Describe which restaurants this style suits." /><Field label="Display position" type="number" value={String(draft.sort_order)} onChange={value => patch({ sort_order: Number(value) })} hint="Lower numbers appear first." /><div className="flex items-center justify-between gap-3 rounded-xl border p-4"><label htmlFor="theme-available"><span className="text-sm font-medium">Available for assignment</span><p className="mt-1 text-xs text-muted-foreground">Turn off to hide it from new selections. Existing restaurants keep their theme.</p></label><Switch id="theme-available" checked={draft.is_active} onCheckedChange={is_active => patch({ is_active })} /></div>{!draft.id && <details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Advanced settings</summary><div className="mt-4"><Field label="Theme identifier" value={draft.key} onChange={key => patch({ key: slugify(key) })} hint="A unique short name, generated from the theme name." /></div></details>}</TabsContent>
          <TabsContent value="colors" className="space-y-5"><div><h3 className="font-semibold">Main palette</h3><p className="mt-1 text-xs text-muted-foreground">Pick a color or enter a color value.</p></div><div className="grid gap-4 sm:grid-cols-2">{colorField('bg_primary', 'Page background')}{colorField('bg_secondary', 'Cards & sections')}{colorField('accent', 'Accent color')}{colorField('text_primary', 'Main text')}</div><details className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-medium">Navigation & secondary colors</summary><div className="mt-4 grid gap-4 sm:grid-cols-2">{colorField('accent_light', 'Accent highlight')}{colorField('text_muted', 'Secondary text')}{colorField('nav_bg', 'Navigation background')}{colorField('nav_text', 'Navigation text')}{colorField('nav_accent', 'Navigation accent')}</div></details></TabsContent>
          <TabsContent value="style" className="space-y-5">{(['heading_family', 'body_family'] as const).map(key => <label key={key} className="block space-y-2 text-sm font-medium">{key === 'heading_family' ? 'Heading font' : 'Body font'}<select aria-label={key === 'heading_family' ? 'Heading font' : 'Body font'} className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" value={draft.tokens.fonts?.[key]} onChange={event => font(key, event.target.value)}>{!THEME_FONTS.some(item => item.family === draft.tokens.fonts?.[key]) && <option value={draft.tokens.fonts?.[key]}>{draft.tokens.fonts?.[key]}</option>}{THEME_FONTS.map(item => <option key={item.family} value={item.family}>{item.label}</option>)}</select></label>)}<label className="block space-y-2 text-sm font-medium">Homepage layout<select aria-label="Homepage layout" className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal capitalize" value={draft.tokens.homepage_template} onChange={event => tokens({ homepage_template: event.target.value })}>{THEME_TEMPLATES.map(template => <option key={template} value={template}>{template === 'cafe' ? 'Café' : template.charAt(0).toUpperCase() + template.slice(1)}</option>)}</select></label><div className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Button style<select aria-label="Button style" className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal capitalize" value={draft.tokens.button_style} onChange={event => tokens({ button_style: event.target.value as ThemeTokens['button_style'] })}>{['solid', 'outline', 'pill', 'sharp'].map(style => <option key={style} value={style}>{style.charAt(0).toUpperCase() + style.slice(1)}</option>)}</select></label><label className="space-y-2 text-sm font-medium">Corners<select aria-label="Corners" className="h-10 w-full rounded-md border bg-background px-3 text-sm font-normal" value={draft.tokens.radius} onChange={event => tokens({ radius: event.target.value })}>{!['0', '0.25rem', '0.5rem', '0.75rem', '1.25rem'].includes(draft.tokens.radius ?? '') && <option value={draft.tokens.radius}>{draft.tokens.radius}</option>}<option value="0">Square</option><option value="0.25rem">Subtle</option><option value="0.5rem">Soft</option><option value="0.75rem">Rounded</option><option value="1.25rem">Extra rounded</option></select></label></div></TabsContent>
        </Tabs>
        <aside className="border-t bg-muted/30 p-5 lg:border-l lg:border-t-0"><p className="mb-4 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Eye className="h-4 w-4" /> Live style preview</p><ThemeStylePreview tokens={draft.tokens} /><p className="mt-3 text-xs text-muted-foreground">Sample content illustrates colors, fonts and buttons. Restaurant photos and content stay their own.</p></aside>
      </div>
      <DialogFooter className="flex-col items-stretch justify-between gap-3 border-t px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-7"><p className="text-xs text-muted-foreground">{error ? <span role="alert" className="text-destructive">{error}</span> : !draft.id ? 'Not created yet' : dirty ? 'Unsaved changes' : 'All changes saved'}</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={close} disabled={saving}>Cancel</Button><Button onClick={save} disabled={saving || (!!draft.id && !dirty)}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{draft.id ? 'Save changes' : 'Create theme'}</Button></div></DialogFooter>
    </DialogContent></Dialog>
    <AlertDialog open={discard} onOpenChange={setDiscard}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle><AlertDialogDescription>Your saved theme will stay as it is.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><AlertDialogAction onClick={onClose}>Discard changes</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </>;
}
function Field({ label, value, onChange, placeholder, type = 'text', hint, multiline }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string; hint?: string; multiline?: boolean }) {
  const id = useId();
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label>{multiline ? <Textarea id={id} value={value} placeholder={placeholder} rows={3} onChange={event => onChange(event.target.value)} /> : <Input id={id} type={type} min={type === 'number' ? 0 : undefined} value={value} placeholder={placeholder} onChange={event => onChange(event.target.value)} />}{hint && <p className="text-xs text-muted-foreground">{hint}</p>}</div>;
}
function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const swatch = /^#[a-f0-9]{6}$/i.test(value) ? value : '#000000';
  return <div className="space-y-2"><Label htmlFor={id}>{label}</Label><div className="flex gap-2"><input aria-label={`${label} picker`} type="color" value={swatch} onChange={event => onChange(event.target.value)} className="h-10 w-11 shrink-0 cursor-pointer rounded-md border bg-background p-1" /><Input id={id} value={value} onChange={event => onChange(event.target.value)} className="min-w-0 font-mono text-xs" /></div></div>;
}
