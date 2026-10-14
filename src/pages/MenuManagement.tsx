import { useState, useRef, useCallback } from 'react';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { createPortal } from 'react-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useCurrency } from '@/lib/currency';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

import {
  Plus, Trash2, ArrowLeft, Pencil, X, Check, ImagePlus,
  Eye, EyeOff, Upload, Filter, GripVertical,
} from 'lucide-react';
import AddonManager from '@/components/admin/AddonManager';
import MenuItemTagAssigner from '@/components/customization/MenuItemTagAssigner';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import PlanLimitNotice, { usePlanLimitGate } from '@/components/PlanLimitNotice';
import { uploadWithProgress } from '@/lib/storage-upload';
import UploadProgress from '@/components/upload/UploadProgress';

// ─── Helpers ────────────────────────────────────────────────
function getPublicUrl(path: string) {
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadImage(file: File, onProgress?: (p: number) => void): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `${crypto.randomUUID()}.${ext}`;
  const { publicUrl } = await uploadWithProgress({
    bucket: 'menu-images',
    path,
    file: await compressImage(file, COMPRESS_PRESETS.content),
    onProgress,
  });
  return publicUrl;
}

// ─── Sortable wrapper ───────────────────────────────────────
function SortableItem({ id, children }: { id: string; children: (props: { listeners: any; attributes: any; setNodeRef: any; style: any; isDragging: boolean }) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, position: 'relative' as const };
  return <>{children({ listeners, attributes, setNodeRef, style, isDragging })}</>;
}

// ─── Component ──────────────────────────────────────────────
export default function MenuManagement() {
  const queryClient = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const { disabled: itemLimitReached, reason: itemLimitReason } = usePlanLimitGate('maxMenuItems', 'menu items');

  // Category state
  const [newCatName, setNewCatName] = useState('');
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');

  // Item state
  const [filterCatId, setFilterCatId] = useState<string>('all');
  const [itemModal, setItemModal] = useState<'add' | 'edit' | null>(null);
  const [itemForm, setItemForm] = useState({
    id: '',
    name: '',
    description: '',
    price: '',
    category_id: '',
    image_url: '' as string | null,
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Queries (scoped to current tenant) ─────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu_items_all', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const filteredItems = filterCatId === 'all'
    ? menuItems
    : menuItems.filter(i => i.category_id === filterCatId);

  // ─── Bulk selection ─────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkConfirmOpen, setBulkConfirmOpen] = useState(false);
  const visibleIds = filteredItems.map(i => i.id);
  const selectedVisible = selectedIds.filter(id => visibleIds.includes(id));
  const allVisibleSelected = visibleIds.length > 0 && selectedVisible.length === visibleIds.length;
  const toggleSelect = (id: string) =>
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  const toggleSelectAll = () =>
    setSelectedIds(allVisibleSelected ? [] : visibleIds);


  // ─── DnD Sensors ────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleCategoryDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = categories.findIndex(c => c.id === active.id);
    const newIndex = categories.findIndex(c => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(categories, oldIndex, newIndex);
    // Optimistic update
    queryClient.setQueryData(['categories'], reordered);
    // Persist
    const updates = reordered.map((cat, i) =>
      supabase.from('categories').update({ sort_order: i }).eq('id', cat.id)
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  }, [categories, queryClient]);

  const handleItemDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = filteredItems.findIndex(i => i.id === active.id);
    const newIndex = filteredItems.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(filteredItems, oldIndex, newIndex);
    // Optimistic update
    queryClient.setQueryData(['menu_items_all'], (prev: any[]) => {
      if (!prev) return prev;
      const updated = [...prev];
      reordered.forEach((item, i) => {
        const idx = updated.findIndex(u => u.id === item.id);
        if (idx !== -1) updated[idx] = { ...updated[idx], sort_order: i };
      });
      return updated.sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
    });
    // Persist
    const updates = reordered.map((item, i) =>
      supabase.from('menu_items').update({ sort_order: i }).eq('id', item.id)
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
  }, [filteredItems, queryClient]);

  const addCategory = useMutation({
    mutationFn: async () => {
      if (!newCatName.trim()) return;
      if (!restaurantId) throw new Error('No active restaurant');
      const { error } = await supabase.from('categories').insert({
        name: newCatName.trim(),
        sort_order: categories.length,
        restaurant_id: restaurantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewCatName('');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('categories').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditCatId(null);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success('Category deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ─── Item Mutations ─────────────────────────────────────
  const saveItem = useMutation({
    mutationFn: async () => {
      if (!itemForm.name.trim() || !itemForm.price || !itemForm.category_id) {
        throw new Error('Please fill in name, price, and category');
      }
      setSaving(true);

      let imageUrl = itemForm.image_url;
      if (imageFile) {
        setUploadError(null);
        setUploadProgress(0);
        setUploadingImage(true);
        try {
          imageUrl = await uploadImage(imageFile, setUploadProgress);
        } catch (err: any) {
          setUploadError(err?.message || 'Image upload failed');
          throw err;
        } finally {
          setUploadingImage(false);
        }
      }

      if (itemModal === 'add') {
        if (!restaurantId) throw new Error('No active restaurant');
        const { error } = await supabase.from('menu_items').insert({
          name: itemForm.name.trim(),
          description: itemForm.description.trim() || null,
          price: parseFloat(itemForm.price),
          category_id: itemForm.category_id,
          image_url: imageUrl || null,
          restaurant_id: restaurantId,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menu_items').update({
          name: itemForm.name.trim(),
          description: itemForm.description.trim() || null,
          price: parseFloat(itemForm.price),
          category_id: itemForm.category_id,
          image_url: imageUrl || null,
        }).eq('id', itemForm.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      closeItemModal();
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success(itemModal === 'add' ? 'Item added' : 'Item updated');
    },
    onError: (err: any) => toast.error(err.message),
    onSettled: () => setSaving(false),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success('Item deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const bulkDeleteItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('menu_items').delete().in('id', ids);
      if (error) throw error;
      return ids.length;
    },
    onSuccess: (count) => {
      setSelectedIds([]);
      setBulkConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success(`${count} item${count === 1 ? '' : 's'} deleted`);
    },
    onError: (err: any) => {
      setBulkConfirmOpen(false);
      toast.error(err.message);
    },
  });


  const toggleAvailability = useMutation({
    mutationFn: async ({ id, available }: { id: string; available: boolean }) => {
      const { error } = await supabase.from('menu_items').update({ is_available: available }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu_items_all'] }),
  });

  // ─── Modal helpers ──────────────────────────────────────
  const openAddModal = () => {
    setItemForm({ id: '', name: '', description: '', price: '', category_id: categories[0]?.id ?? '', image_url: null });
    setImageFile(null);
    setImagePreview(null);
    setItemModal('add');
  };

  const openEditModal = (item: any) => {
    setItemForm({
      id: item.id,
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      category_id: item.category_id,
      image_url: item.image_url,
    });
    setImageFile(null);
    setImagePreview(item.image_url || null);
    setItemModal('edit');
  };

  const closeItemModal = () => {
    setItemModal(null);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file, 'image')) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setItemForm(p => ({ ...p, image_url: null }));
  };



  const getCategoryName = (id: string) => categories.find(c => c.id === id)?.name ?? '—';

  // ─── Render ─────────────────────────────────────────────
  return (
    <AdminLayout title="Menu Management" subtitle={`${categories.length} categories · ${menuItems.length} items`}>
      <div className="p-4 lg:p-6 max-w-5xl">
        <div className="mb-4">
          <PlanLimitNotice limitKey="maxMenuItems" resource="menu items" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* ─── Left: Categories ─────────────────────────── */}
          <div>
            <h2 className="label-ui mb-3">Categories</h2>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
              <SortableContext items={categories.map(c => c.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2 mb-3">
                  {categories.map(cat => (
                    <SortableItem key={cat.id} id={cat.id}>
                      {({ listeners, attributes, setNodeRef, style, isDragging }) => (
                        <div
                          ref={setNodeRef}
                          style={style}
                          className={`bg-card card-shadow ring-subtle rounded-lg px-4 py-3 ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
                        >
                          {editCatId === cat.id ? (
                            <div className="flex items-center gap-2">
                              <Input
                                value={editCatName}
                                onChange={(e) => setEditCatName(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') updateCategory.mutate({ id: cat.id, name: editCatName });
                                  if (e.key === 'Escape') setEditCatId(null);
                                }}
                                className="h-8"
                              />
                              <button onClick={() => updateCategory.mutate({ id: cat.id, name: editCatName })} className="text-success">
                                <Check className="h-4 w-4" strokeWidth={2} />
                              </button>
                              <button onClick={() => setEditCatId(null)} className="text-muted-foreground">
                                <X className="h-4 w-4" strokeWidth={2} />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <button
                                  {...listeners}
                                  {...attributes}
                                  className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none"
                                >
                                  <GripVertical className="h-4 w-4" strokeWidth={1.5} />
                                </button>
                                <span className="font-medium text-card-foreground">{cat.name}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => { setEditCatId(cat.id); setEditCatName(cat.name); }}
                                  className="text-muted-foreground hover:text-foreground transition-colors p-1"
                                >
                                  <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </button>
                                <button
                                  onClick={() => { if (confirm(`Delete "${cat.name}" and all its items?`)) deleteCategory.mutate(cat.id); }}
                                  className="text-muted-foreground hover:text-destructive transition-colors p-1"
                                >
                                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </SortableItem>
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category"
                onKeyDown={(e) => e.key === 'Enter' && addCategory.mutate()}
                className="h-9"
              />
              <Button onClick={() => addCategory.mutate()} size="sm" className="shrink-0 gap-1 h-9">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
          </div>

          {/* ─── Right: Menu Items ────────────────────────── */}
          <div>
            {/* Filter bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2 min-w-0">

                <h2 className="label-ui">Menu Items</h2>
                <div className="flex items-center gap-1 ml-2">
                  <Filter className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <select
                    value={filterCatId}
                    onChange={(e) => setFilterCatId(e.target.value)}
                    className="text-sm bg-transparent border-none text-muted-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Categories</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                onClick={openAddModal}
                size="sm"
                className="gap-1.5"
                disabled={itemLimitReached}
                title={itemLimitReason}
              >
                <Plus className="h-4 w-4" /> Add Item
              </Button>
            </div>

            {/* Bulk actions bar */}
            {filteredItems.length > 0 && (
              <div className="flex flex-wrap items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-secondary/40 ring-subtle">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                  <Checkbox checked={allVisibleSelected} onCheckedChange={toggleSelectAll} />
                  Select all
                </label>
                {selectedVisible.length > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">{selectedVisible.length} selected</span>
                    <AlertDialog open={bulkConfirmOpen} onOpenChange={setBulkConfirmOpen}>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 ml-auto"
                          disabled={bulkDeleteItems.isPending}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={1.5} /> Delete selected
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete {selectedVisible.length} menu item{selectedVisible.length === 1 ? '' : 's'}?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes the selected item{selectedVisible.length === 1 ? '' : 's'} from your menu,
                            along with their images, add-ons and tags. This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <div className="max-h-40 overflow-y-auto rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground space-y-1">
                          {filteredItems
                            .filter(i => selectedVisible.includes(i.id))
                            .slice(0, 20)
                            .map(i => <p key={i.id} className="truncate">• {i.name}</p>)}
                          {selectedVisible.length > 20 && (
                            <p className="italic">and {selectedVisible.length - 20} more…</p>
                          )}
                        </div>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={bulkDeleteItems.isPending}
                            onClick={(e) => { e.preventDefault(); bulkDeleteItems.mutate(selectedVisible); }}
                          >
                            {bulkDeleteItems.isPending ? 'Deleting…' : `Delete ${selectedVisible.length}`}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                    <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>Clear</Button>
                  </>
                )}
              </div>
            )}



            {/* Items list */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleItemDragEnd}>
              <SortableContext items={filteredItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {filteredItems.map(item => (
                    <SortableItem key={item.id} id={item.id}>
                      {({ listeners, attributes, setNodeRef, style, isDragging }) => (
                        <div
                          ref={setNodeRef}
                          style={style}
                          className={`bg-card card-shadow ring-subtle rounded-lg overflow-hidden ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
                        >
                          <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4">
                            <Checkbox
                              checked={selectedIds.includes(item.id)}
                              onCheckedChange={() => toggleSelect(item.id)}
                              className="shrink-0"
                              aria-label={`Select ${item.name}`}
                            />
                            {/* Drag handle */}

                            <button
                              {...listeners}
                              {...attributes}
                              className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none shrink-0"
                            >
                              <GripVertical className="h-4 w-4" strokeWidth={1.5} />
                            </button>

                            {/* Image thumbnail */}
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover shrink-0"
                              />
                            ) : (
                              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-md bg-secondary flex items-center justify-center shrink-0">
                                <ImagePlus className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.5} />
                              </div>
                            )}

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link to={`/admin/menu/${item.id}`} className="font-medium text-card-foreground hover:text-primary transition-colors">{item.name}</Link>
                                <span className="price-text tabular-nums">{fmt(Number(item.price))}</span>
                                <span className="text-xs px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                  {getCategoryName(item.category_id)}
                                </span>
                                {!item.is_available && (
                                  <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-medium">
                                    Unavailable
                                  </span>
                                )}
                              </div>
                              {item.description && (
                                <p className="text-sm text-muted-foreground mt-0.5 truncate">{item.description}</p>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                              <button
                                onClick={() => toggleAvailability.mutate({ id: item.id, available: !item.is_available })}
                                className={`p-2 rounded-md transition-colors ${
                                  item.is_available
                                    ? 'text-success hover:bg-success/10'
                                    : 'text-muted-foreground hover:bg-secondary'
                                }`}
                                title={item.is_available ? 'Mark unavailable' : 'Mark available'}
                              >
                                {item.is_available ? <Eye className="h-4 w-4" strokeWidth={1.5} /> : <EyeOff className="h-4 w-4" strokeWidth={1.5} />}
                              </button>
                              <button
                                onClick={() => openEditModal(item)}
                                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                              >
                                <Pencil className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                              <button
                                onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem.mutate(item.id); }}
                                className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </SortableItem>
                  ))}

                  {filteredItems.length === 0 && (
                    <div className="text-center py-12">
                      <ImagePlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1} />
                      <p className="text-muted-foreground">
                        {menuItems.length === 0 ? 'No menu items yet' : 'No items in this category'}
                      </p>
                    </div>
                  )}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </div>
      </div>

      {/* ─── Add/Edit Item Modal ──────────────────────────── */}
      {itemModal && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[100]"
            onClick={closeItemModal}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-lg bg-card card-shadow rounded-xl overflow-hidden max-h-[90dvh] flex flex-col pointer-events-auto">
              <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <h2 className="text-lg font-semibold text-card-foreground">
                    {itemModal === 'add' ? 'Add Menu Item' : 'Edit Menu Item'}
                  </h2>
                  <button onClick={closeItemModal} className="text-muted-foreground hover:text-foreground">
                    <X className="h-5 w-5" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="space-y-4">
                  {/* Image upload */}
                  <div>
                    <Label className="label-ui mb-2 block">Image</Label>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPT_IMAGE_ATTR}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {imagePreview ? (
                      <div className="relative group">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="w-full h-40 object-cover rounded-lg"
                        />
                        <div className="absolute inset-0 bg-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={removeImage}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-32 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground hover:border-foreground/30 transition-colors"
                      >
                        <Upload className="h-5 w-5" strokeWidth={1.5} />
                        <span className="text-xs">Upload image</span>
                      </button>
                    )}
                    <UploadProgress
                      className="mt-2"
                      uploading={uploadingImage}
                      progress={uploadProgress}
                      error={uploadError}
                      fileName={imageFile?.name}
                      onRetry={() => saveItem.mutate()}
                    />
                  </div>

                  {/* Name & Price */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="label-ui">Name</Label>
                      <Input
                        value={itemForm.name}
                        onChange={(e) => setItemForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Item name"
                      />
                    </div>
                    <div>
                      <Label className="label-ui">Price</Label>
                      <Input
                        value={itemForm.price}
                        onChange={(e) => setItemForm(p => ({ ...p, price: e.target.value }))}
                        placeholder="9.99"
                        type="number"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div>
                    <Label className="label-ui">Description</Label>
                    <textarea
                      value={itemForm.description}
                      onChange={(e) => setItemForm(p => ({ ...p, description: e.target.value }))}
                      placeholder="Optional description"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  {/* Category */}
                  <div>
                    <Label className="label-ui">Category</Label>
                    <select
                      value={itemForm.category_id}
                      onChange={(e) => setItemForm(p => ({ ...p, category_id: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">Select category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Variants & Addons + Tags (only in edit mode) */}
                  {itemModal === 'edit' && itemForm.id && (
                    <>
                      <div className="pt-2 border-t border-border">
                        <MenuItemTagAssigner menuItemId={itemForm.id} />
                      </div>
                      <div className="pt-2 border-t border-border">
                        <AddonManager menuItemId={itemForm.id} />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 bg-secondary/30 border-t border-border flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={closeItemModal} disabled={saving}>Cancel</Button>
                <Button onClick={() => saveItem.mutate()} disabled={saving} className="gap-1.5">
                  {saving ? 'Saving...' : itemModal === 'add' ? 'Add Item' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </AdminLayout>
  );
}
