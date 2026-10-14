import type { TemplateColors } from '@/hooks/useThemeColors';

export interface HomeTemplateProps {
  name: string;
  content: any;
  featuredItems: any[];
  format: (n: number) => string;
  featuredConfig: any;
  themeColors?: TemplateColors;
}
