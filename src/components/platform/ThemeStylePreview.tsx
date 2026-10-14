import { useEffect } from 'react';
import type { ThemeTokens } from '@/hooks/usePlatformThemes';
import { accentForeground, normalizeThemeTokens } from '@/lib/theme-presets';
import foodImage from '@/assets/hero-food.jpg';

/** A representative style preview, using the same saved tokens as the website. */
export default function ThemeStylePreview({ tokens, large = false }: { tokens?: ThemeTokens; large?: boolean }) {
  const theme = normalizeThemeTokens(tokens);
  const c = theme.colors!;
  const fontFamilies = (theme.fonts?.google_fonts ?? []).join('|');
  useEffect(() => {
    if (!fontFamilies) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${fontFamilies.split('|').map(family => `family=${family}`).join('&')}&display=swap`;
    document.head.appendChild(link);
    return () => link.remove();
  }, [fontFamilies]);
  const outlined = theme.button_style === 'outline';
  const radius = theme.button_style === 'pill' ? '999px' : theme.button_style === 'sharp' ? '0' : theme.radius;
  return <div aria-label="Theme style preview" className={`overflow-hidden ${large ? 'rounded-2xl border' : ''}`} style={{ background: c.bg_primary, color: c.text_primary, fontFamily: theme.fonts?.body_family }}>
    <div className={`flex items-center justify-between border-b px-5 ${large ? 'py-4' : 'py-3'}`} style={{ background: c.nav_bg, color: c.nav_text, borderColor: `color-mix(in srgb, ${c.text_muted} 20%, transparent)` }}><span className="text-xs font-semibold tracking-widest">BELLA TABLE</span><span className="flex gap-3 text-[9px] opacity-75"><span>Menu</span><span>Our story</span></span></div>
    <div className={`grid grid-cols-[1.1fr_1fr] items-center gap-4 ${large ? 'p-6 sm:gap-6 sm:p-9' : 'p-5'}`}>
      <div className="min-w-0"><p className={`${large ? 'text-[10px]' : 'text-[8px]'} uppercase tracking-[0.2em]`} style={{ color: c.accent }}>A place at our table</p><h3 className={`mt-3 leading-[1.12] ${large ? 'text-3xl sm:text-5xl' : 'text-[25px]'}`} style={{ fontFamily: theme.fonts?.heading_family }}>Good food.<br />Great company.</h3>{large && <p className="mt-4 max-w-sm text-sm leading-relaxed" style={{ color: c.text_muted }}>Fresh ingredients, familiar faces, and something delicious for everyone.</p>}<span className={`mt-5 inline-flex items-center justify-center border font-medium ${large ? 'px-5 py-3 text-xs' : 'px-3 py-2 text-[9px]'}`} style={{ background: outlined ? 'transparent' : c.accent, color: outlined ? c.accent : accentForeground(c.accent!), borderColor: c.accent, borderRadius: radius }}>Explore the menu</span></div>
      <div className={`relative overflow-hidden ${large ? 'aspect-[4/5]' : 'aspect-[4/5]'}`} style={{ borderRadius: theme.homepage_template === 'modern' ? '50% 50% 0 0' : theme.radius }}><img src={foodImage} alt="Sample restaurant dishes" className="h-full w-full object-cover" loading="lazy" /><div className="absolute bottom-2 left-2 right-2 rounded-lg px-2 py-2 text-center text-[8px] font-medium backdrop-blur" style={{ background: `color-mix(in srgb, ${c.bg_primary} 90%, transparent)`, color: c.text_primary }}>Seasonal favorites · Made with care</div></div>
    </div>
    {large && <div className="grid grid-cols-3 gap-3 px-6 pb-6 sm:px-9 sm:pb-9">{['Fresh & seasonal', 'Made for sharing', 'Always welcoming'].map(text => <div key={text} className="rounded-lg px-2 py-4 text-center text-[10px] sm:text-xs" style={{ background: c.bg_secondary, color: c.text_muted }}>{text}</div>)}</div>}
  </div>;
}
