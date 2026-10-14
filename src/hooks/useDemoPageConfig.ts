import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DemoEmbed {
  title: string;
  description: string;
  iframeSrc: string;
  ctaLabel: string;
  ctaHref: string;
  icon: string;
  badge?: string;
}

export interface DemoFeature {
  icon: string;
  title: string;
  description: string;
}

export interface DemoPageConfig {
  id: string;
  hero: {
    eyebrow?: string;
    title?: string;
    description?: string;
  };
  credentials: {
    heading?: string;
    subheading?: string;
    email?: string;
    password?: string;
    primaryCtaLabel?: string;
    primaryCtaHref?: string;
    secondaryCtaLabel?: string;
    secondaryCtaHref?: string;
  };
  features: DemoFeature[];
  embeds: DemoEmbed[];
  cta: {
    heading?: string;
    subheading?: string;
    primaryLabel?: string;
    primaryHref?: string;
    secondaryLabel?: string;
    secondaryHref?: string;
  };
}

export const DEMO_CONFIG_FALLBACK: Omit<DemoPageConfig, 'id'> = {
  hero: {
    eyebrow: 'Live product demo',
    title: 'Inside a live restaurant',
    description:
      'This is a real restaurant in our system. Every number, ticket, and chart below is rendered from the same database your business would use.',
  },
  credentials: {
    heading: 'Sign in as the Bella Cucina demo owner',
    subheading:
      "Use the credentials below to log in and explore every screen — admin dashboard, kitchen display, POS, orders, analytics, settings. It's a real account on a real restaurant.",
    email: 'owner@bellacucina.demo',
    password: 'DemoOwner2025!',
    primaryCtaLabel: 'Open admin login',
    primaryCtaHref: '/login',
    secondaryCtaLabel: 'View guest site',
    secondaryCtaHref: '/r/demo',
  },
  features: [],
  embeds: [
    { title: 'Guest homepage', description: '', iframeSrc: '/r/demo', ctaLabel: 'View Demo', ctaHref: '/r/demo', icon: 'Sparkles', badge: 'Live' },
  ],
  cta: {
    heading: 'Ready to run your own?',
    subheading: 'Spin up your restaurant in under 5 minutes.',
    primaryLabel: 'Get started',
    primaryHref: '/signup',
    secondaryLabel: 'See pricing',
    secondaryHref: '/pricing',
  },
};

export function useDemoPageConfig() {
  return useQuery<DemoPageConfig | null>({
    queryKey: ['demo-page-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('demo_page_config' as any)
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as DemoPageConfig) ?? null;
    },
    staleTime: 60_000,
  });
}
