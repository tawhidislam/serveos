import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

type BillingDatabase = Database & { public: { Functions: {
  review_subscription_payment: { Args: { p_payment_id: string; p_decision: string; p_notes: string | null }; Returns: Json };
} } };
const billingClient = supabase as unknown as SupabaseClient<BillingDatabase>;
export async function reviewSubscriptionPayment(id: string, decision: 'approved' | 'rejected', notes: string) {
  const { error } = await billingClient.rpc('review_subscription_payment', { p_payment_id: id, p_decision: decision, p_notes: notes.trim() || null });
  if (error) throw new Error(error.message);
}
