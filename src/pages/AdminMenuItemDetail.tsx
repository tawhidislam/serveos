import { useParams, useNavigate } from 'react-router-dom';
import { uploadWithProgress } from '@/lib/storage-upload';
import UploadProgress from '@/components/upload/UploadProgress';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import AdminLayout from '@/components/admin/AdminLayout';
import AddonManager from '@/components/admin/AddonManager';
import ImageCropDialog from '@/components/admin/ImageCropDialog';
import MenuItemTagAssigner from '@/components/customization/MenuItemTagAssigner';
import ImageGalleryManager from '@/components/menu/ImageGalleryManager';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  ArrowLeft, Pencil, Save, X, Upload, Loader2,
  ChefHat, Eye, ExternalLink, Trash2, Timer,
} from 'lucide-react';
import { useState, useRef } from 'react';
import { toast } from 'sonner';
import { invalidateSitemap } from '@/lib/sitemapInvalidate';

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

export default function AdminMenuItemDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { format: fmt } = useCurrency();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', category_id: '', image_url: '' as string | null, prep_time_minutes: '', custom_slug: '' });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ['admin_menu_item', restaurantId ?? 'none', itemId],
    queryFn: async () => {
      const { data, error } = await supabase.from('menu_items').select('*').eq('id', itemId!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('restaurant_id', restaurantId!).order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['admin_item_tags', itemId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_tags')
        .select('tag_id, customization_tags(name, emoji, color)')
        .eq('menu_item_id', itemId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!itemId,
  });

  const categoryName = categories.find(c => c.id === item?.category_id)?.name ?? '—';

  const startEditing = () => {
    if (!item) return;
    setForm({
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      category_id: item.category_id,
      image_url: item.image_url,
      prep_time_minutes: item.prep_time_minutes != null ? String(item.prep_time_minutes) : '',
      custom_slug: (item as any).custom_slug ?? '',
    });
    setImagePreview(item.image_url || null);
    setImageFile(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setImageFile(null);
    setImagePreview(null);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!validateImageFile(file, 'image')) { if (fileInputRef.current) fileInputRef.current.value = ''; return; }
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = (blob: Blob) => {
    const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' });
    setImageFile(file);
    setImagePreview(URL.createObjectURL(blob));
    setCropSrc(null);
  };

  const saveChanges = useMutation({
    mutationFn: async () => {
      if (!form.name.trim() || !form.price || !form.category_id) throw new Error('Fill in name, price, category');
      const slug = form.custom_slug.trim().toLowerCase();
      if (slug && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
        throw new Error('Slug may only contain lowercase letters, numbers and hyphens');
      }
      setSaving(true);
      let imageUrl = form.image_url;
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

      const { error } = await supabase.from('menu_items').update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price),
        category_id: form.category_id,
        image_url: imageUrl || null,
        prep_time_minutes: form.prep_time_minutes ? parseInt(form.prep_time_minutes) : null,
        custom_slug: slug || null,
      } as any).eq('id', itemId!);
      if (error) throw error;
    },
    onSuccess: async () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ['admin_menu_item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success('Item updated');

      // Slug changes affect the public sitemap — bust the edge cache so the
      // next crawl picks up the new URL immediately. Show feedback toast.
      toast.promise(invalidateSitemap(), {
        loading: 'Refreshing sitemap cache...',
        success: 'Sitemap cache refreshed — new URLs will be picked up by crawlers',
        error: (err: any) => `Sitemap refresh failed: ${err?.message || String(err)}`,
      });
    },
    onError: (err: any) => toast.error(err.message),
    onSettled: () => setSaving(false),
  });

  const toggleAvailability = useMutation({
    mutationFn: async (available: boolean) => {
      const { error } = await supabase.from('menu_items').update({ is_available: available }).eq('id', itemId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin_menu_item', itemId] });
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
    },
  });

  const deleteItem = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('menu_items').delete().eq('id', itemId!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menu_items_all'] });
      toast.success('Item deleted');
      navigate('/admin/menu');
    },
    onError: (err: any) => toast.error(err.message),
  });



  if (isLoading) {
    return (
      <AdminLayout title="Menu Item" subtitle="Loading...">
        <div className="flex items-center justify-center p-20">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!item) {
    return (
      <AdminLayout title="Menu Item" subtitle="Not found">
        <div className="flex flex-col items-center justify-center p-20">
          <ChefHat className="h-12 w-12 text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">Item not found</p>
          <Button variant="link" onClick={() => navigate('/admin/menu')} className="mt-2">Back to Menu</Button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={item.name} subtitle={categoryName}>
      <div className="p-4 lg:p-6 max-w-5xl">
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate('/admin/menu')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Menu
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/menu/${(item as any).custom_slug || item.id}`, '_blank')}>
              <Eye className="h-4 w-4 mr-1" /> Preview
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            {!editing && (
              <Button size="sm" onClick={startEditing}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          {/* Left: Image */}
          <div>
            <Card>
              <CardContent className="p-0 overflow-hidden rounded-lg">
                <div className="aspect-square relative">
                  {editing ? (
                    <>
                      {imagePreview ? (
                        <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-secondary">
                          <ChefHat className="h-16 w-16 text-muted-foreground/20" />
                        </div>
                      )}
                      <div className="absolute bottom-3 left-3 right-3 flex gap-2">
                        <input type="file" ref={fileInputRef} accept={ACCEPT_IMAGE_ATTR} onChange={handleFileSelect} className="hidden" />
                        <Button size="sm" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                          <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-secondary gap-3">
                          <ChefHat className="h-16 w-16 text-muted-foreground/20" />
                          <p className="text-xs text-muted-foreground">No image yet</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
            <UploadProgress
              className="mt-3"
              uploading={uploadingImage}
              progress={uploadProgress}
              error={uploadError}
              fileName={imageFile?.name}
              onRetry={() => saveChanges.mutate()}
            />
          </div>

          {/* Right: Details */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Details</CardTitle>
                  <div className="flex items-center gap-3">
                    <Label htmlFor="avail" className="text-sm text-muted-foreground">Available</Label>
                    <Switch
                      id="avail"
                      checked={item.is_available}
                      onCheckedChange={(v) => toggleAvailability.mutate(v)}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {editing ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Name</Label>
                      <Input value={form.name} onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div>
                      <Label>Description</Label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm(p => ({ ...p, description: e.target.value }))}
                        rows={3}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Price</Label>
                        <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm(p => ({ ...p, price: e.target.value }))} />
                      </div>
                      <div>
                        <Label>Category</Label>
                        <select
                          value={form.category_id}
                          onChange={(e) => setForm(p => ({ ...p, category_id: e.target.value }))}
                          className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                        >
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <Label>Prep Time (minutes)</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          placeholder="e.g. 15"
                          value={form.prep_time_minutes}
                          onChange={(e) => setForm(p => ({ ...p, prep_time_minutes: e.target.value }))}
                          className="w-32"
                        />
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Timer className="h-3.5 w-3.5" /> min
                        </span>
                      </div>
                    </div>
                    <div>
                      <Label>Custom URL slug <span className="text-xs text-muted-foreground font-normal">(optional)</span></Label>
                      <Input
                        placeholder="margherita-pizza"
                        value={form.custom_slug}
                        onChange={(e) => setForm(p => ({ ...p, custom_slug: e.target.value }))}
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Reachable at <code>/menu/{form.custom_slug || '<id>'}</code>. Lowercase letters, numbers, hyphens. The original URL keeps working.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button onClick={() => saveChanges.mutate()} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                        Save
                      </Button>
                      <Button variant="outline" onClick={cancelEditing}>
                        <X className="h-4 w-4 mr-1" /> Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Name</span>
                      <p className="font-medium text-foreground">{item.name}</p>
                    </div>
                    {item.description && (
                      <div>
                        <span className="text-sm text-muted-foreground">Description</span>
                        <p className="text-foreground">{item.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Price</span>
                        <p className="text-xl font-bold text-primary">{fmt(Number(item.price))}</p>
                      </div>
                      <div>
                        <span className="text-sm text-muted-foreground">Category</span>
                        <p className="font-medium text-foreground">{categoryName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-sm text-muted-foreground">Prep Time</span>
                        <p className="font-medium text-foreground flex items-center gap-1.5">
                          <Timer className="h-4 w-4 text-muted-foreground" />
                          {item.prep_time_minutes != null ? `${item.prep_time_minutes} min` : 'Not set'}
                        </p>
                      </div>
                    </div>
                    {tags.length > 0 && (
                      <div>
                        <span className="text-sm text-muted-foreground block mb-2">Tags</span>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map((t: any) => (
                            <Badge key={t.tag_id} variant="secondary" className="text-xs">
                              {t.customization_tags?.emoji} {t.customization_tags?.name}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tags Manager */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Customization Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <MenuItemTagAssigner menuItemId={item.id} />
              </CardContent>
            </Card>

            {/* Image Gallery */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Image Gallery</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageGalleryManager menuItemId={item.id} />
              </CardContent>
            </Card>

            {/* Addons Manager */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Add-ons & Options</CardTitle>
              </CardHeader>
              <CardContent>
                <AddonManager menuItemId={item.id} />
              </CardContent>
            </Card>

            {/* Danger zone */}
            <Card className="border-destructive/20">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-destructive">Delete Item</p>
                    <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => { if (confirm(`Delete "${item.name}"?`)) deleteItem.mutate(); }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Crop Dialog */}
      {cropSrc && (
        <ImageCropDialog
          open={!!cropSrc}
          imageSrc={cropSrc}
          onCropComplete={handleCropComplete}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </AdminLayout>
  );
}
