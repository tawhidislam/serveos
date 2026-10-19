import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface FooterSocialLink {
  icon: string; // 'twitter' | 'github' | 'linkedin' | 'facebook' | 'instagram' | 'youtube'
  href: string;
  label: string;
}

export interface FooterColumnLink {
  label: string;
  to: string;
}

export interface FooterColumn {
  title: string;
  links: FooterColumnLink[];
}

export interface MarketingFooterSettings {
  id: string;
  tagline: string;
  social_links: FooterSocialLink[];
  columns: FooterColumn[];
  copyright_text: string;
  bottom_tagline: string;
}

export const FOOTER_DEFAULT: Omit<MarketingFooterSettings, 'id'> = {
  tagline:
    'The all-in-one restaurant management system. QR ordering, kitchen displays, billing, and analytics — built for modern hospitality.',
  social_links: [
    { icon: 'twitter', href: '#', label: 'Twitter' },
    { icon: 'github', href: '#', label: 'GitHub' },
    { icon: 'linkedin', href: '#', label: 'LinkedIn' },
  ],
  columns: [
    { title: 'Product', links: [{ label: 'Features', to: '/features' }, { label: 'Pricing', to: '/pricing' }, { label: 'Demo', to: '/demo' }, { label: 'Download app', to: '/download' }] },
    { title: 'Company', links: [{ label: 'About', to: '/about' }, { label: 'Contact', to: '/contact' }] },
    { title: 'Account', links: [{ label: 'Sign in', to: '/login' }, { label: 'Get started', to: '/signup' }] },
    { title: 'Legal', links: [
      { label: 'Terms & Conditions', to: '/terms' },
      { label: 'Privacy Policy', to: '/privacy' },
      { label: 'Refund Policy', to: '/refund-policy' },
    ] },
  ],
  copyright_text: '© {year} {siteName}. All rights reserved.',
  bottom_tagline: 'Built for restaurants that move fast.',
};

export function useMarketingFooter() {
  return useQuery({
    queryKey: ['marketing-footer-settings'],
    queryFn: async (): Promise<MarketingFooterSettings> => {
      const { data, error } = await supabase
        .from('marketing_footer_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { id: '', ...FOOTER_DEFAULT };
      return {
        id: data.id,
        tagline: data.tagline ?? FOOTER_DEFAULT.tagline,
        social_links: Array.isArray(data.social_links) ? (data.social_links as unknown as FooterSocialLink[]) : FOOTER_DEFAULT.social_links,
        columns: Array.isArray(data.columns) ? (data.columns as unknown as FooterColumn[]) : FOOTER_DEFAULT.columns,
        copyright_text: data.copyright_text ?? FOOTER_DEFAULT.copyright_text,
        bottom_tagline: data.bottom_tagline ?? FOOTER_DEFAULT.bottom_tagline,
      };
    },
    staleTime: 60_000,
  });
}
