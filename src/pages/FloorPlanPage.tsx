import { useState, useRef, useCallback, useEffect } from 'react';
import UploadProgress from '@/components/upload/UploadProgress';
import { uploadWithProgress } from '@/lib/storage-upload';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { validateImageSize, maxSizeHint, validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Upload, Trash2, MapPin, Edit2, Check, X, Eye, Layers, GripVertical,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

interface FloorPlan {
  id: string;
  name: string;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

interface TableOnPlan {
  id: string;
  label: string;
  status: string;
  capacity: number;
  floor_plan_id: string | null;
  position_x: number;
  position_y: number;
}

const STATUS_COLORS: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  available: { bg: 'bg-success', ring: 'ring-success/30', text: 'text-success-foreground', label: 'Available' },
  occupied: { bg: 'bg-warning', ring: 'ring-warning/30', text: 'text-warning-foreground', label: 'Occupied' },
  reserved: { bg: 'bg-destructive', ring: 'ring-destructive/30', text: 'text-destructive-foreground', label: 'Reserved' },
};

export default function FloorPlanPage() {
  const queryClient = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newFloorName, setNewFloorName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lastUploadFile, setLastUploadFile] = useState<File | null>(null);
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  // ─── Queries ──────────────────────────────────────────────
  const { data: floorPlans = [] } = useQuery<FloorPlan[]>({
    queryKey: ['floor_plans', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('floor_plans')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('sort_order');
      if (error) throw error;
      return data as any;
    },
  });

  const { data: tables = [], refetch: refetchTables } = useQuery<TableOnPlan[]>({
    queryKey: ['floor_plan_tables', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, label, status, capacity, floor_plan_id, position_x, position_y')
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      return (data as any[]).map(t => ({
        ...t,
        position_x: Number(t.position_x ?? 50),
        position_y: Number(t.position_y ?? 50),
      }));
    },
  });

  // Realtime for table status changes
  useEffect(() => {
    const channel = supabase
      .channel('floor-plan-tables')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'restaurant_tables' }, () => {
        refetchTables();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [refetchTables]);

  // Auto-select first floor plan
  useEffect(() => {
    if (floorPlans.length > 0 && !activeFloorId) {
      setActiveFloorId(floorPlans[0].id);
    }
  }, [floorPlans, activeFloorId]);

  const activeFloor = floorPlans.find(fp => fp.id === activeFloorId);
  const tablesOnFloor = tables.filter(t => t.floor_plan_id === activeFloorId);
  const unassignedTables = tables.filter(t => !t.floor_plan_id);

  // ─── Mutations ────────────────────────────────────────────
  const createFloor = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from('floor_plans').insert({
        name,
        sort_order: floorPlans.length,
        restaurant_id: restaurantId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor_plans'] });
      setCreateDialogOpen(false);
      setNewFloorName('');
      toast.success('Floor plan created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteFloor = useMutation({
    mutationFn: async (id: string) => {
      // Unassign tables first
      await supabase.from('restaurant_tables').update({ floor_plan_id: null } as any).eq('floor_plan_id', id);
      const { error } = await supabase.from('floor_plans').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor_plans'] });
      queryClient.invalidateQueries({ queryKey: ['floor_plan_tables'] });
      setActiveFloorId(null);
      toast.success('Floor plan deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const uploadImage = useCallback(async (file: File) => {
    if (!activeFloorId) return;
    if (!validateImageFile(file, 'large')) return;
    setLastUploadFile(file);
    setUploadError(null);
    setUploadProgress(0);
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${activeFloorId}.${ext}`;
      const { publicUrl } = await uploadWithProgress({
        bucket: 'floor-plans',
        path,
        file: await compressImage(file, COMPRESS_PRESETS.blueprint),
        upsert: true,
        onProgress: setUploadProgress,
      });
      const imageUrl = `${publicUrl}?t=${Date.now()}`;
      const { error: updateError } = await supabase.from('floor_plans').update({ image_url: imageUrl } as any).eq('id', activeFloorId);
      if (updateError) throw updateError;
      queryClient.invalidateQueries({ queryKey: ['floor_plans'] });
      toast.success('Floor plan image uploaded');
      setUploadError(null);
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed');
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  }, [activeFloorId, queryClient]);

  const assignTable = useMutation({
    mutationFn: async ({ tableId, floorId, x, y }: { tableId: string; floorId: string; x: number; y: number }) => {
      const { error } = await supabase.from('restaurant_tables')
        .update({ floor_plan_id: floorId, position_x: x, position_y: y } as any)
        .eq('id', tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor_plan_tables'] });
    },
  });

  const updateTablePosition = useMutation({
    mutationFn: async ({ tableId, x, y }: { tableId: string; x: number; y: number }) => {
      const { error } = await supabase.from('restaurant_tables')
        .update({ position_x: x, position_y: y } as any)
        .eq('id', tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor_plan_tables'] });
    },
  });

  const unassignTable = useMutation({
    mutationFn: async (tableId: string) => {
      const { error } = await supabase.from('restaurant_tables')
        .update({ floor_plan_id: null } as any)
        .eq('id', tableId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['floor_plan_tables'] });
    },
  });

  // ─── Drag handling ────────────────────────────────────────
  const handleCanvasPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingTable || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    // Optimistic UI update
    const tableEl = document.getElementById(`table-marker-${draggingTable}`);
    if (tableEl) {
      tableEl.style.left = `${x}%`;
      tableEl.style.top = `${y}%`;
    }
  }, [draggingTable]);

  const handleCanvasPointerUp = useCallback((e: React.PointerEvent) => {
    if (!draggingTable || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
    updateTablePosition.mutate({ tableId: draggingTable, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    setDraggingTable(null);
  }, [draggingTable, updateTablePosition]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <AdminLayout title="Floor Plans" subtitle="Visual table layout">
      <div className="min-h-0 pb-16 md:pb-0">
        {/* ─── Floor plan tabs ─────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="max-w-6xl mx-auto px-3 sm:px-4">
            <div className="flex items-center gap-2 py-2.5 overflow-x-auto scrollbar-hide">
              {floorPlans.map(fp => (
                <button
                  key={fp.id}
                  onClick={() => { setActiveFloorId(fp.id); setEditMode(false); }}
                  className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    activeFloorId === fp.id
                      ? 'bg-foreground text-background'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" strokeWidth={1.5} />
                  {fp.name}
                </button>
              ))}
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="shrink-0 gap-1.5 text-muted-foreground">
                    <Plus className="h-3.5 w-3.5" /> Add Zone
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Floor Plan</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3 py-2">
                    <Label>Name</Label>
                    <Input
                      placeholder="e.g. Indoor, Patio, Rooftop"
                      value={newFloorName}
                      onChange={(e) => setNewFloorName(e.target.value)}
                    />
                  </div>
                  <DialogFooter>
                    <Button
                      onClick={() => createFloor.mutate(newFloorName)}
                      disabled={!newFloorName.trim() || createFloor.isPending}
                    >
                      Create
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        {!activeFloor ? (
          <div className="text-center py-24 px-4">
            <div className="h-16 w-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <MapPin className="h-7 w-7 text-muted-foreground/30" strokeWidth={1.5} />
            </div>
            <p className="text-muted-foreground font-medium mb-2">No floor plans yet</p>
            <p className="text-xs text-muted-foreground/60 mb-4">Create zones like Indoor, Patio, Rooftop</p>
            <Button onClick={() => setCreateDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Create Floor Plan
            </Button>
          </div>
        ) : (
          <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-lg font-bold text-foreground">{activeFloor.name}</h2>
                <Badge variant="secondary" className="text-xs">
                  {tablesOnFloor.length} table{tablesOnFloor.length !== 1 ? 's' : ''}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant={editMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                  className="gap-1.5"
                >
                  {editMode ? <Check className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
                  {editMode ? 'Done' : 'Edit Layout'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="gap-1.5"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {uploading ? 'Uploading…' : 'Upload Image'}
                </Button>
                <span className="text-xs text-muted-foreground self-center">{maxSizeHint('large')}</span>
                <UploadProgress
                  className="w-full"
                  uploading={uploading}
                  progress={uploadProgress}
                  error={uploadError}
                  fileName={lastUploadFile?.name}
                  onRetry={() => lastUploadFile && uploadImage(lastUploadFile)}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={ACCEPT_IMAGE_ATTR}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImage(file);
                    e.target.value = '';
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm(`Delete "${activeFloor.name}"?`)) deleteFloor.mutate(activeFloor.id);
                  }}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                </Button>
              </div>
            </div>

            {/* ─── Canvas ────────────────────────────────────── */}
            <div
              ref={canvasRef}
              className="relative w-full aspect-[16/10] rounded-xl border-2 border-dashed border-border bg-secondary/30 overflow-hidden select-none"
              onPointerMove={editMode ? handleCanvasPointerMove : undefined}
              onPointerUp={editMode ? handleCanvasPointerUp : undefined}
              style={{ touchAction: 'none' }}
            >
              {activeFloor.image_url ? (
                <img
                  src={activeFloor.image_url}
                  alt={activeFloor.name}
                  className="absolute inset-0 w-full h-full object-cover opacity-60"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center text-muted-foreground/40">
                    <MapPin className="h-10 w-10 mx-auto mb-2" strokeWidth={1} />
                    <p className="text-sm">Upload a floor plan image</p>
                  </div>
                </div>
              )}

              {/* Table markers */}
              <AnimatePresence>
                {tablesOnFloor.map(table => {
                  const statusStyle = STATUS_COLORS[table.status] || STATUS_COLORS.available;
                  return (
                    <motion.div
                      key={table.id}
                      id={`table-marker-${table.id}`}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-10 group ${
                        editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                      }`}
                      style={{ left: `${table.position_x}%`, top: `${table.position_y}%` }}
                      onPointerDown={editMode ? (e) => {
                        e.preventDefault();
                        setDraggingTable(table.id);
                      } : undefined}
                    >
                      <div className={`relative flex flex-col items-center`}>
                        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-full ${statusStyle.bg} ${statusStyle.text} ring-2 ${statusStyle.ring} flex items-center justify-center font-bold text-xs sm:text-sm shadow-lg transition-transform ${
                          editMode ? 'hover:scale-110' : 'hover:scale-105'
                        }`}>
                          {table.label.replace(/[^0-9]/g, '') || table.label.charAt(0)}
                        </div>
                        {/* Tooltip */}
                        <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <span className="bg-foreground text-background text-[10px] font-medium px-2 py-0.5 rounded-md shadow">
                            {table.label} · {statusStyle.label} · {table.capacity} seats
                          </span>
                        </div>
                        {editMode && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              unassignTable.mutate(table.id);
                            }}
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" strokeWidth={2} />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              {Object.entries(STATUS_COLORS).map(([key, val]) => (
                <div key={key} className="flex items-center gap-1.5">
                  <span className={`h-3 w-3 rounded-full ${val.bg}`} />
                  <span className="text-xs text-muted-foreground">{val.label}</span>
                </div>
              ))}
            </div>

            {/* ─── Unassigned tables (edit mode) ─────────────── */}
            {editMode && unassignedTables.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-semibold text-foreground mb-3">Unassigned Tables</h3>
                <p className="text-xs text-muted-foreground mb-3">Click a table to place it at the center of the floor plan</p>
                <div className="flex flex-wrap gap-2">
                  {unassignedTables.map(table => (
                    <button
                      key={table.id}
                      onClick={() => {
                        assignTable.mutate({
                          tableId: table.id,
                          floorId: activeFloorId!,
                          x: 50,
                          y: 50,
                        });
                      }}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                    >
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                      {table.label}
                      <span className="text-[10px] text-muted-foreground">({table.capacity})</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editMode && unassignedTables.length === 0 && tablesOnFloor.length === 0 && (
              <div className="mt-6 text-center py-8 bg-secondary/30 rounded-xl">
                <p className="text-sm text-muted-foreground">No tables available. Create tables in Table Management first.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
