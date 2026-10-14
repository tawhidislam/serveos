import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  AGENT_PRESENCE_CHANNEL,
  mergeSupportMessages,
  typingChannelName,
  type SupportConversation,
  type SupportMessage,
  type SupportStatus,
} from '@/lib/support';
import { uploadSupportAttachment, type SupportAttachment } from '@/lib/support-attachments';
import type { Database } from '@/integrations/supabase/types';

export type InboxFilter = 'active' | 'mine' | 'unassigned' | 'bot' | 'resolved' | 'all';

/** Platform-admin side of live support: conversation list, thread, presence. */
export function useSupportInbox(filter: InboxFilter, search: string) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(search);
  const listRequest = useRef(0);
  const activeRequest = useRef(0);
  const selectedId = useRef<string | null>(null);

  const [activeId, setActiveIdState] = useState<string | null>(null);
  selectedId.current = activeId;
  useEffect(() => { const timer = setTimeout(() => setSearchTerm(search), 250); return () => clearTimeout(timer); }, [search]);
  const [activeConv, setActiveConv] = useState<SupportConversation | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [requesterTyping, setRequesterTyping] = useState(false);
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [connectionState, setConnectionState] = useState<'connecting' | 'online' | 'offline'>('connecting');
  const selectConversation = useCallback((id: string | null) => {
    selectedId.current = id;
    setActiveIdState(id);
    setActiveConv(null);
    setMessages([]);
    setThreadError(null);
  }, []);
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);

  const load = useCallback(async () => {
    const request = ++listRequest.current;
    let q = supabase.from('support_conversations').select('*').order('last_message_at', { ascending: false }).limit(200);
    if (filter === 'active') q = q.in('status', ['open', 'pending', 'bot']);
    if (filter === 'mine' && user) q = q.eq('assigned_admin_id', user.id).in('status', ['open', 'pending', 'bot']);
    if (filter === 'unassigned') q = q.is('assigned_admin_id', null).in('status', ['open', 'pending']);
    if (filter === 'bot') q = q.eq('status', 'bot');
    if (filter === 'resolved') q = q.in('status', ['resolved', 'closed']);
    const term = searchTerm.trim().replace(/[%,()"\\]/g, ' ');
    if (term) {
      q = q.or(`subject.ilike.%${term}%,visitor_name.ilike.%${term}%,visitor_email.ilike.%${term}%,last_message_preview.ilike.%${term}%`);
    }
    const { data, error: loadError } = await q;
    if (request !== listRequest.current) return;
    setError(loadError?.message ?? null);
    setConversations(data ?? []);
    setLoading(false);
  }, [filter, searchTerm, user]);

  // The open conversation stays visible even when the filter hides it
  // (e.g. right after resolving it).
  const loadActive = useCallback(async () => {
    const request = ++activeRequest.current;
    if (!activeId) {
      setActiveConv(null);
      return;
    }
    const { data, error } = await supabase.from('support_conversations').select('*').eq('id', activeId).maybeSingle();
    if (request !== activeRequest.current || selectedId.current !== activeId) return;
    setThreadError(error?.message ?? (data ? null : 'This conversation is no longer available.'));
    setActiveConv(data ?? null);
  }, [activeId]);

  const latestLoad = useRef(load);
  const latestActive = useRef(loadActive);
  latestLoad.current = load;
  latestActive.current = loadActive;

  useEffect(() => { void loadActive(); }, [loadActive]);

  useEffect(() => { setLoading(true); void load(); }, [load]);

  // Any conversation change → refresh the list.
  useEffect(() => {
    const ch = supabase
      .channel('support-inbox-convs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations' }, () => {
        void load();
        void loadActive();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, loadActive]);

  // Selected thread, live.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setMessagesLoading(true);
    setThreadError(null);
    supabase
      .from('support_messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => { if (!cancelled) { setMessages(previous => mergeSupportMessages(previous, data ?? [])); setThreadError(error?.message ?? null); setMessagesLoading(false); } });

    const ch = supabase
      .channel(`support-inbox-msgs-${activeId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages(previous => mergeSupportMessages(previous, [msg]));
          if (msg.sender_kind === 'requester') setRequesterTyping(false);
        },
      )
      .subscribe();

    const tc = supabase
      .channel(typingChannelName(activeId))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== 'requester') return;
        setRequesterTyping(true);
        if (typingTimer.current) clearTimeout(typingTimer.current);
        typingTimer.current = setTimeout(() => setRequesterTyping(false), 4000);
      })
      .subscribe();
    typingChannel.current = tc;

    return () => {
      cancelled = true;
      void supabase.rpc('support_set_agent_typing', { _conversation_id: activeId, _typing: false });
      void supabase.removeChannel(ch);
      void supabase.removeChannel(tc);
      typingChannel.current = null;
      setRequesterTyping(false);
    };
  }, [activeId]);

  // Announce this agent as online while the inbox is open.
  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(AGENT_PRESENCE_CHANNEL, { config: { presence: { key: user.id } } });
    ch.on('presence', { event: 'sync' }, () => setAgentsOnline(Object.keys(ch.presenceState()).length))
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') { setConnectionState('online'); void ch.track({ online_at: new Date().toISOString() }); }
        else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) setConnectionState('offline');
      });
    return () => { void supabase.removeChannel(ch); };
  }, [user]);

  const send = useCallback(async (body: string, internal: boolean, files: File[] = []) => {
    if (!activeId || !user) return;
    const attachments: SupportAttachment[] = [];
    for (const f of files) attachments.push(await uploadSupportAttachment(supabase, activeId, f));
    const conversationId = activeId;
    const { data: message, error } = await supabase.from('support_messages').insert({
      conversation_id: activeId,
      sender_kind: 'agent',
      sender_user_id: user.id,
      body,
      is_internal: internal,
      attachments: attachments as unknown as Database['public']['Tables']['support_messages']['Insert']['attachments'],
    }).select().single();
    if (error) throw error;
    if (selectedId.current === conversationId && message) setMessages(previous => mergeSupportMessages(previous, [message]));
    await Promise.all([latestLoad.current(), latestActive.current()]);
  }, [activeId, user]);

  const update = useCallback(async (id: string, patch: Partial<Pick<SupportConversation, 'status' | 'assigned_admin_id' | 'priority' | 'ai_enabled'>>) => {
    const { error } = await supabase.from('support_conversations').update(patch).eq('id', id).select('id').single();
    if (error) throw error;
    await Promise.all([latestLoad.current(), latestActive.current()]);
  }, []);

  const resumeAi = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('support_resume_ai', { _conversation_id: id });
    if (error) throw error;
    await Promise.all([latestLoad.current(), latestActive.current()]);
  }, []);

  const setStatus = useCallback((id: string, status: SupportStatus) => update(id, { status }), [update]);

  const markRead = useCallback(async (id: string) => {
    const { error } = await supabase.rpc('support_mark_read', { _conversation_id: id });
    if (error) throw error;
    setConversations(previous => previous.map(item => item.id === id ? { ...item, unread_for_agent: 0 } : item));
    setActiveConv(previous => previous?.id === id ? { ...previous, unread_for_agent: 0 } : previous);
  }, []);

  const reloadMessages = useCallback(async () => {
    const id = selectedId.current;
    if (!id) return;
    const { data, error } = await supabase.from('support_messages').select('*').eq('conversation_id', id).order('created_at');
    if (selectedId.current !== id) return;
    if (error) setThreadError(error.message);
    else setMessages(previous => mergeSupportMessages(previous, data ?? []));
  }, []);

  const notifyTyping = useCallback((typing = true) => {
    const id = selectedId.current;
    const now = Date.now();
    if (!id || (typing && now - lastTypingSent.current < 2000)) return;
    lastTypingSent.current = typing ? now : 0;
    void supabase.rpc('support_set_agent_typing', { _conversation_id: id, _typing: typing }).then(({ error }) => {
      if (!error && selectedId.current === id) void typingChannel.current?.send({ type: 'broadcast', event: 'typing', payload: { from: 'agent', typing } });
    });
  }, []);

  return {
    me: user?.id ?? null,
    conversations,
    loading,
    error,
    threadError,
    messagesLoading,
    activeId,
    setActiveId: selectConversation,
    active: activeConv,
    messages,
    requesterTyping,
    agentsOnline,
    connectionState,
    send,
    update,
    setStatus,
    resumeAi,
    markRead,
    notifyTyping,
    reload: () => Promise.all([load(), loadActive(), reloadMessages()]),
  };
}
