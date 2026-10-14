import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Plus, Trash2, Save, Mail, Phone, MapPin, Clock, Inbox, MailOpen, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  CONTACT_DEFAULT,
  useMarketingContact,
  type ContactInfoEntry,
  type MarketingContactSettings,
} from '@/hooks/useMarketingContact';

const ICON_OPTIONS = [
  { value: 'mail', label: 'Email', Icon: Mail },
  { value: 'phone', label: 'Phone', Icon: Phone },
  { value: 'map', label: 'Location', Icon: MapPin },
  { value: 'clock', label: 'Hours', Icon: Clock },
];

export default function PlatformContactEditor() {
  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Marketing contact</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Edit the public /contact page and review messages from prospective customers.
          </p>
        </div>

        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
            <TabsTrigger value="settings">Page content</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>
          <TabsContent value="settings"><SettingsEditor /></TabsContent>
          <TabsContent value="submissions"><SubmissionsList /></TabsContent>
        </Tabs>
      </div>
    </PlatformLayout>
  );
}

function SettingsEditor() {
  const qc = useQueryClient();
  const { data, isLoading } = useMarketingContact();
  const [draft, setDraft] = useState<MarketingContactSettings | null>(null);

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (d: MarketingContactSettings) => {
      const payload = {
        eyebrow: d.eyebrow,
        title: d.title,
        description: d.description,
        contact_info: d.contact_info as any,
        reasons: d.reasons as any,
        response_time_text: d.response_time_text,
      };
      if (d.id) {
        const { error } = await supabase
          .from('marketing_contact_settings')
          .update(payload)
          .eq('id', d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('marketing_contact_settings').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Contact page saved');
      qc.invalidateQueries({ queryKey: ['marketing-contact-settings'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  if (isLoading || !draft) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  const update = (patch: Partial<MarketingContactSettings>) => setDraft({ ...draft, ...patch });

  const updateInfo = (i: number, patch: Partial<ContactInfoEntry>) => {
    const next = [...draft.contact_info];
    next[i] = { ...next[i], ...patch };
    update({ contact_info: next });
  };

  const moveInfo = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= draft.contact_info.length) return;
    const next = [...draft.contact_info];
    [next[i], next[j]] = [next[j], next[i]];
    update({ contact_info: next });
  };

  const addInfo = () =>
    update({ contact_info: [...draft.contact_info, { icon: 'mail', label: 'Email', value: '' }] });

  const removeInfo = (i: number) =>
    update({ contact_info: draft.contact_info.filter((_, k) => k !== i) });

  const updateReason = (i: number, value: string) => {
    const next = [...draft.reasons];
    next[i] = value;
    update({ reasons: next });
  };

  return (
    <div className="space-y-6">
      {/* Heading */}
      <Card>
        <CardHeader><CardTitle>Page heading</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Eyebrow</Label>
              <Input value={draft.eyebrow} onChange={e => update({ eyebrow: e.target.value })} maxLength={60} />
            </div>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={draft.title} onChange={e => update({ title: e.target.value })} maxLength={120} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={draft.description} onChange={e => update({ description: e.target.value })} rows={3} maxLength={500} />
          </div>
          <div className="space-y-2">
            <Label>Response time text</Label>
            <Input value={draft.response_time_text} onChange={e => update({ response_time_text: e.target.value })} maxLength={200} />
          </div>
        </CardContent>
      </Card>

      {/* Contact info cards */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Contact info cards</CardTitle>
          <Button size="sm" variant="outline" onClick={addInfo}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {draft.contact_info.length === 0 && (
            <p className="text-sm text-muted-foreground">No contact cards. Add one above.</p>
          )}
          {draft.contact_info.map((c, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Icon</Label>
                  <Select value={c.icon} onValueChange={v => updateInfo(i, { icon: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ICON_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>
                          <span className="flex items-center gap-2"><o.Icon className="h-4 w-4" /> {o.label}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Label</Label>
                  <Input value={c.label} onChange={e => updateInfo(i, { label: e.target.value })} maxLength={60} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Value <span className="text-muted-foreground font-normal">(supports line breaks)</span></Label>
                <Textarea value={c.value} onChange={e => updateInfo(i, { value: e.target.value })} rows={2} maxLength={300} />
              </div>
              <div className="flex items-center gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={() => moveInfo(i, -1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => moveInfo(i, 1)} disabled={i === draft.contact_info.length - 1}><ArrowDown className="h-4 w-4" /></Button>
                <Button variant="ghost" size="sm" onClick={() => removeInfo(i)} className="text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Reasons */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Form reason options</CardTitle>
          <Button size="sm" variant="outline" onClick={() => update({ reasons: [...draft.reasons, ''] })}>
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {draft.reasons.length === 0 && (
            <p className="text-sm text-muted-foreground">No reasons defined. The dropdown will be hidden.</p>
          )}
          {draft.reasons.map((r, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={r} onChange={e => updateReason(i, e.target.value)} maxLength={100} placeholder="e.g. Sales / pricing" />
              <Button variant="ghost" size="sm" onClick={() => update({ reasons: draft.reasons.filter((_, k) => k !== i) })} className="text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 sticky bottom-4 bg-background/80 backdrop-blur p-3 rounded-lg border border-border">
        <Button variant="outline" onClick={() => data && setDraft(data)}>Reset</Button>
        <Button onClick={() => save.mutate(draft)} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function SubmissionsList() {
  const qc = useQueryClient();
  const { data: submissions, isLoading } = useQuery({
    queryKey: ['marketing-contact-submissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_contact_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('marketing_contact_submissions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['marketing-contact-submissions'] }),
    onError: (e: any) => toast.error(e.message || 'Failed to update'),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('marketing_contact_submissions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Submission deleted');
      qc.invalidateQueries({ queryKey: ['marketing-contact-submissions'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to delete'),
  });

  const stats = useMemo(() => {
    const total = submissions?.length ?? 0;
    const newCount = submissions?.filter(s => s.status === 'new').length ?? 0;
    return { total, newCount };
  }, [submissions]);

  if (isLoading) {
    return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Total</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-1"><Inbox className="h-5 w-5" /> {stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">New</div>
            <div className="text-2xl font-bold flex items-center gap-2 mt-1"><MailOpen className="h-5 w-5" /> {stats.newCount}</div>
          </CardContent>
        </Card>
      </div>

      {submissions?.length === 0 && (
        <Card><CardContent className="p-12 text-center text-muted-foreground">
          <Inbox className="h-10 w-10 mx-auto mb-3 opacity-50" />
          No submissions yet.
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {submissions?.map(s => (
          <Card key={s.id} className={s.status === 'new' ? 'border-primary/40' : ''}>
            <CardContent className="p-5 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold">{s.name}</h3>
                    {s.status === 'new' && <Badge variant="default">New</Badge>}
                    {s.status === 'read' && <Badge variant="secondary">Read</Badge>}
                    {s.status === 'archived' && <Badge variant="outline">Archived</Badge>}
                    {s.reason && <Badge variant="outline">{s.reason}</Badge>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    <a href={`mailto:${s.email}`} className="hover:text-foreground">{s.email}</a>
                    {s.company && <> · {s.company}</>}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {s.status === 'new' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: 'read' })}>
                      <CheckCircle2 className="h-4 w-4 mr-1" /> Mark read
                    </Button>
                  )}
                  {s.status !== 'archived' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus.mutate({ id: s.id, status: 'archived' })}>
                      Archive
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => { if (confirm('Delete this submission?')) remove.mutate(s.id); }} className="text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <p className="text-sm whitespace-pre-line border-l-2 border-border pl-3">{s.message}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
