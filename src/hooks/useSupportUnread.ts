import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Platform admins: number of conversations with unread customer messages,
 * kept live. Shows a desktop notification when a new customer message
 * arrives while the tab is in the background (if permission was granted).
 */
export function useSupportUnread(enabled = true) {
  const [count, setCount] = useState(0);
  const total = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const refresh = async () => {
      const { data } = await supabase
        .from('support_conversations')
        .select('unread_for_agent')
        .gt('unread_for_agent', 0)
        .in('status', ['open', 'pending', 'bot']);
      if (cancelled) return;
      const rows = data ?? [];
      const messages = rows.reduce((s, r) => s + (r.unread_for_agent ?? 0), 0);
      if (total.current !== null && messages > total.current && document.hidden
        && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('New support message', { body: 'A customer is waiting in the support inbox.', tag: 'support-inbox' });
      }
      total.current = messages;
      setCount(rows.length);
    };

    void refresh();
    const ch = supabase
      .channel('support-unread-badge')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => { void refresh(); })
      .subscribe();
    return () => {
      cancelled = true;
      void supabase.removeChannel(ch);
    };
  }, [enabled]);

  return count;
}
