import SupportTypingIndicator from './SupportTypingIndicator';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { format } from 'date-fns';
import { Loader2, Send, Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { SUPPORT_CATEGORIES, type SupportCategory, type SupportMessage } from '@/lib/support';
import { parseAttachments } from '@/lib/support-attachments';
import { AttachButton, AttachmentList, PendingFiles } from './Attachments';

type Client = SupabaseClient<Database>;

/* ── New conversation ─────────────────────────────────────────────────── */
export function NewConversationView({
  askName, onStart,
}: {
  askName: boolean;
  onStart: (input: { message: string; category: SupportCategory; name?: string; email?: string }) => Promise<void>;
}) {
  const [category, setCategory] = useState<SupportCategory>('sales');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setBusy(true);
    try {
      await onStart({ message: message.trim(), category, name: name.trim(), email: email.trim() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send your message');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-2">What do you need help with?</div>
        <div className="grid grid-cols-2 gap-2">
          {SUPPORT_CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              aria-pressed={category === c.value}
              className={cn(
                'rounded-xl border px-3 py-2.5 text-sm text-left transition-colors',
                category === c.value ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-muted/50 text-muted-foreground',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
      {askName && (
        <div className="grid grid-cols-1 gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name (optional)" maxLength={80} className="h-11" />
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" maxLength={160} className="h-11" />
        </div>
      )}
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your question…"
        rows={5}
        maxLength={4000}
        required
        autoFocus
      />
      <Button type="submit" disabled={busy || !message.trim()} className="w-full h-11 gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
      </Button>
    </form>
  );
}

/* ── Thread ───────────────────────────────────────────────────────────── */
export function ThreadView({
  client, me, names = {}, messages, status, rating, agentTyping, aiTyping = false, onSend, onTyping, onRate,
}: {
  client: Client;
  me: string | null;
  /** Display names of teammates (restaurant shared view). */
  names?: Record<string, string>;
  messages: SupportMessage[];
  status: string;
  rating: string | null;
  agentTyping: boolean;
  aiTyping?: boolean;
  onSend: (body: string, files: File[]) => Promise<void>;
  onTyping: () => void;
  onRate: (rating: 'good' | 'bad', comment?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const resolved = status === 'resolved' || status === 'closed';

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, agentTyping, aiTyping]);

  const send = async () => {
    const body = draft.trim();
    if ((!body && files.length === 0) || sending) return;
    setSending(true);
    try {
      await onSend(body, files);
      setDraft('');
      setFiles([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Message not sent');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 bg-muted/20">
        {status === 'bot' && <p className="rounded-lg border bg-card p-3 text-xs text-muted-foreground">You’re chatting with ServeOS AI. Ask for a human at any time.</p>}
        {messages.map((m) => <Bubble key={m.id} client={client} message={m} me={me} names={names} />)}
        <SupportTypingIndicator ai={aiTyping} agent={agentTyping} />
        {resolved && <RatingCard rating={rating} onRate={onRate} />}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border bg-background p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <PendingFiles files={files} onRemove={(i) => setFiles((f) => f.filter((_, idx) => idx !== i))} />
        <div className="flex items-end gap-1.5">
          <AttachButton files={files} onChange={setFiles} disabled={sending} />
          <Textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); onTyping(); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder={resolved ? 'Write to reopen this conversation…' : 'Write a message…'}
            rows={1}
            maxLength={4000}
            className="min-h-[44px] max-h-32 resize-none"
            aria-label="Message"
          />
          <Button type="button" size="icon" onClick={() => void send()} disabled={sending || (!draft.trim() && files.length === 0)} className="h-11 w-11 shrink-0" aria-label="Send">
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </>
  );
}

export function Bubble({
  client, message, me, names,
}: {
  client: Client;
  message: SupportMessage;
  me: string | null;
  names: Record<string, string>;
}) {
  const time = useMemo(() => format(new Date(message.created_at), 'HH:mm'), [message.created_at]);
  const attachments = useMemo(() => parseAttachments(message.attachments), [message.attachments]);
  if (message.sender_kind === 'system') {
    return <div className="text-center text-[11px] text-muted-foreground py-1">{message.body}</div>;
  }
  const fromRequesterSide = message.sender_kind === 'requester';
  const mine = fromRequesterSide && (!message.sender_user_id || message.sender_user_id === me);
  const teammate = fromRequesterSide && !mine;
  return (
    <div className={cn('flex flex-col max-w-[85%]', fromRequesterSide ? 'ml-auto items-end' : 'items-start')}>
      {message.sender_kind === 'bot' && (
        <div className="mb-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3" /> ServeOS AI</div>
      )}
      {teammate && (
        <div className="mb-1 text-[11px] text-muted-foreground">{names[message.sender_user_id!] ?? 'Teammate'}</div>
      )}
      <div
        className={cn(
          'px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words rounded-2xl',
          mine ? 'bg-primary text-primary-foreground rounded-br-md'
            : teammate ? 'bg-primary/15 text-foreground rounded-br-md'
              : 'bg-card border border-border text-foreground rounded-bl-md',
          !message.body && 'p-1.5',
        )}
      >
        {message.body}
        <AttachmentList client={client} attachments={attachments} inverted={mine} />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{time}</div>
    </div>
  );
}

export function RatingCard({ rating, onRate }: { rating: string | null; onRate: (r: 'good' | 'bad', c?: string) => Promise<void> }) {
  const [picked, setPicked] = useState<'good' | 'bad' | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  if (rating) {
    return <div className="text-center text-xs text-muted-foreground py-2">Thanks for your feedback!</div>;
  }
  const submit = async (r: 'good' | 'bad') => {
    setBusy(true);
    try {
      await onRate(r, comment.trim() || undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save your rating');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 text-center">
      <p className="text-sm font-medium">This conversation was resolved. How did we do?</p>
      <div className="mt-3 flex justify-center gap-2">
        {(['good', 'bad'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setPicked(r)}
            aria-pressed={picked === r}
            aria-label={r === 'good' ? 'Good' : 'Bad'}
            className={cn(
              'h-11 w-11 rounded-full border flex items-center justify-center transition-colors',
              picked === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-muted/60',
            )}
          >
            {r === 'good' ? <ThumbsUp className="h-5 w-5" /> : <ThumbsDown className="h-5 w-5" />}
          </button>
        ))}
      </div>
      {picked && (
        <div className="mt-3 space-y-2 text-left">
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Anything to add? (optional)" maxLength={1000} />
          <Button size="sm" className="w-full h-10" disabled={busy} onClick={() => void submit(picked)}>Send feedback</Button>
        </div>
      )}
    </div>
  );
}
