import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface ThemeColors {
  bg_primary?: string;
  bg_secondary?: string;
  accent?: string;
  accent_light?: string;
  text_primary?: string;
  text_muted?: string;
  nav_bg?: string;
  nav_text?: string;
  nav_accent?: string;
}

export interface ThemeFonts {
  heading_family?: string;
  body_family?: string;
  google_fonts?: string[];
}

export type ButtonStyle = 'solid' | 'outline' | 'pill' | 'sharp';

export interface ThemeTokens {
  colors?: ThemeColors;
  fonts?: ThemeFonts;
  radius?: string;
  button_style?: ButtonStyle;
  homepage_template?: string;
}

export interface PlatformTheme {
  id: string;
  key: string;
  name: string;
  description: string | null;
  preview_image: string | null;
  tokens: ThemeTokens;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/* -------------------------------------------------------------------------- */
/*  Hooks                                                                     */
/* -------------------------------------------------------------------------- */

/** Fetch the full theme catalog. Pass `activeOnly` for the public site. */
export function usePlatformThemes(opts: { activeOnly?: boolean } = {}) {
  const { activeOnly = false } = opts;
  return useQuery<PlatformTheme[]>({
    queryKey: ['platform-themes', activeOnly],
    queryFn: async () => {
      let q = supabase.from('platform_themes').select('*').order('sort_order');
      if (activeOnly) q = q.eq('is_active', true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as PlatformTheme[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Fetch a single theme by id. */
export function usePlatformTheme(id: string | null | undefined) {
  return useQuery<PlatformTheme | null>({
    queryKey: ['platform-theme', id ?? 'none'],
    enabled: !!id,
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('platform_themes')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PlatformTheme) ?? null;
    },
    staleTime: 5 * 60_000,
  });
}

/** Deep-merge two ThemeTokens objects (overrides win, undefined values ignored). */
export function mergeThemeTokens(base: ThemeTokens | undefined, overrides: ThemeTokens | undefined): ThemeTokens {
  if (!base && !overrides) return {};
  if (!overrides) return base ?? {};
  const out: ThemeTokens = { ...(base ?? {}) };
  if (overrides.colors || base?.colors) {
    out.colors = { ...(base?.colors ?? {}), ...stripUndefined(overrides.colors ?? {}) };
  }
  if (overrides.fonts || base?.fonts) {
    out.fonts = { ...(base?.fonts ?? {}), ...stripUndefined(overrides.fonts ?? {}) };
  }
  if (overrides.radius !== undefined) out.radius = overrides.radius;
  if (overrides.button_style !== undefined) out.button_style = overrides.button_style;
  if (overrides.homepage_template !== undefined) out.homepage_template = overrides.homepage_template;
  return out;
}

function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const key of Object.keys(obj) as Array<keyof T>) {
    const value = obj[key];
    if (value !== undefined && value !== null && value !== '') out[key] = value;
  }
  return out;
}

/**
 * Resolves the active restaurant's assigned theme + per-tenant overrides.
 * Used by the public website to apply colors/fonts/etc.
 */
export function useRestaurantTheme() {
  const { restaurant } = useResolvedRestaurant();
  const themeId = restaurant?.theme_id ?? null;
  const overrides = restaurant?.theme_overrides ?? null;
  const baseQuery = usePlatformTheme(themeId);
  const merged = mergeThemeTokens(baseQuery.data?.tokens, overrides ?? undefined);
  return {
    ...baseQuery,
    data: baseQuery.data
      ? ({ ...baseQuery.data, tokens: merged } as PlatformTheme)
      : overrides
        ? ({
            id: 'custom',
            key: 'custom',
            name: 'Custom',
            description: null,
            preview_image: null,
            tokens: merged,
            is_active: true,
            sort_order: 0,
            created_at: '',
            updated_at: '',
          } as PlatformTheme)
        : null,
    baseTheme: baseQuery.data ?? null,
    overrides: overrides ?? null,
  };
}
