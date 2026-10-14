import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Loader2, Save, Plus, Trash2, GripVertical, Link as LinkIcon, MessageSquare,
  Twitter, Github, Linkedin, Facebook, Instagram, Youtube, Globe,
} from 'lucide-react';
import PlatformLayout from './PlatformLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  useMarketingFooter, FOOTER_DEFAULT,
  type FooterColumn, type FooterSocialLink, type MarketingFooterSettings,
} from '@/hooks/useMarketingFooter';

const SOCIAL_OPTIONS: { value: string; label: string; Icon: any }[] = [
  { value: 'twitter', label: 'Twitter / X', Icon: Twitter },
  { value: 'github', label: 'GitHub', Icon: Github },
  { value: 'linkedin', label: 'LinkedIn', Icon: Linkedin },
  { value: 'facebook', label: 'Facebook', Icon: Facebook },
  { value: 'instagram', label: 'Instagram', Icon: Instagram },
  { value: 'youtube', label: 'YouTube', Icon: Youtube },
  { value: 'website', label: 'Website / Other', Icon: Globe },
];

export default function PlatformFooterEditor() {
  const { data, isLoading } = useMarketingFooter();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<MarketingFooterSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data && !draft) setDraft(data);
  }, [data, draft]);

  const dirty = draft && data && JSON.stringify(draft) !== JSON.stringify(data);

  const save = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const payload = {
        tagline: draft.tagline,
        social_links: draft.social_links as any,
        columns: draft.columns as any,
        copyright_text: draft.copyright_text,
        bottom_tagline: draft.bottom_tagline,
      };
      let error;
      if (draft.id) {
        ({ error } = await supabase.from('marketing_footer_settings').update(payload).eq('id', draft.id));
      } else {
        ({ error } = await supabase.from('marketing_footer_settings').insert(payload));
      }
      if (error) throw error;
      toast.success('Footer saved');
      qc.invalidateQueries({ queryKey: ['marketing-footer-settings'] });
    } catch (e: any) {
      toast.error(e?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!draft) return;
    setDraft({ ...draft, ...FOOTER_DEFAULT });
  };

  if (isLoading || !draft) {
    return (
      <PlatformLayout>
        <div className="p-10 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading footer…
        </div>
      </PlatformLayout>
    );
  }

  // ---------- helpers ----------
  const updateSocial = (idx: number, patch: Partial<FooterSocialLink>) => {
    const next = [...draft.social_links];
    next[idx] = { ...next[idx], ...patch };
    setDraft({ ...draft, social_links: next });
  };
  const removeSocial = (idx: number) => {
    setDraft({ ...draft, social_links: draft.social_links.filter((_, i) => i !== idx) });
  };
  const addSocial = () => {
    setDraft({
      ...draft,
      social_links: [...draft.social_links, { icon: 'twitter', href: '#', label: 'Twitter' }],
    });
  };

  const updateColumn = (ci: number, patch: Partial<FooterColumn>) => {
    const next = [...draft.columns];
    next[ci] = { ...next[ci], ...patch };
    setDraft({ ...draft, columns: next });
  };
  const removeColumn = (ci: number) => {
    setDraft({ ...draft, columns: draft.columns.filter((_, i) => i !== ci) });
  };
  const addColumn = () => {
    setDraft({ ...draft, columns: [...draft.columns, { title: 'New column', links: [] }] });
  };
  const moveColumn = (ci: number, dir: -1 | 1) => {
    const next = [...draft.columns];
    const j = ci + dir;
    if (j < 0 || j >= next.length) return;
    [next[ci], next[j]] = [next[j], next[ci]];
    setDraft({ ...draft, columns: next });
  };

  const addLink = (ci: number) => {
    const col = draft.columns[ci];
    updateColumn(ci, { links: [...col.links, { label: 'New link', to: '/' }] });
  };
  const updateLink = (ci: number, li: number, patch: Partial<{ label: string; to: string }>) => {
    const col = draft.columns[ci];
    const links = [...col.links];
    links[li] = { ...links[li], ...patch };
    updateColumn(ci, { links });
  };
  const removeLink = (ci: number, li: number) => {
    const col = draft.columns[ci];
    updateColumn(ci, { links: col.links.filter((_, i) => i !== li) });
  };

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <LinkIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Marketing footer</h1>
              <p className="text-sm text-muted-foreground">
                Edit the footer shown on every public marketing page. Use{' '}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{year}'}</code> and{' '}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded">{'{siteName}'}</code> in the copyright line.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={resetDefaults}>Reset defaults</Button>
            <Button size="sm" onClick={save} disabled={!dirty || saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </div>
        </header>

        {/* Brand block */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" /> Brand block
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tagline (under logo)</Label>
              <Textarea rows={3} value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Social links</Label>
                <Button variant="outline" size="sm" onClick={addSocial} className="h-7 gap-1">
                  <Plus className="h-3 w-3" /> Add
                </Button>
              </div>
              {draft.social_links.length === 0 && (
                <p className="text-xs text-muted-foreground italic">No social links.</p>
              )}
              {draft.social_links.map((s, idx) => {
                const opt = SOCIAL_OPTIONS.find((o) => o.value === s.icon) ?? SOCIAL_OPTIONS[6];
                const Icon = opt.Icon;
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <Select value={s.icon} onValueChange={(v) => updateSocial(idx, { icon: v })}>
                      <SelectTrigger className="w-44 h-9">
                        <SelectValue>
                          <span className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5" /> {opt.label}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SOCIAL_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            <span className="flex items-center gap-2">
                              <o.Icon className="h-3.5 w-3.5" /> {o.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input
                      value={s.label}
                      onChange={(e) => updateSocial(idx, { label: e.target.value })}
                      placeholder="Aria label"
                      className="h-9 max-w-[180px]"
                    />
                    <Input
                      value={s.href}
                      onChange={(e) => updateSocial(idx, { href: e.target.value })}
                      placeholder="https://… or #"
                      className="h-9 flex-1"
                    />
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeSocial(idx)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Columns */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Link columns</CardTitle>
            <Button variant="outline" size="sm" onClick={addColumn} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add column
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            {draft.columns.length === 0 && (
              <p className="text-sm text-muted-foreground italic">No columns. Add one to start.</p>
            )}
            {draft.columns.map((col, ci) => (
              <div key={ci} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveColumn(ci, -1)} disabled={ci === 0}>
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => moveColumn(ci, 1)} disabled={ci === draft.columns.length - 1}>
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </Button>
                  </div>
                  <Input
                    value={col.title}
                    onChange={(e) => updateColumn(ci, { title: e.target.value })}
                    placeholder="Column title"
                    className="h-9 font-medium"
                  />
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeColumn(ci)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  {col.links.length === 0 && (
                    <p className="text-xs text-muted-foreground italic">No links yet.</p>
                  )}
                  {col.links.map((l, li) => (
                    <div key={li} className="flex items-center gap-2">
                      <Input
                        value={l.label}
                        onChange={(e) => updateLink(ci, li, { label: e.target.value })}
                        placeholder="Label"
                        className="h-9 max-w-[200px]"
                      />
                      <Input
                        value={l.to}
                        onChange={(e) => updateLink(ci, li, { to: e.target.value })}
                        placeholder="/path or https://…"
                        className="h-9 flex-1"
                      />
                      <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-destructive" onClick={() => removeLink(ci, li)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addLink(ci)} className="gap-1.5 mt-1">
                    <Plus className="h-3 w-3" /> Add link
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Bottom bar */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Bottom bar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Copyright text</Label>
              <Input
                value={draft.copyright_text}
                onChange={(e) => setDraft({ ...draft, copyright_text: e.target.value })}
                placeholder="© {year} {siteName}. All rights reserved."
              />
              <p className="text-[11px] text-muted-foreground">
                Tokens: <code className="bg-muted px-1 rounded">{'{year}'}</code>{' '}
                <code className="bg-muted px-1 rounded">{'{siteName}'}</code>
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Right-side tagline</Label>
              <Input
                value={draft.bottom_tagline}
                onChange={(e) => setDraft({ ...draft, bottom_tagline: e.target.value })}
                placeholder="Built for restaurants that move fast."
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end pt-2">
          <Button size="lg" onClick={save} disabled={!dirty || saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save footer
          </Button>
        </div>
      </div>
    </PlatformLayout>
  );
}
