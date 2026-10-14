import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Brush, Check, Loader2, RotateCcw, Save, Sparkles, Type } from 'lucide-react';
import OwnerLayout from './OwnerLayout';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import {
  usePlatformThemes,
  usePlatformTheme,
  mergeThemeTokens,
  type ButtonStyle,
  type PlatformTheme,
  type ThemeTokens,
} from '@/hooks/usePlatformThemes';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const COLOR_FIELDS: { key: keyof NonNullable<ThemeTokens['colors']>; label: string; group: 'page' | 'nav' }[] = [
  { key: 'bg_primary', label: 'Background (primary)', group: 'page' },
  { key: 'bg_secondary', label: 'Background (secondary)', group: 'page' },
  { key: 'accent', label: 'Accent', group: 'page' },
  { key: 'accent_light', label: 'Accent (light)', group: 'page' },
  { key: 'text_primary', label: 'Text (primary)', group: 'page' },
  { key: 'text_muted', label: 'Text (muted)', group: 'page' },
  { key: 'nav_bg', label: 'Nav background', group: 'nav' },
  { key: 'nav_text', label: 'Nav text', group: 'nav' },
  { key: 'nav_accent', label: 'Nav accent', group: 'nav' },
];

const FONT_PRESETS = [
  'Inter, sans-serif',
  'Outfit, sans-serif',
  'Plus Jakarta Sans, sans-serif',
  'Playfair Display, serif',
  'Cormorant Garamond, serif',
  'DM Serif Display, serif',
  'Poppins, sans-serif',
  'Montserrat, sans-serif',
  'Manrope, sans-serif',
  'Lora, serif',
];

const BUTTON_STYLES: ButtonStyle[] = ['solid', 'outline', 'pill', 'sharp'];

/* -------------------------------------------------------------------------- */
/*  Page                                                                      */
/* -------------------------------------------------------------------------- */

export default function OwnerTheme() {
  const qc = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const { data: themes, isLoading: loadingThemes } = usePlatformThemes({ activeOnly: true });

  const currentThemeId = (restaurant as any)?.theme_id as string | null | undefined;
  const savedOverrides = ((restaurant as any)?.theme_overrides ?? null) as ThemeTokens | null;

  const [selectedThemeId, setSelectedThemeId] = useState<string | null>(currentThemeId ?? null);
  const [overrides, setOverrides] = useState<ThemeTokens>({});
  const [saving, setSaving] = useState(false);

  // Load the selected theme's base tokens
  const { data: selectedTheme } = usePlatformTheme(selectedThemeId);

  // When restaurant loads, sync local state once
  useEffect(() => {
    if (!restaurant) return;
    setSelectedThemeId(currentThemeId ?? null);
    setOverrides(savedOverrides ?? {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurant?.id]);

  const baseTokens = selectedTheme?.tokens ?? {};
  const mergedTokens = useMemo(() => mergeThemeTokens(baseTokens, overrides), [baseTokens, overrides]);

  const dirty = useMemo(() => {
    const themeChanged = (currentThemeId ?? null) !== (selectedThemeId ?? null);
    const overridesChanged = JSON.stringify(savedOverrides ?? {}) !== JSON.stringify(overrides ?? {});
    return themeChanged || overridesChanged;
  }, [currentThemeId, selectedThemeId, savedOverrides, overrides]);

  /* ---- Mutators -------------------------------------------------------- */

  const setColor = (key: string, value: string) => {
    setOverrides((o) => ({
      ...o,
      colors: { ...(o.colors ?? {}), [key]: value || undefined },
    }));
  };
  const setFont = (key: 'heading_family' | 'body_family', value: string) => {
    setOverrides((o) => ({
      ...o,
      fonts: { ...(o.fonts ?? {}), [key]: value || undefined },
    }));
  };
  const setRadius = (value: string) => setOverrides((o) => ({ ...o, radius: value }));
  const setButtonStyle = (value: ButtonStyle) => setOverrides((o) => ({ ...o, button_style: value }));

  const handleApplyPreset = (theme: PlatformTheme) => {
    setSelectedThemeId(theme.id);
    setOverrides({});
    toast.success(`Applied "${theme.name}" preset — preview updated`);
  };

  const handleResetOverrides = () => {
    setOverrides({});
    toast.message('Overrides cleared — showing base preset');
  };

  const handleSave = async () => {
    if (!restaurant) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        theme_id: selectedThemeId,
        theme_overrides: Object.keys(overrides).length === 0 ? null : overrides,
      };
      const { error } = await supabase
        .from('restaurants')
        .update(payload as any)
        .eq('id', restaurant.id);
      if (error) throw error;
      toast.success('Theme saved');
      qc.invalidateQueries({ queryKey: ['current-restaurant'] });
      qc.invalidateQueries({ queryKey: ['platform-theme'] });
      qc.invalidateQueries({ queryKey: ['platform-themes'] });
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save theme');
    } finally {
      setSaving(false);
    }
  };

  if (!restaurant) {
    return (
      <OwnerLayout>
        <div className="p-8 text-sm text-muted-foreground">Loading…</div>
      </OwnerLayout>
    );
  }

  return (
    <OwnerLayout>
      <div className="p-6 lg:p-8 max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Brush className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Theme builder</h1>
              <p className="text-sm text-muted-foreground">
                Pick a preset, fine-tune colors and fonts, and preview how your public website will look.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleResetOverrides} disabled={!Object.keys(overrides).length}>
              <RotateCcw className="h-4 w-4 mr-2" /> Reset to preset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save changes
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          {/* LEFT: editor */}
          <div className="space-y-6 min-w-0">
            {/* Preset picker */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4" /> Choose a preset
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingThemes ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading themes…
                  </div>
                ) : !themes?.length ? (
                  <p className="text-sm text-muted-foreground">No themes available yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {themes.map((t) => {
                      const c = t.tokens.colors ?? {};
                      const isSelected = t.id === selectedThemeId;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => handleApplyPreset(t)}
                          className={cn(
                            'group relative text-left rounded-lg border p-3 transition-all',
                            'hover:border-primary/60 hover:shadow-sm',
                            isSelected ? 'border-primary ring-2 ring-primary/20' : 'border-border',
                          )}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                          {/* Mini preview */}
                          <div
                            className="h-16 rounded-md border border-border/50 mb-3 relative overflow-hidden"
                            style={{ background: c.bg_primary ?? '#0a0a0a' }}
                          >
                            <div
                              className="absolute inset-x-0 top-0 h-3"
                              style={{ background: c.nav_bg ?? c.bg_secondary ?? '#141414' }}
                            />
                            <div
                              className="absolute bottom-2 left-2 right-2 h-5 rounded text-[9px] flex items-center justify-center font-medium"
                              style={{
                                background: c.accent ?? '#f59e0b',
                                color: c.bg_primary ?? '#0a0a0a',
                                fontFamily: t.tokens.fonts?.heading_family,
                              }}
                            >
                              Aa
                            </div>
                          </div>
                          <div className="text-sm font-medium truncate">{t.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{t.key}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Customize */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Customize</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="colors">
                  <TabsList className="mb-4">
                    <TabsTrigger value="colors">Colors</TabsTrigger>
                    <TabsTrigger value="typography">Typography</TabsTrigger>
                    <TabsTrigger value="shape">Shape & buttons</TabsTrigger>
                  </TabsList>

                  {/* Colors */}
                  <TabsContent value="colors" className="space-y-6 mt-0">
                    {(['page', 'nav'] as const).map((group) => (
                      <div key={group}>
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                          {group === 'page' ? 'Page' : 'Navigation'}
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {COLOR_FIELDS.filter((f) => f.group === group).map((field) => {
                            const current =
                              (overrides.colors?.[field.key] as string | undefined) ??
                              (baseTokens.colors?.[field.key] as string | undefined) ??
                              '';
                            return (
                              <div key={field.key} className="space-y-1.5">
                                <Label className="text-xs">{field.label}</Label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="color"
                                    value={normalizeHex(current) || '#000000'}
                                    onChange={(e) => setColor(field.key, e.target.value)}
                                    className="h-9 w-12 rounded border border-input bg-transparent cursor-pointer"
                                  />
                                  <Input
                                    value={current}
                                    onChange={(e) => setColor(field.key, e.target.value)}
                                    placeholder="#000000 or rgba(...)"
                                    className="h-9 text-xs font-mono"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </TabsContent>

                  {/* Typography */}
                  <TabsContent value="typography" className="space-y-4 mt-0">
                    {(['heading_family', 'body_family'] as const).map((key) => {
                      const current =
                        overrides.fonts?.[key] ?? baseTokens.fonts?.[key] ?? '';
                      return (
                        <div key={key} className="space-y-2">
                          <Label className="text-sm flex items-center gap-2">
                            <Type className="h-3.5 w-3.5" />
                            {key === 'heading_family' ? 'Heading font' : 'Body font'}
                          </Label>
                          <Input
                            value={current}
                            onChange={(e) => setFont(key, e.target.value)}
                            placeholder="Inter, sans-serif"
                            className="font-mono text-xs"
                          />
                          <div className="flex flex-wrap gap-1.5">
                            {FONT_PRESETS.map((f) => (
                              <button
                                key={f}
                                type="button"
                                onClick={() => setFont(key, f)}
                                className={cn(
                                  'text-xs px-2 py-1 rounded border transition-colors',
                                  current === f
                                    ? 'border-primary bg-primary/10 text-primary'
                                    : 'border-border hover:bg-muted',
                                )}
                                style={{ fontFamily: f }}
                              >
                                {f.split(',')[0]}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted-foreground">
                      To use Google Fonts not listed here, an admin must add them to the platform theme so the
                      stylesheet is loaded automatically.
                    </p>
                  </TabsContent>

                  {/* Shape */}
                  <TabsContent value="shape" className="space-y-6 mt-0">
                    <div className="space-y-2">
                      <Label className="text-sm">
                        Corner radius —{' '}
                        <span className="font-mono text-xs">
                          {overrides.radius ?? baseTokens.radius ?? '0.5rem'}
                        </span>
                      </Label>
                      <Slider
                        min={0}
                        max={24}
                        step={1}
                        value={[parseRem(overrides.radius ?? baseTokens.radius ?? '0.5rem')]}
                        onValueChange={(v) => setRadius(`${(v[0] / 16).toFixed(3)}rem`)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm">Button style</Label>
                      <div className="flex flex-wrap gap-2">
                        {BUTTON_STYLES.map((s) => {
                          const active = (overrides.button_style ?? baseTokens.button_style ?? 'solid') === s;
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setButtonStyle(s)}
                              className={cn(
                                'text-sm px-3 py-1.5 rounded border capitalize transition-colors',
                                active
                                  ? 'border-primary bg-primary/10 text-primary font-medium'
                                  : 'border-border hover:bg-muted',
                              )}
                            >
                              {s}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: live preview */}
          <div className="xl:sticky xl:top-6 xl:self-start">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Live preview</CardTitle>
              </CardHeader>
              <CardContent>
                <ThemePreview tokens={mergedTokens} restaurantName={restaurant.name} />
                <p className="mt-3 text-xs text-muted-foreground">
                  Changes here only affect the preview. Click <strong>Save changes</strong> to publish to your
                  public website.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </OwnerLayout>
  );
}

/* -------------------------------------------------------------------------- */
/*  Live preview                                                              */
/* -------------------------------------------------------------------------- */

function ThemePreview({ tokens, restaurantName }: { tokens: ThemeTokens; restaurantName: string }) {
  const c = tokens.colors ?? {};
  const f = tokens.fonts ?? {};
  const radius = tokens.radius ?? '0.5rem';
  const buttonStyle = tokens.button_style ?? 'solid';

  const style: CSSProperties = {
    background: c.bg_primary ?? '#0a0a0a',
    color: c.text_primary ?? '#fafafa',
    fontFamily: f.body_family ?? 'Inter, sans-serif',
    borderRadius: radius,
  };

  const accent = c.accent ?? '#f59e0b';
  const buttonBase: CSSProperties = {
    fontFamily: f.heading_family ?? f.body_family,
    borderRadius: buttonStyle === 'pill' ? '9999px' : buttonStyle === 'sharp' ? '0' : radius,
    padding: '0.5rem 1rem',
    fontWeight: 600,
    fontSize: '0.8125rem',
    transition: 'opacity 0.15s',
    border: `1px solid ${accent}`,
    cursor: 'pointer',
  };

  const primaryBtn: CSSProperties = {
    ...buttonBase,
    background: buttonStyle === 'outline' ? 'transparent' : accent,
    color: buttonStyle === 'outline' ? accent : c.bg_primary ?? '#0a0a0a',
  };

  const secondaryBtn: CSSProperties = {
    ...buttonBase,
    background: 'transparent',
    color: c.text_primary ?? '#fafafa',
    borderColor: c.text_muted ?? 'rgba(255,255,255,0.2)',
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border" style={style}>
      {/* Nav */}
      <div
        className="flex items-center justify-between px-4 py-3 text-xs"
        style={{
          background: c.nav_bg ?? c.bg_secondary ?? 'rgba(0,0,0,0.5)',
          color: c.nav_text ?? c.text_primary,
          fontFamily: f.heading_family ?? f.body_family,
        }}
      >
        <span className="font-semibold tracking-tight">{restaurantName}</span>
        <div className="flex gap-3 opacity-90">
          <span>Menu</span>
          <span>About</span>
          <span style={{ color: c.nav_accent ?? accent }}>Reserve</span>
        </div>
      </div>

      {/* Hero */}
      <div className="px-5 py-8 text-center space-y-3">
        <div
          className="text-2xl leading-tight"
          style={{ fontFamily: f.heading_family ?? f.body_family, fontWeight: 700 }}
        >
          A taste worth remembering
        </div>
        <div className="text-xs opacity-70 max-w-xs mx-auto" style={{ color: c.text_muted ?? undefined }}>
          Hand-crafted dishes served in a warm, intimate setting since 1998.
        </div>
        <div className="flex items-center justify-center gap-2 pt-2">
          <button style={primaryBtn}>Order now</button>
          <button style={secondaryBtn}>View menu</button>
        </div>
      </div>

      {/* Card */}
      <div className="px-5 pb-5">
        <div
          className="p-4 flex items-center gap-3"
          style={{
            background: c.bg_secondary ?? 'rgba(255,255,255,0.04)',
            borderRadius: radius,
            border: `1px solid ${c.text_muted ?? 'rgba(255,255,255,0.08)'}`,
          }}
        >
          <div
            className="h-10 w-10 flex-shrink-0 flex items-center justify-center text-sm font-bold"
            style={{
              background: c.accent_light ?? accent,
              color: c.bg_primary ?? '#0a0a0a',
              borderRadius: radius,
            }}
          >
            ★
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate" style={{ fontFamily: f.heading_family ?? f.body_family }}>
              Truffle Risotto
            </div>
            <div className="text-xs opacity-70 truncate" style={{ color: c.text_muted ?? undefined }}>
              Arborio rice, black truffle, parmesan
            </div>
          </div>
          <div className="text-sm font-semibold" style={{ color: accent }}>
            $24
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function normalizeHex(v: string): string {
  if (!v) return '';
  const m = v.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return '';
  return v.startsWith('#') ? v : `#${v}`;
}

function parseRem(v: string): number {
  const m = v.match(/^([\d.]+)\s*(rem|px)?$/);
  if (!m) return 8;
  const n = parseFloat(m[1]);
  return m[2] === 'px' ? n : n * 16;
}
