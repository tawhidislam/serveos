import { useEffect } from 'react';
import { useSettings } from '@/hooks/useSettings';

/** Converts a hex color like #e87c1e to HSL values string like "24 80% 51%" */
function hexToHSL(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Injects branding CSS variables from restaurant settings into the document root.
 * Renders nothing — purely a side-effect component.
 */
export default function BrandingInjector() {
  const { data: settings } = useSettings();

  useEffect(() => {
    if (!settings) return;

    const root = document.documentElement;

    if (settings.primary_color) {
      const hsl = hexToHSL(settings.primary_color);
      if (hsl) {
        root.style.setProperty('--primary', hsl);
        root.style.setProperty('--ring', hsl);
        root.style.setProperty('--accent', hsl);
      }
    }

    if (settings.accent_color) {
      const hsl = hexToHSL(settings.accent_color);
      if (hsl) {
        root.style.setProperty('--gold', hsl);
      }
    }

    return () => {
      root.style.removeProperty('--primary');
      root.style.removeProperty('--ring');
      root.style.removeProperty('--accent');
      root.style.removeProperty('--gold');
    };
  }, [settings?.primary_color, settings?.accent_color]);

  return null;
}
