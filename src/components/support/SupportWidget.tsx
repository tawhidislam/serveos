import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNowStrict } from 'date-fns';
import { ArrowLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSupportChat } from '@/hooks/useSupportChat';
import { usePlatformBranding } from '@/hooks/usePlatformSettings';
import { cn } from '@/lib/utils';
import { isWithinBusinessHours } from '@/lib/support';
import { LauncherButton } from './SupportLauncher';
import { NewConversationView, ThreadView } from './ChatThread';

type View = 'home' | 'new' | 'thread';

export default function SupportWidget({ defaultOpen = false, raised = false }: { defaultOpen?: boolean; raised?: boolean }) {
  const chat = useSupportChat();
  const { siteName } = usePlatformBranding();
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<View>('home');

  useEffect(() => { if (defaultOpen) setOpen(true); }, [defaultOpen]);

  // Mark the open thread as read while the panel shows it.
  const { active, markRead } = chat;
  useEffect(() => {
    if (open && view === 'thread' && active && active.unread_for_requester > 0) {
      void markRead(active.id);
    }
  }, [open, view, active, markRead, chat.messages.length]);

  if (chat.settings && !chat.settings.widget_enabled) return null;

  const online = chat.agentsOnline > 0 && isWithinBusinessHours(chat.settings);

  const openThread = (id: string) => {
    chat.setActiveId(id);
    setView('thread');
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-label="Support chat"
          className="fixed z-[60] inset-0 sm:inset-auto sm:bottom-24 sm:right-5 sm:w-[380px] sm:h-[600px] sm:max-h-[calc(100svh-8rem)] flex flex-col bg-background sm:rounded-2xl sm:border sm:border-border shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="bg-primary text-primary-foreground px-4 pt-4 pb-4 shrink-0">
            <div className="flex items-center gap-2">
              {view !== 'home' && (
                <button
                  type="button"
                  onClick={() => { setView('home'); chat.setActiveId(null); }}
                  className="-ml-1 p-1.5 rounded-lg hover:bg-primary-foreground/10"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold leading-tight truncate">{siteName} support</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs text-primary-foreground/85">
                  <span className={cn('h-2 w-2 rounded-full', online ? 'bg-emerald-300' : 'bg-primary-foreground/50')} />
                  {online ? 'We’re online — usually reply in a few minutes' : 'We’ll reply here as soon as we can'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg hover:bg-primary-foreground/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {view === 'home' && (
            <HomeView
              greeting={chat.settings?.greeting ?? 'Hi! How can we help you today?'}
              offlineMessage={!online ? chat.settings?.offline_message : undefined}
              conversations={chat.conversations}
              loading={chat.loading}
              onNew={() => setView('new')}
              onOpen={openThread}
              fullPageHref={raised ? '/admin/support' : undefined}
            />
          )}
          {view === 'new' && (
            <NewConversationView
              askName={!chat.isSignedInUser}
              onStart={async (input) => {
                await chat.startConversation(input);
                setView('thread');
              }}
            />
          )}
          {view === 'thread' && chat.active && (
            <ThreadView
              client={chat.client}
              me={chat.me}
              names={chat.names}
              messages={chat.messages}
              status={chat.active.status}
              rating={chat.active.rating}
              agentTyping={chat.agentTyping}
              aiTyping={chat.aiTyping}
              onSend={chat.sendMessage}
              onTyping={chat.notifyTyping}
              onRate={(r, c) => chat.rate(chat.active!.id, r, c)}
            />
          )}
        </div>
      )}
      <div className={cn(open && 'hidden sm:block')}>
        <LauncherButton raised={raised} open={open} unread={chat.unreadTotal} onClick={() => setOpen((o) => !o)} />
      </div>
    </>
  );
}

/* ── Home ─────────────────────────────────────────────────────────────── */
function HomeView({
  greeting, offlineMessage, conversations, loading, onNew, onOpen, fullPageHref,
}: {
  fullPageHref?: string;
  greeting: string;
  offlineMessage?: string;
  conversations: ReturnType<typeof useSupportChat>['conversations'];
  loading: boolean;
  onNew: () => void;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-foreground">{greeting}</p>
        {offlineMessage && <p className="mt-2 text-xs text-muted-foreground">{offlineMessage}</p>}
        <Button onClick={onNew} className="mt-4 w-full h-11 gap-2">
          <Plus className="h-4 w-4" /> Start a conversation
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : conversations.length > 0 && (
        <div>
          <div className="px-1 mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Your conversations</div>
          <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
            {conversations.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onOpen(c.id)}
                className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{c.subject || 'Conversation'}</span>
                    {c.unread_for_requester > 0 && (
                      <span className="shrink-0 h-5 min-w-[20px] px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold flex items-center justify-center">
                        {c.unread_for_requester}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground truncate">
                    {c.status === 'resolved' || c.status === 'closed' ? 'Resolved · ' : ''}
                    {c.last_message_preview}
                  </div>
                </div>
                <div className="shrink-0 text-[11px] text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(c.last_message_at), { addSuffix: false })}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            ))}
          </div>
        </div>
      )}
      {fullPageHref && (
        <Link to={fullPageHref} className="block text-center text-xs font-medium text-primary hover:underline py-1">
          Open all conversations →
        </Link>
      )}
    </div>
  );
}
