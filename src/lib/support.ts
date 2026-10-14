import type { Database } from '@/integrations/supabase/types';

export type SupportConversation = Database['public']['Tables']['support_conversations']['Row'];
export type SupportMessage = Database['public']['Tables']['support_messages']['Row'];
export type SupportSettings = Database['public']['Tables']['support_settings']['Row'];
export type SupportSavedReply = Database['public']['Tables']['support_saved_replies']['Row'];

export type SupportStatus = 'bot' | 'open' | 'pending' | 'resolved' | 'closed';
export type SupportCategory = 'sales' | 'billing' | 'technical' | 'other';

export const SUPPORT_CATEGORIES: { value: SupportCategory; label: string }[] = [
  { value: 'sales', label: 'Plans & pricing' },
  { value: 'billing', label: 'Billing & payments' },
  { value: 'technical', label: 'Technical help' },
  { value: 'other', label: 'Something else' },
];

export const STATUS_LABELS: Record<SupportStatus, string> = {
  bot: 'ServeOS AI',
  open: 'Open',
  pending: 'Waiting on customer',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Realtime channel names shared by the widget and the inbox. */
export const AGENT_PRESENCE_CHANNEL = 'support-agents';
export const typingChannelName = (conversationId: string) => `support-typing-${conversationId}`;

interface BusinessHours {
  days?: number[];   // 0 = Sunday … 6 = Saturday
  start?: string;    // "HH:MM"
  end?: string;      // "HH:MM"
}

/** True when "now" falls inside the configured support hours. */
export function isWithinBusinessHours(settings: Pick<SupportSettings, 'business_hours' | 'timezone'> | null | undefined, now = new Date()): boolean {
  const hours = (settings?.business_hours ?? null) as BusinessHours | null;
  if (!hours?.start || !hours?.end) return true;
  let weekday: number;
  let hhmm: string;
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: settings?.timezone || 'UTC',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
    hhmm = `${get('hour')}:${get('minute')}`;
  } catch {
    return true;
  }
  if (hours.days && !hours.days.includes(weekday)) return false;
  return hhmm >= hours.start && hhmm < hours.end;
}

/** Merge snapshots and live updates without dropping newly delivered messages. */
export function mergeSupportMessages(existing: SupportMessage[], incoming: SupportMessage[]): SupportMessage[] {
  const messages = new Map(existing.map(message => [message.id, message]));
  for (const message of incoming) messages.set(message.id, message);
  return [...messages.values()].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
}
