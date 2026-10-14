import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { SUPPORT_CATEGORIES } from '@/lib/support';
type Article = Database['public']['Tables']['support_knowledge_articles']['Row'];
type Editor = Pick<Article, 'title' | 'body' | 'category' | 'is_active'> & { id?: string };

export default function KnowledgeTab() {
  const client = useQueryClient();
  const { data: articles = [], isLoading, error, refetch } = useQuery({ queryKey: ['support-knowledge'], queryFn: async () => {
    const { data, error } = await supabase.from('support_knowledge_articles').select('*').order('title'); if (error) throw error; return data ?? [];
  } });
  const [search, setSearch] = useState(''); const [editor, setEditor] = useState<Editor | null>(null); const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const open = (article: Editor) => { setEditor(article); setSaveError(''); };
  const save = async () => {
    if (!editor || saving) return;
    if (!editor.title.trim() || !editor.body.trim()) { setSaveError('Title and answer are required.'); return; }
    setSaving(true); setSaveError('');
    try {
      const payload = { title: editor.title.trim(), body: editor.body.trim(), category: editor.category, is_active: editor.is_active };
      const request = editor.id ? supabase.from('support_knowledge_articles').update(payload).eq('id', editor.id) : supabase.from('support_knowledge_articles').insert({ ...payload, slug: `guide-${crypto.randomUUID()}` });
      const { error } = await request.select('id').single(); if (error) throw error;
      await client.invalidateQueries({ queryKey: ['support-knowledge'] }); setEditor(null); toast.success('AI knowledge saved');
    } catch (cause) { setSaveError(cause instanceof Error ? cause.message : 'Could not save article.'); }
    finally { setSaving(false); }
  };
  const shown = articles.filter(article => `${article.title} ${article.body}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="mx-auto max-w-4xl space-y-5 p-4 lg:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold">AI platform knowledge</h2><p className="mt-1 text-sm text-muted-foreground">Approved guides and FAQs the assistant uses in automatic replies and drafts.</p><p className="mt-2 text-xs text-muted-foreground">{articles.filter(article => article.is_active).length} published guides · Updates apply to new replies. Prices come from the current catalog.</p></div><Button onClick={() => open({ title: '', body: '', category: 'other', is_active: false })}>Add knowledge</Button></div>
    <Input aria-label="Search AI knowledge" placeholder="Search guides and answers…" value={search} onChange={event => setSearch(event.target.value)} />
    {isLoading ? <p>Loading platform knowledge…</p> : error ? <div><p role="alert">Could not load AI knowledge.</p><Button variant="outline" onClick={() => void refetch()}>Try again</Button></div> : shown.length === 0 ? <p className="text-sm text-muted-foreground">No matching guides. Add an article to teach the assistant a new topic.</p> : <div className="grid gap-3 sm:grid-cols-2">{shown.map(article => <article key={article.id} aria-label={article.title} className="space-y-3 rounded-xl border p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-medium">{article.title}</h3><Badge variant={article.is_active ? 'secondary' : 'outline'}>{article.is_active ? 'Published' : 'Draft'}</Badge></div><p className="line-clamp-3 text-sm text-muted-foreground">{article.body}</p><Button size="sm" variant="outline" onClick={() => open(article)} aria-label={`Edit ${article.title}`}>Edit guide</Button></article>)}</div>}
    <Dialog open={!!editor} onOpenChange={open => { if (!open && !saving) setEditor(null); }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{editor?.id ? 'Edit AI knowledge' : 'Add AI knowledge'}</DialogTitle><DialogDescription>Write accurate instructions customers can follow. Leave out passwords, API keys, and private customer details.</DialogDescription></DialogHeader>{editor && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void save(); }}>
      <div className="space-y-1.5"><Label htmlFor="knowledge-title">Guide title</Label><Input id="knowledge-title" value={editor.title} onChange={event => setEditor({ ...editor, title: event.target.value })} maxLength={120} required disabled={saving} /></div>
      <div className="space-y-1.5"><Label htmlFor="knowledge-category">Topic</Label><select id="knowledge-category" className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={editor.category} onChange={event => setEditor({ ...editor, category: event.target.value })} disabled={saving}>{SUPPORT_CATEGORIES.map(category => <option key={category.value} value={category.value}>{category.label}</option>)}</select></div>
      <div className="space-y-1.5"><Label htmlFor="knowledge-body">Platform answer or guide</Label><Textarea id="knowledge-body" rows={10} value={editor.body} onChange={event => setEditor({ ...editor, body: event.target.value })} maxLength={6000} required disabled={saving} /><p className="text-xs text-muted-foreground">Include clear steps and page links. {editor.body.length}/6000 characters</p></div>
      <div className="flex items-center justify-between gap-3"><div><Label htmlFor="knowledge-published">Use this guide in AI replies</Label><p className="text-xs text-muted-foreground">Turn off to keep it as a draft.</p></div><Switch id="knowledge-published" checked={editor.is_active} onCheckedChange={value => setEditor({ ...editor, is_active: value })} disabled={saving} /></div>
      {saveError && <p role="alert" className="text-sm text-destructive">{saveError}</p>}<div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditor(null)} disabled={saving}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save knowledge'}</Button></div>
    </form>}</DialogContent></Dialog>
  </div>;
}
