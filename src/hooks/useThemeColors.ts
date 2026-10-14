import { useRestaurantTheme } from './usePlatformThemes';
import { useHomepageContent } from './useHomepageContent';
import { useSettings } from './useSettings';
import { useResolvedRestaurant } from './useResolvedRestaurant';

export interface TemplateColors {
  bg_primary?: string;
  bg_secondary?: string;
  accent?: string;
  accent_light?: string;
  text_primary?: string;
}

export function useThemeColors(): TemplateColors {
  const { data: settings } = useSettings();
  const { restaurantId } = useResolvedRestaurant();
  const { data: content } = useHomepageContent(restaurantId);
  const { data: theme } = useRestaurantTheme();
  const template = theme?.tokens.homepage_template || settings?.homepage_template || 'classic';
  const themeColors = (content as unknown as { theme_colors?: Record<string, TemplateColors> } | undefined)?.theme_colors;
  return { ...theme?.tokens.colors, ...themeColors?.[template] };
}
