import { useState, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings } from '@/hooks/useSettings';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, QrCode, Download, Pencil, X, Check, Palette, Wallet, Upload, Loader2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { motion, AnimatePresence } from 'framer-motion';
import { buildQRFrame, QR_TEMPLATES, type QRTemplateId, type QRTemplateColors } from '@/lib/qr-templates';
import { ORDER_PAGE_TEMPLATES, type OrderPageTemplateId } from '@/components/table-order/layouts/types';
import QrShortLinksCard from '@/components/admin/QrShortLinksCard';
import { uploadWithProgress } from '@/lib/storage-upload';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';


const statusColors: Record<string, string> = {
  available: 'bg-success/10 text-success',
  occupied: 'bg-warning/10 text-warning',
  reserved: 'bg-primary/10 text-primary',
  maintenance: 'bg-destructive/10 text-destructive',
};

/** Tiny wireframe preview of each ordering-page layout. */
function OrderTemplateThumb({ id }: { id: OrderPageTemplateId }) {
  const bar = 'rounded bg-muted-foreground/25';
  return (
    <div className="h-20 rounded-md bg-secondary/60 border border-border/60 p-2 overflow-hidden">
      {id === 'classic' && (
        <div className="flex flex-col gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex gap-1.5 items-center">
              <div className={`${bar} h-5 w-5`} />
              <div className="flex-1 space-y-1">
                <div className={`${bar} h-1.5 w-3/4`} />
                <div className={`${bar} h-1.5 w-1/2`} />
              </div>
            </div>
          ))}
        </div>
      )}
      {id === 'gallery' && (
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="space-y-1">
              <div className={`${bar} h-5 w-full`} />
              <div className={`${bar} h-1.5 w-2/3`} />
            </div>
          ))}
        </div>
      )}
      {id === 'compact' && (
        <div className="space-y-1.5">
          {[0, 1, 2, 3, 4].map(i => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={`${bar} h-1.5 flex-1`} />
              <div className={`${bar} h-1.5 w-4`} />
            </div>
          ))}
        </div>
      )}
      {id === 'showcase' && (
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1/3 space-y-1">
              <div className={`${bar} h-10 w-full`} />
              <div className={`${bar} h-1.5 w-3/4`} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Live preview of the branded QR frame */
function QRFramePreview({ tableId, tableLabel, template, colors, settings, menuUrl }: {
  tableId: string;
  tableLabel: string;
  template: QRTemplateId;
  colors: QRTemplateColors;
  settings: any;
  menuUrl: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Wait for the hidden QR SVG to mount
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, [tableId]);

  useEffect(() => {
    if (!ready) return;
    const el = document.getElementById(`qr-${tableId}`);
    if (!el || !containerRef.current) return;

    const svg = buildQRFrame(
      template,
      el as unknown as SVGElement,
      tableLabel,
      settings?.restaurant_name || 'Our Restaurant',
      settings?.tagline || null,
      { primary: settings?.primary_color || '#e87c1e', accent: settings?.accent_color || '#c8a855' },
      colors
    );

    // Scale down for preview
    const w = parseInt(svg.getAttribute('width') || '480');
    const h = parseInt(svg.getAttribute('height') || '620');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(svg);
  }, [ready, tableId, tableLabel, template, colors, settings, menuUrl]);

  return (
    <div className="mb-4 flex justify-center">
      <div
        ref={containerRef}
        className="w-full max-w-[280px] rounded-lg overflow-hidden border border-border bg-background"
        style={{ minHeight: 360 }}
      />
    </div>
  );
}

export default function TableManagement() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: settings } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [newTable, setNewTable] = useState({ label: '', capacity: '4' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ label: '', capacity: '' });
  const [qrModalId, setQrModalId] = useState<string | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [orderTemplate, setOrderTemplate] = useState<OrderPageTemplateId>(
    (settings?.order_page_template as OrderPageTemplateId) || 'classic'
  );

  // Settings load async — sync the picker once the saved value arrives.
  useEffect(() => {
    if (settings?.order_page_template) {
      setOrderTemplate(settings.order_page_template as OrderPageTemplateId);
    }
  }, [settings?.order_page_template]);

  const saveOrderTemplate = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error('Settings not loaded yet');
      const { error } = await supabase
        .from('restaurant_settings')
        .update({ order_page_template: orderTemplate })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
      toast.success('Ordering page layout saved');
    },
    onError: (err: any) => toast.error(err.message),
  });

  // ── QR menu branding (logo / color / header text) ──────────────
  const brandFileRef = useRef<HTMLInputElement | null>(null);
  const [uploadingBrandLogo, setUploadingBrandLogo] = useState(false);
  const [brand, setBrand] = useState({
    logo: '',
    color: '',
    header: '',
    subtext: '',
  });

  useEffect(() => {
    if (!settings) return;
    setBrand({
      logo: settings.order_page_logo_url ?? '',
      color: settings.order_page_primary_color ?? '',
      header: settings.order_page_header_text ?? '',
      subtext: settings.order_page_subtext ?? '',
    });
  }, [
    settings?.order_page_logo_url,
    settings?.order_page_primary_color,
    settings?.order_page_header_text,
    settings?.order_page_subtext,
  ]);

  const brandDirty =
    brand.logo !== (settings?.order_page_logo_url ?? '') ||
    brand.color !== (settings?.order_page_primary_color ?? '') ||
    brand.header !== (settings?.order_page_header_text ?? '') ||
    brand.subtext !== (settings?.order_page_subtext ?? '');

  const handleBrandLogo = async (file: File | null | undefined) => {
    if (!file || !restaurantId) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Logo must be an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Logo must be 5MB or smaller.');
      return;
    }
    setUploadingBrandLogo(true);
    try {
      const ext = (file.name.split('.').pop() || 'png').toLowerCase();
      const path = `qr-branding/${restaurantId}/logo-${Date.now()}.${ext}`;
      const pub = await uploadWithProgress({
        bucket: 'website-images',
        path,
        file: await compressImage(file, COMPRESS_PRESETS.avatar),
        contentType: file.type || 'image/png',
      });
      setBrand(p => ({ ...p, logo: pub.publicUrl }));
      toast.success('Logo uploaded — save to apply');
    } catch (err: any) {
      toast.error(err.message ?? 'Upload failed');
    } finally {
      setUploadingBrandLogo(false);
      if (brandFileRef.current) brandFileRef.current.value = '';
    }
  };

  const saveBranding = useMutation({
    mutationFn: async () => {
      if (!settings?.id) throw new Error('Settings not loaded yet');
      const { error } = await supabase
        .from('restaurant_settings')
        .update({
          order_page_logo_url: brand.logo.trim() || null,
          order_page_primary_color: brand.color.trim() || null,
          order_page_header_text: brand.header.trim() || null,
          order_page_subtext: brand.subtext.trim() || null,
        })
        .eq('id', settings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
      queryClient.invalidateQueries({ queryKey: ['table_order_settings'] });
      toast.success('QR menu branding saved');
    },
    onError: (err: any) => toast.error(err.message),
  });


  const [localTemplate, setLocalTemplate] = useState<QRTemplateId>((settings?.qr_template as QRTemplateId) || 'classic');
  const [localColors, setLocalColors] = useState<QRTemplateColors>(
    (settings?.qr_color_overrides as QRTemplateColors) || {}
  );

  const { data: tables = [] } = useQuery({
    queryKey: ['tables', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('label');
      if (error) throw error;
      return data;
    },
  });

  // Fetch unpaid orders grouped by table
  const { data: unpaidByTable = {} } = useQuery<Record<string, number>>({
    queryKey: ['unpaid_orders_by_table', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('table_id')
        .eq('restaurant_id', restaurantId!)
        .is('paid_at', null)
        .not('table_id', 'is', null)
        .neq('status', 'cancelled');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(o => {
        if (o.table_id) counts[o.table_id] = (counts[o.table_id] || 0) + 1;
      });
      return counts;
    },
    refetchInterval: 15_000,
  });

  const addTable = useMutation({
    mutationFn: async () => {
      if (!newTable.label.trim()) return;
      const { error } = await supabase.from('restaurant_tables').insert({
        label: newTable.label.trim(),
        capacity: parseInt(newTable.capacity) || 4,
        restaurant_id: restaurantId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewTable({ label: '', capacity: '4' });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Table added');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateTable = useMutation({
    mutationFn: async ({ id, label, capacity }: { id: string; label: string; capacity: number }) => {
      const { error } = await supabase.from('restaurant_tables').update({ label, capacity }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Table updated');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('restaurant_tables').update({ status }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tables'] }),
  });

  const deleteTable = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('restaurant_tables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      toast.success('Table deleted');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const getMenuUrl = (tableId: string) => {
    return `${window.location.origin}/table/${tableId}`;
  };

  // ── QR-ready public link (always reflects the saved layout) ─────
  const savedTemplate = (settings?.order_page_template as OrderPageTemplateId) || 'classic';
  const templateUnsaved = orderTemplate !== savedTemplate;
  const savedTemplateName =
    ORDER_PAGE_TEMPLATES.find(t => t.id === savedTemplate)?.name || 'Classic list';
  const publicOrderLink = tables[0]
    ? getMenuUrl(tables[0].id)
    : `${window.location.origin}/table/<table-id>`;
  const [linkCopied, setLinkCopied] = useState(false);

  const copyPublicLink = async () => {
    try {
      await navigator.clipboard.writeText(publicOrderLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast.success(`Link copied — opens with the ${savedTemplateName} layout`);
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const downloadPublicLinks = () => {
    if (!tables.length) return;
    const rows = [
      ['Table', 'Capacity', 'Layout', 'QR link'],
      ...tables.map((t: any) => [t.label, String(t.capacity ?? ''), savedTemplateName, getMenuUrl(t.id)]),
    ];
    const csv = rows
      .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const link = document.createElement('a');
    link.download = `qr-links-${savedTemplate}.csv`;
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success('QR links downloaded');
  };



  const startEdit = (table: any) => {
    setEditingId(table.id);
    setEditForm({ label: table.label, capacity: String(table.capacity) });
  };

  const saveEdit = (id: string) => {
    if (!editForm.label.trim()) return;
    updateTable.mutate({ id, label: editForm.label.trim(), capacity: parseInt(editForm.capacity) || 4 });
  };

  const downloadQR = useCallback((tableId: string, tableLabel: string, format: 'svg' | 'png' = 'svg') => {
    const svgElement = document.getElementById(`qr-${tableId}`);
    if (!svgElement) return;

    const slug = tableLabel.replace(/\s+/g, '-').toLowerCase();
    const brandedSVG = buildQRFrame(
      localTemplate,
      svgElement as unknown as SVGElement,
      tableLabel,
      settings?.restaurant_name || 'Our Restaurant',
      settings?.tagline || null,
      { primary: settings?.primary_color || '#e87c1e', accent: settings?.accent_color || '#c8a855' },
      localColors
    );

    if (format === 'svg') {
      const svgBlob = new Blob([new XMLSerializer().serializeToString(brandedSVG)], { type: 'image/svg+xml' });
      const link = document.createElement('a');
      link.download = `qr-${slug}.svg`;
      link.href = URL.createObjectURL(svgBlob);
      link.click();
      URL.revokeObjectURL(link.href);
      toast.success('Branded SVG downloaded!');
      return;
    }

    const svgData = new XMLSerializer().serializeToString(brandedSVG);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    const scale = 4;

    img.onload = () => {
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const link = document.createElement('a');
      link.download = `qr-${slug}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('Branded PNG downloaded!');
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  }, [localTemplate, localColors, settings]);

  const saveTemplateSettings = useCallback(async () => {
    if (!settings?.id) return;
    const { error } = await supabase
      .from('restaurant_settings')
      .update({ qr_template: localTemplate, qr_color_overrides: localColors as any })
      .eq('id', settings.id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
    toast.success('QR template saved as default!');
  }, [localTemplate, localColors, settings, queryClient]);

  const qrTable = tables.find(t => t.id === qrModalId);

  return (
    <AdminLayout title="Table Management" subtitle={`${tables.length} table${tables.length !== 1 ? 's' : ''}`}>
      <div className="p-4 lg:p-6 max-w-4xl">

        {/* Add table */}
        <div className="bg-card card-shadow ring-subtle rounded-lg p-4 mb-6">
          <h2 className="label-ui mb-3">Add New Table</h2>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[9rem]">

              <Label className="text-sm text-muted-foreground">Name</Label>
              <Input
                value={newTable.label}
                onChange={(e) => setNewTable(p => ({ ...p, label: e.target.value }))}
                placeholder="e.g., Table 1, Patio A"
                onKeyDown={(e) => e.key === 'Enter' && addTable.mutate()}
              />
            </div>
            <div className="w-24">
              <Label className="text-sm text-muted-foreground">Seats</Label>
              <Input
                value={newTable.capacity}
                onChange={(e) => setNewTable(p => ({ ...p, capacity: e.target.value }))}
                type="number"
                min="1"
              />
            </div>
            <Button onClick={() => addTable.mutate()} className="gap-1.5 shrink-0">
              <Plus className="h-4 w-4" /> Add Table
            </Button>
          </div>
        </div>

        {/* Ordering page layout */}
        <div className="bg-card card-shadow ring-subtle rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="label-ui">Ordering Page Layout</h2>
              <p className="text-sm text-muted-foreground mt-1">
                How the menu looks to diners after they scan a table QR code.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {tables[0] && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(`/table/${tables[0].id}?_order_template=${orderTemplate}`, '_blank')
                  }
                >
                  Preview
                </Button>
              )}
              <Button
                size="sm"
                disabled={orderTemplate === (settings?.order_page_template || 'classic')}
                onClick={() => saveOrderTemplate.mutate()}
              >
                Save layout
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ORDER_PAGE_TEMPLATES.map(t => {
              const active = orderTemplate === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setOrderTemplate(t.id)}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                      : 'border-border hover:border-primary/50 hover:bg-secondary/50'
                  }`}
                >
                  <OrderTemplateThumb id={t.id} />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-foreground">{t.name}</span>
                    {active && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{t.description}</p>
                </button>
              );
            })}
          </div>

          {/* QR-ready public link */}
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">QR-ready public link</p>
                <p className="text-xs text-muted-foreground">
                  {savedTemplateName} layout · {tables.length} table{tables.length === 1 ? '' : 's'}
                  {templateUnsaved && ' · save the layout to apply your new selection'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={copyPublicLink}>
                  {linkCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {linkCopied ? 'Copied' : 'Copy link'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={!tables.length}
                  onClick={downloadPublicLinks}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download links
                </Button>
              </div>
            </div>
            <code className="block text-xs text-muted-foreground break-all bg-background rounded-md border border-border/60 px-2 py-1.5">
              {publicOrderLink}
            </code>
          </div>
        </div>



        <QrShortLinksCard restaurantId={restaurantId} tables={tables as any} />

        {/* QR menu branding */}
        <div className="bg-card card-shadow ring-subtle rounded-lg p-4 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="label-ui">QR Menu Branding</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Logo, accent color and header text applied to the selected ordering layout.
              </p>
            </div>
            <Button size="sm" disabled={!brandDirty || saveBranding.isPending} onClick={() => saveBranding.mutate()}>
              {saveBranding.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save branding'}
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Logo */}
            <div className="space-y-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl overflow-hidden bg-secondary border border-border shrink-0 flex items-center justify-center">
                  {brand.logo ? (
                    <img src={brand.logo} alt="QR menu logo" className="h-full w-full object-cover" />
                  ) : (
                    <QrCode className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <input
                  ref={brandFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleBrandLogo(e.target.files?.[0])}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  disabled={uploadingBrandLogo}
                  onClick={() => brandFileRef.current?.click()}
                >
                  {uploadingBrandLogo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </Button>
                {brand.logo && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBrand(p => ({ ...p, logo: '' }))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Falls back to your restaurant logo when empty.</p>
            </div>

            {/* Primary color */}
            <div className="space-y-2">
              <Label htmlFor="qr-brand-color">Primary color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="qr-brand-color"
                  type="color"
                  value={brand.color || settings?.primary_color || '#e87c1e'}
                  onChange={(e) => setBrand(p => ({ ...p, color: e.target.value }))}
                  className="h-10 w-12 rounded-md border border-border bg-background cursor-pointer"
                  aria-label="QR menu primary color"
                />
                <Input
                  value={brand.color}
                  onChange={(e) => setBrand(p => ({ ...p, color: e.target.value }))}
                  placeholder={settings?.primary_color || '#e87c1e'}
                />
                {brand.color && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setBrand(p => ({ ...p, color: '' }))}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Used for buttons, badges and active states.</p>
            </div>

            {/* Header text */}
            <div className="space-y-2">
              <Label htmlFor="qr-brand-header">Header text</Label>
              <Input
                id="qr-brand-header"
                value={brand.header}
                maxLength={60}
                onChange={(e) => setBrand(p => ({ ...p, header: e.target.value }))}
                placeholder={settings?.restaurant_name || 'My Restaurant'}
              />
              <Input
                value={brand.subtext}
                maxLength={80}
                onChange={(e) => setBrand(p => ({ ...p, subtext: e.target.value }))}
                placeholder="Optional welcome line (e.g. Scan. Order. Enjoy.)"
              />
            </div>
          </div>
        </div>





        {/* Tables grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {tables.map(table => (
            <motion.div
              key={table.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-card card-shadow ring-subtle rounded-lg overflow-hidden"
            >
              <div className="p-4">
                {/* Header: name + status */}
                {editingId === table.id ? (
                  <div className="space-y-2 mb-3">
                    <Input
                      value={editForm.label}
                      onChange={(e) => setEditForm(p => ({ ...p, label: e.target.value }))}
                      placeholder="Table name"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && saveEdit(table.id)}
                    />
                    <div className="flex gap-2">
                      <Input
                        value={editForm.capacity}
                        onChange={(e) => setEditForm(p => ({ ...p, capacity: e.target.value }))}
                        type="number"
                        min="1"
                        placeholder="Seats"
                        className="w-20"
                      />
                      <Button size="sm" onClick={() => saveEdit(table.id)} className="gap-1">
                        <Check className="h-3.5 w-3.5" /> Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-card-foreground">{table.label}</h3>
                      <p className="text-sm text-muted-foreground">{table.capacity} seats</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(unpaidByTable[table.id] ?? 0) > 0 && (
                        <button
                          onClick={() => navigate(`/admin/orders?filter=unpaid&table_label=${encodeURIComponent(table.label)}`)}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-warning/10 text-warning hover:bg-warning/20 transition-colors cursor-pointer"
                          title="View unpaid orders for this table"
                        >
                          <Wallet className="h-3 w-3" strokeWidth={2} />
                          {unpaidByTable[table.id]} unpaid
                        </button>
                      )}
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${statusColors[table.status] ?? 'bg-secondary text-secondary-foreground'}`}>
                        {table.status}
                      </span>
                    </div>
                  </div>
                )}

                {/* Status controls */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {['available', 'occupied', 'reserved', 'maintenance'].map(status => (
                    <button
                      key={status}
                      onClick={() => updateStatus.mutate({ id: table.id, status })}
                      className={`text-xs px-2 py-1 rounded-full transition-colors capitalize ${
                        table.status === status
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Actions footer */}
              <div className="flex items-center border-t border-border divide-x divide-border">
                <button
                  onClick={() => setQrModalId(table.id)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <QrCode className="h-4 w-4" strokeWidth={1.5} />
                  QR Code
                </button>
                <button
                  onClick={() => startEdit(table)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                >
                  <Pencil className="h-4 w-4" strokeWidth={1.5} />
                  Edit
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Delete "${table.label}"?`)) {
                      deleteTable.mutate(table.id);
                    }
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                  Delete
                </button>
              </div>
            </motion.div>
          ))}
        </div>

        {tables.length === 0 && (
          <div className="text-center py-16">
            <QrCode className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" strokeWidth={1} />
            <p className="text-muted-foreground">No tables yet. Add your first table above.</p>
          </div>
        )}
      </div>

      {/* QR Code Modal */}
      {qrModalId && qrTable && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-[100]"
            onClick={() => setQrModalId(null)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="w-full max-w-md bg-card card-shadow rounded-xl p-4 sm:p-6 pointer-events-auto max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-card-foreground">{qrTable.label}</h2>
                  <p className="text-sm text-muted-foreground">Scan to view menu</p>
                </div>
                <button onClick={() => setQrModalId(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="h-5 w-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Template Selector */}
              <div className="mb-4">
                <p className="label-ui mb-2">Template</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {QR_TEMPLATES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setLocalTemplate(t.id)}
                      className={`text-xs py-2 px-1 rounded-lg border transition-all text-center ${
                        localTemplate === t.id
                          ? 'border-primary bg-primary/10 text-primary font-semibold'
                          : 'border-border bg-secondary/50 text-muted-foreground hover:border-primary/40'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Overrides Toggle */}
              <div className="mb-4">
                <button
                  onClick={() => setShowColorPicker(!showColorPicker)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Palette className="h-4 w-4" strokeWidth={1.5} />
                  {showColorPicker ? 'Hide' : 'Customize'} colors
                </button>
                <AnimatePresence>
                  {showColorPicker && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-3 mt-3">
                        {([
                          ['border', 'Border'],
                          ['accent', 'Accent'],
                          ['text', 'Text'],
                          ['background', 'Background'],
                        ] as const).map(([key, label]) => (
                          <div key={key}>
                            <Label className="text-xs text-muted-foreground">{label}</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="color"
                                value={localColors[key] || (key === 'border' ? settings?.primary_color : key === 'accent' ? settings?.accent_color : key === 'text' ? '#0f172a' : '#ffffff') || '#000000'}
                                onChange={(e) => setLocalColors(prev => ({ ...prev, [key]: e.target.value }))}
                                className="w-8 h-8 rounded border border-border cursor-pointer"
                              />
                              <Input
                                value={localColors[key] || ''}
                                onChange={(e) => setLocalColors(prev => ({ ...prev, [key]: e.target.value }))}
                                placeholder="Default"
                                className="h-8 text-xs"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => setLocalColors({})}>
                          Reset
                        </Button>
                        <Button size="sm" onClick={saveTemplateSettings}>
                          Save as Default
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Hidden QR for cloning */}
              <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
                <QRCodeSVG
                  id={`qr-${qrTable.id}`}
                  value={getMenuUrl(qrTable.id)}
                  size={200}
                  level="H"
                  includeMargin={false}
                  bgColor="transparent"
                  fgColor="#0f172a"
                />
              </div>

              {/* Live Frame Preview */}
              <QRFramePreview
                tableId={qrTable.id}
                tableLabel={qrTable.label}
                template={localTemplate}
                colors={localColors}
                settings={settings}
                menuUrl={getMenuUrl(qrTable.id)}
              />

              {/* URL */}
              <div className="mb-4">
                <p className="label-ui mb-1">Menu URL</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-secondary rounded-md px-3 py-2 text-secondary-foreground truncate">
                    {getMenuUrl(qrTable.id)}
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(getMenuUrl(qrTable.id));
                      toast.success('URL copied!');
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              {/* Download buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={() => downloadQR(qrTable.id, qrTable.label, 'svg')}
                  className="flex-1 gap-2"
                  size="lg"
                >
                  <Download className="h-4 w-4" strokeWidth={1.5} />
                  SVG (Print)
                </Button>
                <Button
                  onClick={() => downloadQR(qrTable.id, qrTable.label, 'png')}
                  className="flex-1 gap-2"
                  size="lg"
                  variant="outline"
                >
                  <Download className="h-4 w-4" strokeWidth={1.5} />
                  PNG (High-Res)
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
