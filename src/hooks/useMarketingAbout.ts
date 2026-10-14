import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Build a public storage URL from the configured Supabase client, so default
 * marketing images follow whatever backend `.env` points at (local or hosted)
 * instead of a hardcoded project host.
 */
const storagePublicUrl = (bucket: string, path: string) =>
  supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export interface AboutPillar {
  icon: string; // 'target' | 'eye' | 'heart' | 'zap' | 'shield' | 'users'
  title: string;
  body: string;
}

export interface MarketingAboutSettings {
  id: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_description: string;
  hero_image_url: string | null;
  pillars: AboutPillar[];
  why_eyebrow: string;
  why_title: string;
  values_items: AboutPillar[];
  story_eyebrow: string;
  story_title: string;
  story_paragraphs: string[];
  story_image_url: string | null;
  cta_title: string;
  cta_primary_label: string;
  cta_primary_href: string;
  cta_secondary_label: string;
  cta_secondary_href: string;
  meta_title: string;
  meta_description: string;
}

export const ABOUT_DEFAULT: Omit<MarketingAboutSettings, 'id'> = {
  hero_eyebrow: 'About ServeOS',
  hero_title: 'The operating system for modern restaurants',
  hero_description:
    'ServeOS replaces a tangle of POS terminals, QR menu apps, kitchen displays, and spreadsheets with one calm, elegant platform — built for the people who actually work the floor.',
  hero_image_url: storagePublicUrl(
    'platform-assets',
    'marketing/about-hero.jpg',
  ),
  pillars: [
    {
      icon: 'target',
      title: 'Our mission',
      body: 'Give every restaurant — from a single trattoria to a 50-location group — software that feels as considered as the food they serve. Beautiful, fast, and priced fairly.',
    },
    {
      icon: 'eye',
      title: 'Our vision',
      body: 'A world where running a restaurant is about hospitality, not patched-together tools. Where the technology disappears into the background and great service takes the stage.',
    },
  ],
  why_eyebrow: 'Why teams choose ServeOS',
  why_title: 'Built for the way restaurants actually run',
  values_items: [
    {
      icon: 'zap',
      title: 'One platform, one bill',
      body: 'Menu, ordering, KDS, waiter app, POS, billing, and accounting — all wired together. No more juggling four vendors and a stack of integrations.',
    },
    {
      icon: 'heart',
      title: 'Designed by hospitality people',
      body: 'Every screen has been pressure-tested on a busy Saturday night. If a feature does not survive a Friday rush, it does not ship.',
    },
    {
      icon: 'shield',
      title: 'Enterprise-grade by default',
      body: 'Per-tenant isolation, row-level security, full audit trails, and role-based access — the same standards a 50-location group would demand, available from day one.',
    },
    {
      icon: 'users',
      title: 'Honest, flat pricing',
      body: 'A predictable monthly fee. No per-order surcharges, no commission on revenue, and no surprise invoices when you have a great month.',
    },
    {
      icon: 'target',
      title: 'Up and running in an hour',
      body: 'Import a menu, print your QR codes, invite your team — and start taking orders the same afternoon. No installer, no on-site visit.',
    },
    {
      icon: 'eye',
      title: 'Transparent roadmap',
      body: 'We publish what we are building, what we are fixing, and what is next. You always know where the product is headed.',
    },
  ],
  story_eyebrow: 'Our story',
  story_title: 'From the line to the laptop',
  story_paragraphs: [
    "ServeOS started in 2024, when our founder spent six months helping a friend's neighbourhood bistro untangle their tech stack. They had a tablet for QR menus, a separate kitchen display, a POS that did not talk to anything, and an accountant asking for spreadsheets every Monday morning.",
    'We kept asking the same question: why is this so hard? Big chains had it figured out — but their software cost tens of thousands of dollars and took months to roll out. Independent restaurants, the ones that give a city its character, deserved better than a patchwork of subscriptions.',
    "So we built ServeOS: a single platform that handles everything from the customer's first scan at the table to the closing books at the end of the month — priced for the restaurants that actually exist on your street, not just the ones inside an airport.",
    'Today, ServeOS powers QR ordering, kitchen displays, waiter and server workflows, full POS, menu and reservations, marketing, and accounting for restaurants that want their software to feel as thoughtful as their hospitality.',
  ],
  story_image_url: storagePublicUrl(
    'platform-assets',
    'marketing/about-story.jpg',
  ),
  cta_title: 'Ready to run a calmer restaurant?',
  cta_primary_label: 'Start free',
  cta_primary_href: '/signup',
  cta_secondary_label: 'Talk to us',
  cta_secondary_href: '/contact',
  meta_title: 'About ServeOS — The operating system for modern restaurants',
  meta_description:
    'ServeOS gives independent restaurants and growing groups one elegant platform for QR ordering, kitchen, POS, and accounting. Learn our mission, vision, and story.',
};

export function useMarketingAbout() {
  return useQuery({
    queryKey: ['marketing-about-settings'],
    queryFn: async (): Promise<MarketingAboutSettings> => {
      const { data, error } = await supabase
        .from('marketing_about_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { id: '', ...ABOUT_DEFAULT };
      const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
      return {
        id: data.id,
        hero_eyebrow: data.hero_eyebrow ?? ABOUT_DEFAULT.hero_eyebrow,
        hero_title: data.hero_title ?? ABOUT_DEFAULT.hero_title,
        hero_description: data.hero_description ?? ABOUT_DEFAULT.hero_description,
        hero_image_url: data.hero_image_url ?? null,
        pillars: arr<AboutPillar>(data.pillars, ABOUT_DEFAULT.pillars),
        why_eyebrow: data.why_eyebrow ?? ABOUT_DEFAULT.why_eyebrow,
        why_title: data.why_title ?? ABOUT_DEFAULT.why_title,
        values_items: arr<AboutPillar>(data.values_items, ABOUT_DEFAULT.values_items),
        story_eyebrow: data.story_eyebrow ?? ABOUT_DEFAULT.story_eyebrow,
        story_title: data.story_title ?? ABOUT_DEFAULT.story_title,
        story_paragraphs: arr<string>(data.story_paragraphs, ABOUT_DEFAULT.story_paragraphs),
        story_image_url: data.story_image_url ?? null,
        cta_title: data.cta_title ?? ABOUT_DEFAULT.cta_title,
        cta_primary_label: data.cta_primary_label ?? ABOUT_DEFAULT.cta_primary_label,
        cta_primary_href: data.cta_primary_href ?? ABOUT_DEFAULT.cta_primary_href,
        cta_secondary_label: data.cta_secondary_label ?? ABOUT_DEFAULT.cta_secondary_label,
        cta_secondary_href: data.cta_secondary_href ?? ABOUT_DEFAULT.cta_secondary_href,
        meta_title: data.meta_title ?? ABOUT_DEFAULT.meta_title,
        meta_description: data.meta_description ?? ABOUT_DEFAULT.meta_description,
      };
    },
    staleTime: 60_000,
  });
}

export const ABOUT_ICON_OPTIONS = [
  { value: 'target', label: 'Target' },
  { value: 'eye', label: 'Eye' },
  { value: 'heart', label: 'Heart' },
  { value: 'zap', label: 'Zap' },
  { value: 'shield', label: 'Shield' },
  { value: 'users', label: 'Users' },
] as const;