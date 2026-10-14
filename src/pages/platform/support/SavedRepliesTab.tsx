import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useDeleteSupportReply, useSaveSupportReply, useSupportSavedReplies } from '@/hooks/useSupportSavedReplies';
import type { SupportSavedReply } from '@/lib/support';

export default function SavedRepliesTab() {
  const { data: replies = [], isLoading } = useSupportSavedReplies();
  const save = useSaveSupportReply();
  const remove = useDeleteSupportReply();
  const [editing, setEditing] = useState<Partial<SupportSavedReply> | null>(null);

  const submit = async () => {
    if (!editing?.title?.trim() || !editing.body?.trim()) {
      toast.error('Title and text are required');
      return;
    }
    try {
      await save.mutateAsync({ id: editing.id, title: editing.title, shortcut: editing.shortcut ?? null, body: editing.body });
      toast.success('Saved reply saved');
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save');
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Saved replies</h2>
          <p className="text-xs text-muted-foreground">Reusable answers. Type <kbd className="font-mono">/</kbd> in an empty reply to insert one. <code>{'{name}'}</code> becomes the customer’s name.</p>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing({ title: '', shortcut: '', body: '' })}>
          <Plus className="h-4 w-4" /> New reply
        </Button>
      </div>
      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : replies.length === 0 ? (
          <div className="p-6 text-sm text-muted-foreground">No saved replies yet.</div>
        ) : replies.map((r) => (
          <div key={r.id} className="p-4 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{r.title}</span>
                {r.shortcut && <span className="font-mono text-[11px] text-muted-foreground">{r.shortcut}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{r.body}</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`}><Pencil className="h-4 w-4" /></Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={`Delete ${r.title}`}
              onClick={() => {
                if (confirm(`Delete "${r.title}"?`)) remove.mutate(r.id, { onError: (e) => toast.error(e.message) });
              }}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing?.id ? 'Edit saved reply' : 'New saved reply'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="sr-title">Title</Label>
              <Input id="sr-title" value={editing?.title ?? ''} onChange={(e) => setEditing((d) => ({ ...d, title: e.target.value }))} maxLength={80} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-short">Shortcut (optional)</Label>
              <Input id="sr-short" value={editing?.shortcut ?? ''} onChange={(e) => setEditing((d) => ({ ...d, shortcut: e.target.value }))} placeholder="/pay" maxLength={30} className="font-mono" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sr-body">Text</Label>
              <Textarea id="sr-body" value={editing?.body ?? ''} onChange={(e) => setEditing((d) => ({ ...d, body: e.target.value }))} rows={6} maxLength={4000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={() => void submit()} disabled={save.isPending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
