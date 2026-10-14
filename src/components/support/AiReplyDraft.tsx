import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

export default function AiReplyDraft({ conversationId, disabled, onUse }: {
  conversationId: string; disabled: boolean; onUse: (text: string) => void;
}) {
  const { data: settings } = useQuery({ queryKey: ['support-settings'], queryFn: async () => {
    const { data, error } = await supabase.from('support_settings').select('*').maybeSingle();
    if (error) throw error;
    return data;
  } });
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [generating, setGenerating] = useState(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const generate = async () => {
    if (generating || disabled || !settings?.ai_enabled) return;
    setGenerating(true); setError('');
    try {
      const { data, error: failure } = await supabase.functions.invoke('support-ai-draft', { body: { conversation_id: conversationId } });
      if (failure) {
        let message = failure.message;
        if (failure.context instanceof Response) {
          const payload = await failure.context.json().catch(() => null);
          if (typeof payload?.error === 'string') message = payload.error;
        }
        throw new Error(message);
      }
      if (data?.conversation_id !== conversationId || typeof data?.draft !== 'string' || !data.draft.trim() || data.draft.length > 4000) throw new Error('The AI returned an unusable draft. Try again.');
      if (mounted.current) setDraft(data.draft);
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Could not generate a reply.'); }
    finally { if (mounted.current) setGenerating(false); }
  };
  return <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900 dark:bg-violet-950/20">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><p className="text-xs font-medium">AI reply assistant</p><p className="text-xs text-muted-foreground">{settings?.ai_enabled ? 'Review and edit before sending to the customer.' : 'Enable AI reply drafts in Support settings.'}</p></div>
      <Button size="sm" variant="outline" disabled={disabled || generating || !settings?.ai_enabled} onClick={() => void generate()}>
        {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-2 h-3.5 w-3.5" />}{generating ? 'Drafting…' : draft ? 'Regenerate draft' : 'AI draft reply'}
      </Button>
    </div>
    {draft && <div className="space-y-2"><p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm" aria-label="AI suggested reply">{draft}</p><div className="flex gap-2"><Button size="sm" disabled={disabled || generating} onClick={() => { onUse(draft); setDraft(''); }}>Use draft</Button><Button size="sm" variant="ghost" disabled={generating} onClick={() => setDraft('')}>Discard</Button></div></div>}
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
