import { useState, useRef } from 'react';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { uploadWithProgress } from '@/lib/storage-upload';
import UploadProgress from '@/components/upload/UploadProgress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, Trash2, GripVertical, Loader2, Plus, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';
import ImageCropDialog from '@/components/admin/ImageCropDialog';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable, arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function getPublicUrl(path: string) {
  const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
  return data.publicUrl;
}

async function uploadImage(file: File, onProgress?: (p: number) => void): Promise<string> {
  const ext = file.name.split('.').pop();
  const path = `gallery/${crypto.randomUUID()}.${ext}`;
  const { publicUrl } = await uploadWithProgress({
    bucket: 'menu-images',
    path,
    file: await compressImage(file, COMPRESS_PRESETS.content),
    onProgress,
  });
  return publicUrl;
}

function SortableImageItem({ id, children }: { id: string; children: (props: any) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : undefined, position: 'relative' as const };
  return <>{children({ listeners, attributes, setNodeRef, style, isDragging })}</>;
}

interface Props {
  menuItemId: string;
}

export default function ImageGalleryManager({ menuItemId }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [failedBlobs, setFailedBlobs] = useState<Blob[]>([]);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [currentCropIndex, setCurrentCropIndex] = useState(0);
  const [croppedBlobs, setCroppedBlobs] = useState<Blob[]>([]);

  // RLS on menu_item_images requires restaurant_id = current_restaurant_id().
  // Fetch it from the parent menu_item so inserts succeed for the tenant admin.
  const { data: parentItem } = useQuery({
    queryKey: ['menu_item_restaurant', menuItemId],
    enabled: !!menuItemId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('restaurant_id')
        .eq('id', menuItemId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const restaurantId = (parentItem as any)?.restaurant_id ?? null;

  const { data: images = [], isLoading } = useQuery({
    queryKey: ['menu_item_images', menuItemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_images')
        .select('*')
        .eq('menu_item_id', menuItemId)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      if (validateImageFile(files[i], 'image')) {
        validFiles.push(files[i]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (validFiles.length === 0) return;

    setPendingFiles(validFiles);
    setCroppedBlobs([]);
    setCurrentCropIndex(0);
    setCropSrc(URL.createObjectURL(validFiles[0]));
  };

  const handleCropComplete = (blob: Blob) => {
    const nextBlobs = [...croppedBlobs, blob];
    setCroppedBlobs(nextBlobs);
    const nextIndex = currentCropIndex + 1;

    if (nextIndex < pendingFiles.length) {
      setCurrentCropIndex(nextIndex);
      setCropSrc(URL.createObjectURL(pendingFiles[nextIndex]));
    } else {
      setCropSrc(null);
      uploadCroppedImages(nextBlobs);
    }
  };

  const handleCropCancel = () => {
    setCropSrc(null);
    setPendingFiles([]);
    setCroppedBlobs([]);
  };

  const uploadCroppedImages = async (blobs: Blob[]) => {
    setUploading(true);
    setUploadError(null);
    setProgress(0);
    try {
      if (!restaurantId) throw new Error('Cannot resolve restaurant for this item');
      for (let i = 0; i < blobs.length; i++) {
        const file = new File([blobs[i]], `gallery-${Date.now()}-${i}.jpg`, { type: 'image/jpeg' });
        const url = await uploadImage(file, (p) =>
          setProgress(Math.round(((i + p / 100) / blobs.length) * 100)),
        );
        const { error } = await supabase.from('menu_item_images').insert({
          menu_item_id: menuItemId,
          image_url: url,
          sort_order: images.length + i,
          restaurant_id: restaurantId,
        });
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['menu_item_images', menuItemId] });
      toast.success(`${blobs.length} image(s) uploaded`);
      setFailedBlobs([]);
      setUploadError(null);
    } catch (err: any) {
      setFailedBlobs(blobs);
      setUploadError(err.message || 'Upload failed');
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
      setPendingFiles([]);
      setCroppedBlobs([]);
    }
  };

  const deleteImage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('menu_item_images').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_item_images', menuItemId] });
      toast.success('Image removed');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateCaption = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase.from('menu_item_images').update({ caption }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['menu_item_images', menuItemId] }),
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = images.findIndex(i => i.id === active.id);
    const newIndex = images.findIndex(i => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(images, oldIndex, newIndex);
    queryClient.setQueryData(['menu_item_images', menuItemId], reordered);

    const updates = reordered.map((img, i) =>
      supabase.from('menu_item_images').update({ sort_order: i }).eq('id', img.id)
    );
    await Promise.all(updates);
    queryClient.invalidateQueries({ queryKey: ['menu_item_images', menuItemId] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{images.length} image{images.length !== 1 ? 's' : ''}</p>
        <div>
          <input
            type="file"
            ref={fileInputRef}
            accept={ACCEPT_IMAGE_ATTR}
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
            Add Photos
          </Button>
        </div>
      </div>

      <UploadProgress
        uploading={uploading}
        progress={progress}
        error={uploadError}
        onRetry={() => failedBlobs.length && uploadCroppedImages(failedBlobs)}
      />

      {images.length === 0 && !isLoading && (
        <div className="border-2 border-dashed border-border rounded-xl p-8 text-center">
          <ImagePlus className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No gallery images yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Upload photos to create a gallery for this item</p>
        </div>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={images.map(i => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {images.map((img) => (
              <SortableImageItem key={img.id} id={img.id}>
                {({ listeners, attributes, setNodeRef, style, isDragging }: any) => (
                  <div
                    ref={setNodeRef}
                    style={style}
                    className={`flex items-center gap-3 bg-card rounded-lg border border-border p-2 ${isDragging ? 'opacity-50 shadow-lg' : ''}`}
                  >
                    <button
                      {...listeners}
                      {...attributes}
                      className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none shrink-0"
                    >
                      <GripVertical className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                    <img
                      src={img.image_url}
                      alt={img.caption || ''}
                      className="w-16 h-16 rounded-md object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <Input
                        placeholder="Add caption..."
                        defaultValue={img.caption || ''}
                        onBlur={(e) => {
                          if (e.target.value !== (img.caption || '')) {
                            updateCaption.mutate({ id: img.id, caption: e.target.value });
                          }
                        }}
                        className="h-8 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => deleteImage.mutate(img.id)}
                      className="p-2 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  </div>
                )}
              </SortableImageItem>
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
