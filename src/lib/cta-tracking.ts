import { supabase } from '@/integrations/supabase/client';
import { classifyCtaDestination } from '@/lib/cta-destinations';

/**
 * Records a website CTA click. Fire-and-forget: tracking must never block or
 * break navigation, so all failures are swallowed (logged in dev only).
 */
export async function trackCtaClick(params: {
  restaurantId: string | null | undefined;
  destination: string;
  label?: string | null;
  source?: string | null;
}) {
  const { restaurantId, destination } = params;
  if (!restaurantId || !destination) return;

  const { type, fulfillment } = classifyCtaDestination(destination);

  try {
    const { error } = await supabase.from('cta_clicks').insert({
      restaurant_id: restaurantId,
      destination: destination.slice(0, 500),
      destination_type: type,
      fulfillment,
      label: params.label ? String(params.label).slice(0, 120) : null,
      source: params.source ? String(params.source).slice(0, 60) : null,
      page_path: typeof window !== 'undefined' ? window.location.pathname.slice(0, 300) : null,
    });
    if (error && import.meta.env.DEV) console.warn('CTA tracking failed:', error.message);
  } catch (err) {
    if (import.meta.env.DEV) console.warn('CTA tracking failed:', err);
  }
}
