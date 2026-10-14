import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Eye, EyeOff, Save, Plus, Trash2, RefreshCw, ExternalLink } from 'lucide-react';
import PlatformLayout from './PlatformLayout';
import MarketingLayout from '@/components/marketing/MarketingLayout';
import SectionRenderer from '@/components/marketing/sections/SectionRenderer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  SECTION_DEFAULTS, SECTION_LABELS,
  type MarketingSection, type MarketingSectionType, type SectionContent,
} from '@/lib/marketing-sections';
import { validateSectionContent } from '@/lib/marketing-validation';

const PAGE_KEY = 'home';

type EditableSection = MarketingSection & { _dirty?: boolean };

function SortableRow({
  section, active, onSelect, onToggle, onDelete,
}: {
  section: EditableSection;
  active: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: section.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 rounded-lg border p-2 ${
        active ? 'border-primary bg-primary/5' : 'border-border bg-card'
      }`}
    >
      <button
        {...attributes}
        {...listeners}
        className="text-muted-foreground hover:text-foreground p-1 cursor-grab active:cursor-grabbing"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onSelect} className="flex-1 text-left">
        <div className="text-sm font-medium">{SECTION_LABELS[section.section_type] ?? section.section_type}</div>
        <div className="text-[11px] text-muted-foreground">
          {section._dirty ? 'Unsaved changes' : section.is_enabled ? 'Visible' : 'Hidden'}
        </div>
      </button>
      <button
        onClick={onToggle}
        className="text-muted-foreground hover:text-foreground p-1.5"
        aria-label={section.is_enabled ? 'Hide section' : 'Show section'}
      >
        {section.is_enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </button>
      <button
        onClick={onDelete}
        className="text-muted-foreground hover:text-destructive p-1.5"
        aria-label="Delete section"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Generic JSON-aware field editor. Renders inputs based on value type. */
function ContentEditor({
  value, onChange,
}: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const updateKey = (k: string, v: unknown) => onChange({ ...value, [k]: v });

  return (
    <div className="space-y-4">
      {Object.entries(value).map(([key, val]) => {
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        if (typeof val === 'boolean') {
          return (
            <div key={key} className="flex items-center justify-between rounded-md border border-border p-3">
              <Label htmlFor={key}>{label}</Label>
              <Switch id={key} checked={val} onCheckedChange={(v) => updateKey(key, v)} />
            </div>
          );
        }
        if (typeof val === 'string') {
          const isLong = val.length > 80 || /description|quote/i.test(key);
          return (
            <div key={key} className="space-y-1.5">
              <Label htmlFor={key} className="text-xs">{label}</Label>
              {isLong ? (
                <Textarea id={key} value={val} onChange={(e) => updateKey(key, e.target.value)} rows={3} />
              ) : (
                <Input id={key} value={val} onChange={(e) => updateKey(key, e.target.value)} />
              )}
            </div>
          );
        }
        if (Array.isArray(val)) {
          // string[] → one input per line ; object[] → JSON textarea
          const isStringList = val.every((x) => typeof x === 'string');
          if (isStringList) {
            return (
              <div key={key} className="space-y-1.5">
                <Label className="text-xs">{label} (one per line)</Label>
                <Textarea
                  value={(val as string[]).join('\n')}
                  rows={Math.min(8, Math.max(3, val.length + 1))}
                  onChange={(e) => updateKey(key, e.target.value.split('\n').filter(Boolean))}
                />
              </div>
            );
          }
          return (
            <div key={key} className="space-y-1.5">
              <Label className="text-xs">{label} (JSON)</Label>
              <Textarea
                value={JSON.stringify(val, null, 2)}
                rows={Math.min(20, val.length * 4 + 2)}
                className="font-mono text-xs"
                onChange={(e) => {
                  try {
                    updateKey(key, JSON.parse(e.target.value));
                  } catch {
                    /* ignore until valid */
                  }
                }}
              />
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function PlatformMarketingHome() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<MarketingSection[]>({
    queryKey: ['marketing-sections-editor', PAGE_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('marketing_page_sections')
        .select('*')
        .eq('page_key', PAGE_KEY)
        .order('sort_order');
      if (error) throw error;
      return (data ?? []) as MarketingSection[];
    },
  });

  const [draft, setDraft] = useState<EditableSection[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [rawDraft, setRawDraft] = useState<string>('');
  const [rawError, setRawError] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  useEffect(() => { if (data) { setDraft(data); if (!activeId && data[0]) setActiveId(data[0].id); } }, [data]);

  const active = useMemo(() => draft.find(s => s.id === activeId) ?? null, [draft, activeId]);

  // Sync raw JSON textarea whenever the active section changes.
  useEffect(() => {
    if (active) {
      setRawDraft(JSON.stringify(active.content ?? {}, null, 2));
      setRawError(null);
    } else {
      setRawDraft('');
      setRawError(null);
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshPreview = () => setPreviewKey(k => k + 1);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const oldIdx = draft.findIndex(s => s.id === e.active.id);
    const newIdx = draft.findIndex(s => s.id === e.over!.id);
    const next = arrayMove(draft, oldIdx, newIdx).map((s, i) => ({ ...s, sort_order: (i + 1) * 10, _dirty: true }));
    setDraft(next);
  };

  const updateActiveContent = (content: SectionContent) => {
    setDraft(d => d.map(s => s.id === activeId ? { ...s, content, _dirty: true } : s));
  };

  const onRawChange = (text: string) => {
    setRawDraft(text);
    if (!text.trim()) {
      setRawError('Content cannot be empty. Use {} for an empty object.');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      setRawError(`Invalid JSON: ${(err as Error).message}`);
      return;
    }
    const result = validateSectionContent(parsed);
    if (!result.ok) {
      setRawError(result.message);
      return;
    }
    setRawError(null);
    updateActiveContent(parsed as SectionContent);
  };

  const toggleEnabled = (id: string) => {
    setDraft(d => d.map(s => s.id === id ? { ...s, is_enabled: !s.is_enabled, _dirty: true } : s));
  };

  const deleteSection = async (id: string) => {
    if (!confirm('Delete this section? This cannot be undone.')) return;
    const { error } = await supabase.from('marketing_page_sections').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Section deleted');
    qc.invalidateQueries({ queryKey: ['marketing-sections-editor', PAGE_KEY] });
    qc.invalidateQueries({ queryKey: ['marketing-sections', PAGE_KEY] });
    if (activeId === id) setActiveId(null);
  };

  const addSection = async (type: MarketingSectionType) => {
    const maxOrder = draft.reduce((m, s) => Math.max(m, s.sort_order), 0);
    const { data: created, error } = await supabase.from('marketing_page_sections').insert({
      page_key: PAGE_KEY,
      section_type: type,
      sort_order: maxOrder + 10,
      is_enabled: true,
      content: SECTION_DEFAULTS[type] as unknown as SectionContent,
    }).select().single();
    if (error) return toast.error(error.message);
    toast.success('Section added');
    qc.invalidateQueries({ queryKey: ['marketing-sections-editor', PAGE_KEY] });
    qc.invalidateQueries({ queryKey: ['marketing-sections', PAGE_KEY] });
    if (created) setActiveId(created.id);
  };

  const saveAll = async () => {
    const dirty = draft.filter(s => s._dirty);
    if (dirty.length === 0) return toast.info('No changes to save');

    // Validate every dirty section's content before hitting the network.
    for (const s of dirty) {
      const result = validateSectionContent(s.content);
      if (!result.ok) {
        const label = SECTION_LABELS[s.section_type] ?? s.section_type;
        toast.error(`"${label}" has invalid content`, { description: result.message });
        setActiveId(s.id);
        return;
      }
    }

    const updates = dirty.map(s => supabase
      .from('marketing_page_sections')
      .update({ sort_order: s.sort_order, is_enabled: s.is_enabled, content: s.content })
      .eq('id', s.id));
    const results = await Promise.all(updates);
    const firstErr = results.find(r => r.error);
    if (firstErr?.error) {
      const msg = firstErr.error.message;
      const isJsonErr = /json|invalid input syntax|type/i.test(msg);
      return toast.error(
        isJsonErr ? 'Database rejected the content payload' : 'Could not save changes',
        { description: msg },
      );
    }
    toast.success(`Saved ${dirty.length} change${dirty.length > 1 ? 's' : ''}`);
    setDraft(d => d.map(s => ({ ...s, _dirty: false })));
    qc.invalidateQueries({ queryKey: ['marketing-sections', PAGE_KEY] });
    refreshPreview();
  };

  const dirtyCount = draft.filter(s => s._dirty).length;
  const allTypes = Object.keys(SECTION_LABELS) as MarketingSectionType[];

  return (
    <PlatformLayout>
      <div className="h-screen flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-3 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold">Marketing — Home page</h1>
            <p className="text-xs text-muted-foreground">Reorder, edit, hide or add sections. Live preview on the right.</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/" target="_blank" rel="noreferrer">
              <Button variant="outline" size="sm" className="gap-2">
                <ExternalLink className="h-3.5 w-3.5" /> Open live
              </Button>
            </a>
            <Button variant="outline" size="sm" onClick={refreshPreview} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh preview
            </Button>
            <Button size="sm" onClick={saveAll} disabled={dirtyCount === 0} className="gap-2">
              <Save className="h-3.5 w-3.5" /> Save{dirtyCount > 0 ? ` (${dirtyCount})` : ''}
            </Button>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* Left: section list */}
          <aside className="col-span-3 border-r border-border bg-muted/20 overflow-y-auto p-3 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Add section</Label>
              <Select onValueChange={(v) => addSection(v as MarketingSectionType)}>
                <SelectTrigger><SelectValue placeholder="Choose a section type…" /></SelectTrigger>
                <SelectContent>
                  {allTypes.map(t => (
                    <SelectItem key={t} value={t}>
                      <div className="flex items-center gap-2"><Plus className="h-3.5 w-3.5" />{SECTION_LABELS[t]}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Sections ({draft.length})</Label>
              {isLoading ? (
                <div className="text-sm text-muted-foreground p-4">Loading…</div>
              ) : (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
                  <SortableContext items={draft.map(s => s.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {draft.map(s => (
                        <SortableRow
                          key={s.id}
                          section={s}
                          active={s.id === activeId}
                          onSelect={() => setActiveId(s.id)}
                          onToggle={() => toggleEnabled(s.id)}
                          onDelete={() => deleteSection(s.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </aside>

          {/* Middle: editor for active section */}
          <section className="col-span-4 border-r border-border overflow-y-auto p-5">
            {active ? (
              <>
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground uppercase tracking-wider">Editing</div>
                  <h2 className="text-lg font-semibold">{SECTION_LABELS[active.section_type]}</h2>
                </div>
                <Tabs defaultValue="content">
                  <TabsList className="w-full justify-start overflow-x-auto flex-wrap h-auto">
                    <TabsTrigger value="content">Content</TabsTrigger>
                    <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                  </TabsList>
                  <TabsContent value="content" className="mt-4">
                    <ContentEditor
                      value={{ ...(SECTION_DEFAULTS[active.section_type] as unknown as Record<string, unknown>), ...(active.content ?? {}) } as SectionContent}
                      onChange={updateActiveContent}
                    />
                  </TabsContent>
                  <TabsContent value="raw" className="mt-4 space-y-2">
                    <Textarea
                      className={`font-mono text-xs min-h-[400px] ${rawError ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      value={rawDraft}
                      onChange={(e) => onRawChange(e.target.value)}
                      aria-invalid={!!rawError}
                      aria-describedby={rawError ? 'raw-json-error' : undefined}
                    />
                    {rawError ? (
                      <p id="raw-json-error" role="alert" className="text-xs text-destructive">
                        {rawError}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Edits apply to the live preview as soon as the JSON is valid.
                      </p>
                    )}
                  </TabsContent>
                </Tabs>
              </>
            ) : (
              <div className="text-sm text-muted-foreground p-4 text-center">
                Select a section on the left to edit it.
              </div>
            )}
          </section>

          {/* Right: live preview from current draft */}
          <section className="col-span-5 overflow-y-auto bg-background">
            <div className="border-b border-border bg-card px-4 py-2 text-xs text-muted-foreground flex items-center justify-between sticky top-0 z-10">
              <span>Live preview · reflects unsaved changes</span>
              <span className="font-mono">/</span>
            </div>
            <div className="origin-top-left scale-[0.65] w-[154%] pointer-events-none" key={previewKey}>
              <MarketingLayout title="Preview" description="" canonical="/" noFooter supportChat={false}>
                {draft.filter(s => s.is_enabled).map(s => (
                  <SectionRenderer key={s.id} section={s} />
                ))}
              </MarketingLayout>
            </div>
          </section>
        </div>
      </div>
    </PlatformLayout>
  );
}
