import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactInfoEntry {
  icon: string; // 'mail' | 'phone' | 'map' | 'clock'
  label: string;
  value: string;
}

export interface MarketingContactSettings {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  contact_info: ContactInfoEntry[];
  reasons: string[];
  response_time_text: string;
}

export const CONTACT_DEFAULT: Omit<MarketingContactSettings, 'id'> = {
  eyebrow: 'Contact',
  title: "Let's talk",
  description:
    "Questions about pricing, demos, or onboarding? Drop us a note and we'll get back within one business day.",
  contact_info: [
    { icon: 'mail', label: 'Email', value: 'hello@serveos.com' },
    { icon: 'phone', label: 'Phone', value: '+1 (555) 010-2024' },
    { icon: 'map', label: 'Office', value: '124 Restaurant Row\nNew York, NY 10013' },
  ],
  reasons: ['General inquiry', 'Sales / pricing', 'Book a demo', 'Partnership', 'Support', 'Other'],
  response_time_text: 'We typically respond within one business day.',
};

export function useMarketingContact() {
  return useQuery({
    queryKey: ['marketing-contact-settings'],
    queryFn: async (): Promise<MarketingContactSettings> => {
      const { data, error } = await supabase
        .from('marketing_contact_settings')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { id: '', ...CONTACT_DEFAULT };
      return {
        id: data.id,
        eyebrow: data.eyebrow ?? CONTACT_DEFAULT.eyebrow,
        title: data.title ?? CONTACT_DEFAULT.title,
        description: data.description ?? CONTACT_DEFAULT.description,
        contact_info: Array.isArray(data.contact_info)
          ? (data.contact_info as unknown as ContactInfoEntry[])
          : CONTACT_DEFAULT.contact_info,
        reasons: Array.isArray(data.reasons)
          ? (data.reasons as unknown as string[])
          : CONTACT_DEFAULT.reasons,
        response_time_text: data.response_time_text ?? CONTACT_DEFAULT.response_time_text,
      };
    },
    staleTime: 60_000,
  });
}
