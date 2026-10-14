import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { SupportSettings } from '@/lib/support';
import GeminiConnectionSettings from '@/components/support/GeminiConnectionSettings';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const TIMEZONES = ['Asia/Shanghai', 'Asia/Dhaka', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'UTC', 'America/New_York'];

interface Hours { days: number[]; start: string; end: string }

export default function SettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['support-settings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('support_settings').select('*').maybeSingle();
      if (error) throw error;
      return data as SupportSettings | null;
    },
  });
  const [draft, setDraft] = useState<SupportSettings | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (data) setDraft(data); }, [data]);

  if (isError) return <div className="space-y-3 p-6"><p>Could not load support settings.</p><Button variant="outline" onClick={() => refetch()}>Try again</Button></div>;
  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading support settings…</div>;
  if (!draft) return <div className="p-6 text-sm text-muted-foreground">Support settings haven’t been initialized.</div>;
  const hours = (draft.business_hours ?? { days: [], start: '10:00', end: '20:00' }) as unknown as Hours;
  const setHours = (h: Partial<Hours>) => setDraft({ ...draft, business_hours: { ...hours, ...h } as unknown as SupportSettings['business_hours'] });

  const save = async () => {
    if (hours.start >= hours.end) {
      toast.error('Opening time must be before closing time');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('support_settings').update({
      widget_enabled: draft.widget_enabled,
      auto_reply_enabled: draft.auto_reply_enabled,
      ai_enabled: draft.ai_enabled,
      ai_extra_instructions: draft.ai_extra_instructions?.trim() || null,
      greeting: draft.greeting.trim(),
      offline_message: draft.offline_message.trim(),
      business_hours: draft.business_hours,
      timezone: draft.timezone,
    }).eq('id', true).select('id').single();
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success('Support settings saved');
      void qc.invalidateQueries({ queryKey: ['support-settings'] });
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-border bg-card p-4">
        <div>
          <Label htmlFor="widget-on" className="text-sm font-medium">Chat button on the website and dashboards</Label>
          <p className="text-xs text-muted-foreground">Turn off to hide the chat button everywhere.</p>
        </div>
        <Switch id="widget-on" checked={draft.widget_enabled} onCheckedChange={(v) => setDraft({ ...draft, widget_enabled: v })} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="greet">Greeting</Label>
        <Textarea id="greet" value={draft.greeting} onChange={(e) => setDraft({ ...draft, greeting: e.target.value })} rows={2} maxLength={300} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="offline">Message when you’re away</Label>
        <Textarea id="offline" value={draft.offline_message} onChange={(e) => setDraft({ ...draft, offline_message: e.target.value })} rows={2} maxLength={300} />
      </div>

      <div className="space-y-3 rounded-xl border border-border bg-card p-4">
        <div>
          <div className="text-sm font-medium">Support hours</div>
          <p className="text-xs text-muted-foreground">Outside these hours, or when no agent has the inbox open, visitors see the away message.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map((d, i) => {
            const on = hours.days?.includes(i);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => setHours({ days: on ? hours.days.filter((x) => x !== i) : [...(hours.days ?? []), i].sort() })}
                className={cn('h-9 w-12 rounded-md border text-xs font-medium', on ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
              >
                {d}
              </button>
            );
          })}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="h-start" className="text-xs">Opens</Label>
            <Input id="h-start" type="time" value={hours.start} onChange={(e) => setHours({ start: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="h-end" className="text-xs">Closes</Label>
            <Input id="h-end" type="time" value={hours.end} onChange={(e) => setHours({ end: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tz" className="text-xs">Timezone</Label>
            <select id="tz" value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      </div>

      <GeminiConnectionSettings />

      <div className="space-y-4 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3"><div><Label htmlFor="ai-auto">Automatic AI replies</Label><p className="text-xs text-muted-foreground">Answer new chat conversations automatically. Human requests, failures, and admin takeovers move the conversation to your team.</p></div><Switch id="ai-auto" checked={draft.auto_reply_enabled} onCheckedChange={value => setDraft({ ...draft, auto_reply_enabled: value })} /></div>
        <p className="text-xs text-muted-foreground">Applies to new chats. Existing conversations remain with their current agent. Contact-form messages are handled by email.</p>
        <div className="flex items-center justify-between gap-3">
        <div>
          <Label htmlFor="ai-drafts" className="text-sm font-medium">AI reply drafts</Label>
          <p className="text-xs text-muted-foreground">Generate suggestions for admins to review and send. Customer messages are never sent automatically.</p>
        </div>
        <Switch id="ai-drafts" checked={draft.ai_enabled} onCheckedChange={value => setDraft({ ...draft, ai_enabled: value })} />
        </div>
        <div className="space-y-1.5"><Label htmlFor="ai-guidance">Reply guidance</Label><Textarea id="ai-guidance" rows={3} maxLength={3000} value={draft.ai_extra_instructions || ''} onChange={event => setDraft({ ...draft, ai_extra_instructions: event.target.value })} placeholder="Example: Keep replies concise and use the customer’s language." /><p className="text-xs text-muted-foreground">Use general tone and support guidance. Do not include secrets or private account details.</p></div>
        <p className="text-xs text-muted-foreground">Save and test your Gemini connection above before enabling AI replies.</p>
      </div>

      <Button onClick={() => void save()} disabled={saving} className="w-full sm:w-auto">Save settings</Button>
    </div>
  );
}
