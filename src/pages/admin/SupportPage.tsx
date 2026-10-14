import { useEffect, useState } from 'react';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowLeft, LifeBuoy, Loader2, Plus } from 'lucide-react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useSupportChat } from '@/hooks/useSupportChat';
import { cn } from '@/lib/utils';
import { STATUS_LABELS, SUPPORT_CATEGORIES, type SupportStatus } from '@/lib/support';
import { NewConversationView, ThreadView } from '@/components/support/ChatThread';

/**
 * Restaurant dashboard → Help & support. Owners and admins can switch to
 * "Everyone" to see every conversation from their restaurant's staff.
 */
export default function SupportPage() {
  const { hasAnyRole, user } = useAuth();
  const { data: restaurant } = useCurrentRestaurant();
  const canSeeAll = hasAnyRole(['owner', 'admin']);
  const [scope, setScope] = useState<'mine' | 'restaurant'>('mine');
  const [composing, setComposing] = useState(false);

  useEffect(() => { if (canSeeAll) setScope('restaurant'); }, [canSeeAll]);

  const chat = useSupportChat({ scope: canSeeAll ? scope : 'mine', restaurantId: restaurant?.id ?? null });
  const { active, markRead } = chat;

  useEffect(() => {
    if (active && active.unread_for_requester > 0) void markRead(active.id);
  }, [active, markRead, chat.messages.length]);

  const starters = chat.names;

  const showDetail = composing || !!chat.activeId;

  return (
    <AdminLayout title="Help & support" subtitle="Chat with the ServeOS team">
      <div className="rounded-2xl border border-border bg-card overflow-hidden grid lg:grid-cols-[340px_minmax(0,1fr)] h-[calc(100svh-12rem)] min-h-[520px]">
        {/* List */}
        <aside className={cn('min-h-0 flex flex-col border-r border-border', showDetail && 'hidden lg:flex')}>
          <div className="p-3 border-b border-border space-y-2">
            <Button className="w-full h-10 gap-2" onClick={() => { chat.setActiveId(null); setComposing(true); }}>
              <Plus className="h-4 w-4" /> New conversation
            </Button>
            {canSeeAll && (
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
                {(['restaurant', 'mine'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { setScope(s); chat.setActiveId(null); }}
                    className={cn('rounded-md py-1.5 text-xs font-medium transition-colors', scope === s ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground')}
                  >
                    {s === 'restaurant' ? 'Everyone' : 'Mine'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {chat.loading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : chat.conversations.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <LifeBuoy className="h-8 w-8 mx-auto text-muted-foreground/50" />
                <p className="mt-3 text-sm font-medium">No conversations yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Questions about billing, setup or a problem? Start a conversation and our team will reply here.</p>
              </div>
            ) : (
              chat.conversations.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setComposing(false); chat.setActiveId(c.id); }}
                  className={cn('w-full text-left px-4 py-3 border-b border-border/60 transition-colors', chat.activeId === c.id ? 'bg-primary/5' : 'hover:bg-muted/40')}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('text-sm truncate flex-1', c.unread_for_requester > 0 ? 'font-semibold' : 'font-medium')}>{c.subject || 'Conversation'}</span>
                    <span className="text-[11px] text-muted-foreground shrink-0">{formatDistanceToNowStrict(new Date(c.last_message_at))}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground truncate flex-1">{c.last_message_preview}</span>
                    {c.unread_for_requester > 0 && (
                      <span className="h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">{c.unread_for_requester}</span>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <span className="rounded-full border border-border px-2 py-0.5">{STATUS_LABELS[c.status as SupportStatus]}</span>
                    <span>{SUPPORT_CATEGORIES.find((x) => x.value === c.category)?.label}</span>
                    {scope === 'restaurant' && c.requester_user_id && c.requester_user_id !== user?.id && (
                      <span className="truncate">· {starters[c.requester_user_id] ?? 'Teammate'}</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* Detail */}
        <section className={cn('min-h-0 flex flex-col', !showDetail && 'hidden lg:flex')}>
          {showDetail && (
            <div className="lg:hidden shrink-0 border-b border-border px-3 py-2">
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => { setComposing(false); chat.setActiveId(null); }}>
                <ArrowLeft className="h-4 w-4" /> All conversations
              </Button>
            </div>
          )}
          {composing ? (
            <NewConversationView
              askName={false}
              onStart={async (input) => {
                await chat.startConversation(input);
                setComposing(false);
              }}
            />
          ) : active ? (
            <>
              <div className="shrink-0 border-b border-border px-4 py-3">
                <div className="text-sm font-semibold truncate">{active.subject || 'Conversation'}</div>
                <div className="text-xs text-muted-foreground">{STATUS_LABELS[active.status as SupportStatus]}</div>
              </div>
              <ThreadView
                client={chat.client}
                me={chat.me}
                names={chat.names}
                messages={chat.messages}
                status={active.status}
                rating={active.rating}
                agentTyping={chat.agentTyping}
              aiTyping={chat.aiTyping}
                onSend={chat.sendMessage}
                onTyping={chat.notifyTyping}
                onRate={(r, c) => chat.rate(active.id, r, c)}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
              <LifeBuoy className="h-10 w-10 mb-3 opacity-40" />
              <p className="text-sm">Select a conversation or start a new one</p>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
