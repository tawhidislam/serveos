import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';
import { supportClient } from '@/integrations/supabase/supportClient';
import { useAuth } from '@/hooks/useAuth';
import {
  AGENT_PRESENCE_CHANNEL,
  mergeSupportMessages,
  typingChannelName,
  type SupportCategory,
  type SupportConversation,
  type SupportMessage,
  type SupportSettings,
} from '@/lib/support';
import { uploadSupportAttachment, type SupportAttachment } from '@/lib/support-attachments';

type Client = SupabaseClient<Database>;

interface Options {
  /**
   * 'restaurant': list every conversation of this restaurant (owners/admins;
   * RLS limits what other staff can see). Default: the user's own.
   */
  scope?: 'mine' | 'restaurant';
  restaurantId?: string | null;
}

/**
 * Requester side of live support (website visitors and restaurant staff).
 * Signed-in users chat with their normal session; visitors get an anonymous
 * session on the isolated support client, created only when they first send.
 */
export function useSupportChat({ scope = 'mine', restaurantId = null }: Options = {}) {
  const { user } = useAuth();
  const restaurantScope = scope === 'restaurant' && !!user && !!restaurantId;
  const client: Client = user ? supabase : supportClient;

  const [userId, setUserId] = useState<string | null>(user?.id ?? null);
  const [settings, setSettings] = useState<SupportSettings | null>(null);
  const [conversations, setConversations] = useState<SupportConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [agentsOnline, setAgentsOnline] = useState(0);
  const [agentTyping, setAgentTyping] = useState(false);
  const [aiTyping, setAiTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [names, setNames] = useState<Record<string, string>>({});
  const typingChannel = useRef<RealtimeChannel | null>(null);
  const lastTypingSent = useRef(0);
  // Realtime topics must be unique per hook instance (supabase-js reuses a
  // channel with the same name, and callbacks can't be added after subscribe).
  const instance = useRef(Math.random().toString(36).slice(2, 8)).current;

  // Who is the requester? (main session, or an existing anonymous session)
  useEffect(() => {
    let cancelled = false;
    if (user) {
      setUserId(user.id);
      return;
    }
    supportClient.auth.getSession().then(({ data }) => {
      if (!cancelled) setUserId(data.session?.user.id ?? null);
    });
    return () => { cancelled = true; };
  }, [user]);

  // Settings (public).
  useEffect(() => {
    client.from('support_settings').select('*').maybeSingle().then(({ data }) => setSettings(data ?? null));
  }, [client]);

  const loadConversations = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    let q = client.from('support_conversations').select('*').order('last_message_at', { ascending: false });
    q = restaurantScope ? q.eq('restaurant_id', restaurantId!).limit(100) : q.eq('requester_user_id', userId).limit(20);
    const { data } = await q;
    setConversations(data ?? []);
    setLoading(false);
  }, [client, userId, restaurantScope, restaurantId]);

  useEffect(() => { void loadConversations(); }, [loadConversations]);

  // Live updates to this requester's conversations (status, unread counts).
  useEffect(() => {
    if (!userId) return;
    const filter = restaurantScope ? `restaurant_id=eq.${restaurantId}` : `requester_user_id=eq.${userId}`;
    const ch = client
      .channel(`support-my-convs-${restaurantScope ? restaurantId : userId}-${instance}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_conversations', filter }, () => {
        void loadConversations();
      })
      .subscribe();
    return () => { void client.removeChannel(ch); };
  }, [client, userId, loadConversations, restaurantScope, restaurantId, instance]);

  // Staff names for messages written by teammates (restaurant shared view).
  useEffect(() => {
    if (!user) return;
    const ids = [...new Set([
      ...messages.map((m) => m.sender_user_id),
      ...(restaurantScope ? conversations.map((c) => c.requester_user_id) : []),
    ].filter((id): id is string => !!id && id !== userId && !(id in names)))];
    if (ids.length === 0) return;
    client.from('profiles').select('user_id, display_name').in('user_id', ids).then(({ data }) => {
      if (!data?.length) return;
      setNames((prev) => ({ ...prev, ...Object.fromEntries(data.map((p) => [p.user_id, p.display_name || 'Teammate'])) }));
    });
  }, [client, user, userId, messages, conversations, names, restaurantScope]);

  // Messages of the open conversation, kept live.
  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setAgentTyping(false); setAiTyping(false);
    let typingRefreshRunning = false;
    const refreshTyping = async () => {
      if (typingRefreshRunning) return;
      typingRefreshRunning = true;
      const { data, error } = await client.rpc('support_typing_status', { _conversation_id: activeId }).abortSignal(AbortSignal.timeout(5000));
      typingRefreshRunning = false;
      if (cancelled) return;
      const status = data as { agent?: boolean; ai?: boolean } | null;
      setAgentTyping(!error && status?.agent === true);
      setAiTyping(!error && status?.ai === true);
    };
    void refreshTyping();
    const typingRefreshTimer = setInterval(() => { void refreshTyping(); }, 1500);
    const refresh = async () => {
      const { data, error } = await client.from('support_messages').select('*').eq('conversation_id', activeId).order('created_at', { ascending: true });
      if (!cancelled && !error) setMessages(previous => mergeSupportMessages(previous, data ?? []));
      if (!cancelled) void loadConversations();
    };
    const refreshTimer = setInterval(() => { void refresh(); }, 3000);
    client
      .from('support_messages')
      .select('*')
      .eq('conversation_id', activeId)
      .order('created_at', { ascending: true })
      .then(({ data }) => { if (!cancelled) setMessages(previous => mergeSupportMessages(previous, data ?? [])); });

    const ch = client
      .channel(`support-msgs-${activeId}-${instance}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `conversation_id=eq.${activeId}` },
        (payload) => {
          const msg = payload.new as SupportMessage;
          setMessages(previous => mergeSupportMessages(previous, [msg]));
          if (msg.sender_kind !== 'requester') { setAgentTyping(false); setAiTyping(false); }
        },
      )
      .subscribe();

    // Typing indicator (broadcast; no message content).
    const tc = client
      .channel(typingChannelName(activeId))
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (payload?.from !== 'agent') return;
        void refreshTyping();
      })
      .subscribe();
    typingChannel.current = tc;

    return () => {
      cancelled = true;
      clearInterval(refreshTimer);
      clearInterval(typingRefreshTimer);
      void client.removeChannel(ch);
      void client.removeChannel(tc);
      typingChannel.current = null;
      setAgentTyping(false); setAiTyping(false);
    };
  }, [client, activeId, instance, loadConversations]);

  // Are any agents online? (agents join presence while the inbox is open)
  useEffect(() => {
    const ch = client.channel(AGENT_PRESENCE_CHANNEL);
    ch.on('presence', { event: 'sync' }, () => {
      setAgentsOnline(Object.keys(ch.presenceState()).length);
    }).subscribe();
    return () => { void client.removeChannel(ch); };
  }, [client]);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (userId) return userId;
    const { data, error } = await supportClient.auth.signInAnonymously();
    if (error || !data.user) throw error ?? new Error('Could not start chat');
    setUserId(data.user.id);
    return data.user.id;
  }, [userId]);

  const startConversation = useCallback(async (input: {
    message: string;
    category: SupportCategory;
    name?: string;
    email?: string;
  }) => {
    await ensureSession();
    const { data, error } = await client.rpc('support_start_conversation', {
      _message: input.message,
      _category: input.category,
      _visitor_name: input.name || undefined,
      _visitor_email: input.email || undefined,
      _source_url: window.location.pathname,
      _user_agent: navigator.userAgent,
    });
    if (error) throw error;
    await loadConversations();
    setActiveId(data as string);
    return data as string;
  }, [client, ensureSession, loadConversations]);

  const sendMessage = useCallback(async (body: string, files: File[] = []) => {
    if (!activeId || !userId) return;
    const attachments: SupportAttachment[] = [];
    for (const f of files) attachments.push(await uploadSupportAttachment(client, activeId, f));
    const { error } = await client.from('support_messages').insert({
      conversation_id: activeId,
      sender_kind: 'requester',
      sender_user_id: userId,
      body,
      attachments: attachments as unknown as Database['public']['Tables']['support_messages']['Insert']['attachments'],
    });
    if (error) throw error;
  }, [client, activeId, userId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!typingChannel.current || now - lastTypingSent.current < 2500) return;
    lastTypingSent.current = now;
    void typingChannel.current.send({ type: 'broadcast', event: 'typing', payload: { from: 'requester' } });
  }, []);

  const markRead = useCallback(async (conversationId: string) => {
    await client.rpc('support_mark_read', { _conversation_id: conversationId });
  }, [client]);

  const rate = useCallback(async (conversationId: string, rating: 'good' | 'bad', comment?: string) => {
    const { error } = await client.rpc('support_rate_conversation', {
      _conversation_id: conversationId,
      _rating: rating,
      _comment: comment || undefined,
    });
    if (error) throw error;
    await loadConversations();
  }, [client, loadConversations]);

  const unreadTotal = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unread_for_requester ?? 0), 0),
    [conversations],
  );
  const active = conversations.find((c) => c.id === activeId) ?? null;

  return {
    client,
    me: userId,
    names,
    isSignedInUser: !!user,
    settings,
    conversations,
    active,
    activeId,
    setActiveId,
    messages,
    agentsOnline,
    agentTyping,
    aiTyping,
    loading,
    unreadTotal,
    startConversation,
    sendMessage,
    notifyTyping,
    markRead,
    rate,
  };
}
