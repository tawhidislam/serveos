import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Status = { configured: boolean; model: string; source: 'panel' | 'server' | 'none'; tested?: boolean };
async function connectionRequest(body: { action: 'status' | 'save' | 'test'; api_key?: string; model?: string }): Promise<Status> {
  const { data, error } = await supabase.functions.invoke('support-ai-config', { body });
  if (error) {
    let message = error.message;
    if (error.context instanceof Response) { const payload = await error.context.json().catch(() => null); if (typeof payload?.error === 'string') message = payload.error; }
    throw new Error(message);
  }
  return data as Status;
}

export default function GeminiConnectionSettings() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError, refetch } = useQuery({ queryKey: ['support-ai-connection'], queryFn: () => connectionRequest({ action: 'status' }), retry: false });
  const [key, setKey] = useState('');
  const [model, setModel] = useState('gemini-3.8-flash');
  const [modelEdited, setModelEdited] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  useEffect(() => { if (data?.model && !modelEdited) setModel(data.model); }, [data?.model, modelEdited]);
  const act = async (action: 'save' | 'test') => {
    if (busy) return;
    setBusy(action); setError(''); setFeedback('');
    try {
      const status = await connectionRequest(action === 'save' ? { action, api_key: key.trim(), model: model.trim() } : { action });
      queryClient.setQueryData(['support-ai-connection'], status);
      if (action === 'save') { setKey(''); setModelEdited(false); }
      setFeedback(action === 'test' ? 'Gemini connection verified.' : 'Gemini connection saved. New replies use these settings immediately.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update the connection.'); }
    finally { setBusy(null); }
  };
  return <section aria-label="Gemini connection" className="space-y-4 rounded-xl border bg-card p-4">
    <div><h3 className="font-medium">Gemini API connection</h3><p className="mt-1 text-xs text-muted-foreground">Used for automatic replies and reviewed drafts.</p></div>
    {isLoading ? <p className="text-xs text-muted-foreground">Checking saved connection…</p> : loadError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Could not load the AI connection.</p><Button size="sm" variant="outline" onClick={() => void refetch()}>Retry connection status</Button></div> : <p className="text-xs" role="status">{data?.configured ? data.source === 'panel' ? 'API key saved securely' : 'Using a server-configured API key' : 'No Gemini API key configured'}</p>}
    <form onSubmit={event => { event.preventDefault(); void act('save'); }} className="space-y-4">
      <div className="space-y-1.5"><Label htmlFor="gemini-api-key">New Gemini API key</Label><Input id="gemini-api-key" type="password" autoComplete="new-password" spellCheck={false} value={key} onChange={event => { setKey(event.target.value); setFeedback(''); }} placeholder={data?.configured ? 'Leave blank to keep the saved key' : 'Paste your Gemini API key'} maxLength={256} disabled={!!busy || isLoading || !!loadError} /><p className="text-xs text-muted-foreground">Stored encrypted on the server. The saved key is never displayed.</p></div>
      <div className="space-y-1.5"><Label htmlFor="gemini-model">Gemini model</Label><Input id="gemini-model" value={model} onChange={event => { setModel(event.target.value); setModelEdited(true); setFeedback(''); }} maxLength={100} disabled={!!busy || isLoading || !!loadError} /><p className="text-xs text-muted-foreground">Example: gemini-3.8-flash. Leave the key blank when changing only the model.</p></div>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!!busy || isLoading || !!loadError || (!data?.configured && !key.trim())}>{busy === 'save' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Gemini connection</Button><Button type="button" variant="outline" disabled={!!busy || !data?.configured || !!key.trim() || model.trim() !== data?.model} onClick={() => void act('test')}>{busy === 'test' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Test saved connection</Button></div>
    </form>
    {feedback && <p role="status" className="text-sm text-emerald-600">{feedback}</p>}{error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </section>;
}
