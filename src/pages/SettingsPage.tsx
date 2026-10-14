import { useState, useEffect } from 'react';
import { compressImage, COMPRESS_PRESETS } from '@/lib/image-compress';
import { useImageUpload } from '@/hooks/useImageUpload';
import UploadProgress from '@/components/upload/UploadProgress';
import { validateImageFile, ACCEPT_IMAGE_ATTR } from '@/lib/upload-limits';
import AdminLayout from '@/components/admin/AdminLayout';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSettings, type RestaurantSettings } from '@/hooks/useSettings';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { useFeatureAccess } from '@/hooks/usePlan';
import CustomDomainCard from '@/components/platform/CustomDomainCard';
import RequestCustomDomainCard from '@/components/platform/RequestCustomDomainCard';
import CustomDomainSetupGuide from '@/components/platform/CustomDomainSetupGuide';
import { BookOpen } from 'lucide-react';
import PageUrlsSection from '@/components/admin/PageUrlsSection';
import {
  validatePhoneInput,
  validateAddressInput,
  normalizePhoneInput,
  normalizeAddressInput,
  formatPhoneDisplay,
} from '@/lib/contact-info';
import {
  SOUND_PRESETS,
  SOUND_EVENTS,
  playSoundPreset,
  getStoredSoundPreset,
  setStoredSoundPreset,
  getStoredVolume,
  setStoredVolume,
  getEventSoundPreset,
  setEventSoundPreset,
  type SoundPreset,
  type SoundEvent,
} from '@/hooks/useNotifications';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Settings, Store, Percent, Globe, QrCode,
  Save, ImagePlus, Loader2, Check, Bell, Palette, Type,
  Volume2, Play, ShieldAlert, RotateCcw, Bike,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const currencies = [
  { code: 'USD', symbol: '$', label: 'US Dollar' },
  { code: 'EUR', symbol: '€', label: 'Euro' },
  { code: 'GBP', symbol: '£', label: 'British Pound' },
  { code: 'JPY', symbol: '¥', label: 'Japanese Yen' },
  { code: 'CAD', symbol: 'CA$', label: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'A$', label: 'Australian Dollar' },
  { code: 'INR', symbol: '₹', label: 'Indian Rupee' },
  { code: 'BRL', symbol: 'R$', label: 'Brazilian Real' },
  { code: 'MXN', symbol: 'MX$', label: 'Mexican Peso' },
  { code: 'AED', symbol: 'د.إ', label: 'UAE Dirham' },
  { code: 'BDT', symbol: '৳', label: 'Bangladeshi Taka' },
];

function NotificationSoundSection() {
  const [volume, setVolume] = useState<number>(getStoredVolume);
  const [eventPresets, setEventPresets] = useState<Record<string, SoundPreset>>(() => {
    const map: Record<string, SoundPreset> = {};
    for (const e of SOUND_EVENTS) map[e.id] = getEventSoundPreset(e.id);
    return map;
  });

  const handleEventPresetChange = (event: SoundEvent, preset: SoundPreset) => {
    setEventPresets(prev => ({ ...prev, [event]: preset }));
    setEventSoundPreset(event, preset);
    playSoundPreset(preset);
  };

  const handleVolumeChange = (vals: number[]) => {
    const v = vals[0];
    setVolume(v);
    setStoredVolume(v);
  };

  return (
    <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold text-card-foreground">Notifications</h2>
      </div>

      <div className="space-y-4">
        {/* Per-event sound selectors */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-card-foreground">Alert Tones</p>
            <p className="text-xs text-muted-foreground">Choose a different sound for each event type</p>
          </div>

          <div className="grid gap-3">
            {SOUND_EVENTS.map(event => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-card-foreground">{event.label}</p>
                  <p className="text-xs text-muted-foreground">{event.description}</p>
                </div>
                <Select
                  value={eventPresets[event.id]}
                  onValueChange={(v) => handleEventPresetChange(event.id, v as SoundPreset)}
                >
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOUND_PRESETS.map(p => (
                      <SelectItem key={p.id} value={p.id} className="text-xs">{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="shrink-0 h-8 w-8 p-0"
                  onClick={() => playSoundPreset(eventPresets[event.id])}
                >
                  <Play className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Volume Slider */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Volume</p>
              <p className="text-xs text-muted-foreground">Adjust alert loudness ({Math.round(volume * 100)}%)</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => playSoundPreset(eventPresets['newOrder'] ?? 'classic')}
            >
              <Play className="h-3.5 w-3.5 mr-1" /> Test
            </Button>
          </div>
          <Slider
            value={[volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={1}
            step={0.05}
            className="w-full"
          />
        </div>

        {/* Browser Notifications */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Browser Notifications</p>
              <p className="text-xs text-muted-foreground">Desktop push notifications when the tab is in background</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if ('Notification' in window) {
                  Notification.requestPermission().then(p => {
                    if (p === 'granted') toast.success('Notifications enabled');
                    else toast.info('Notifications blocked by browser');
                  });
                }
              }}
            >
              Enable
            </Button>
          </div>
        </div>

        {/* SMS Coming Soon */}
        <div className="border-t border-border pt-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">SMS Notifications</p>
              <p className="text-xs text-muted-foreground">Send SMS alerts via Twilio when orders are ready</p>
            </div>
            <Badge variant="outline" className="text-xs">Coming Soon</Badge>
          </div>
        </div>
      </div>
    </section>
  );
}

// Defaults applied by a Reset action. Kept in sync with the column
// defaults defined on public.restaurant_settings so a reset matches the
// state of a freshly-provisioned tenant row.
const SETTINGS_DEFAULTS = {
  restaurant_name: 'My Restaurant',
  logo_url: null as string | null,
  tax_percentage: 10,
  currency: 'USD',
  qr_ordering_enabled: true,
  primary_color: '#e87c1e',
  accent_color: '#c8a855',
  tagline: null as string | null,
  contact_phone: null as string | null,
  address: null as string | null,
};

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { data: restaurant } = useCurrentRestaurant();
  const canCustomDomain = useFeatureAccess('customDomain');
  const qc = useQueryClient();

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [taxPct, setTaxPct] = useState(10);
  const [currency, setCurrency] = useState('USD');
  const [qrEnabled, setQrEnabled] = useState(true);
  const {
    upload: uploadLogo, retry: retryLogo, cancel: cancelLogo,
    uploading, progress: logoProgress, error: logoError, fileName: logoFileName,
  } = useImageUpload({
    bucket: 'website-images',
    buildPath: (f) => `logo/restaurant-logo.${f.name.split('.').pop()}`,
    upsert: true,
    limit: 'logo',
    compress: COMPRESS_PRESETS.avatar,
    onUploaded: (url) => setLogoUrl(url),
    successMessage: 'Logo uploaded',
  });
  const [primaryColor, setPrimaryColor] = useState('#e87c1e');
  const [accentColor, setAccentColor] = useState('#c8a855');
  const [tagline, setTagline] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');
  const [deliveryEnabled, setDeliveryEnabled] = useState(false);
  const [pickupEnabled, setPickupEnabled] = useState(false);
  const [deliveryFeeSetting, setDeliveryFeeSetting] = useState(0);
  const [freeDeliveryMin, setFreeDeliveryMin] = useState<string>('');
  const [deliveryMinOrder, setDeliveryMinOrder] = useState(0);
  const [deliveryEta, setDeliveryEta] = useState(45);
  const [pickupEta, setPickupEta] = useState(20);
  const [deliveryAreaNote, setDeliveryAreaNote] = useState('');

  useEffect(() => {
    if (settings) {
      setName(settings.restaurant_name);
      setLogoUrl(settings.logo_url ?? '');
      setTaxPct(settings.tax_percentage);
      setCurrency(settings.currency);
      setQrEnabled(settings.qr_ordering_enabled);
      setPrimaryColor(settings.primary_color || '#e87c1e');
      setAccentColor(settings.accent_color || '#c8a855');
      setTagline(settings.tagline || '');
      setContactPhone(settings.contact_phone || '');
      setAddress(settings.address || '');
      setDeliveryEnabled(!!settings.delivery_enabled);
      setPickupEnabled(!!settings.pickup_enabled);
      setDeliveryFeeSetting(Number(settings.delivery_fee ?? 0));
      setFreeDeliveryMin(settings.free_delivery_min != null ? String(settings.free_delivery_min) : '');
      setDeliveryMinOrder(Number(settings.delivery_min_order ?? 0));
      setDeliveryEta(Number(settings.delivery_eta_minutes ?? 45));
      setPickupEta(Number(settings.pickup_eta_minutes ?? 20));
      setDeliveryAreaNote(settings.delivery_area_note || '');
    }
  }, [settings]);

  // Contact field validation — bad phone/address values break `tel:` links,
  // Maps links and the Restaurant structured data, so block the save.
  const phoneError = validatePhoneInput(contactPhone);
  const addressError = validateAddressInput(address);
  const contactInvalid = !!(phoneError || addressError);

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (phoneError) throw new Error(phoneError);
      if (addressError) throw new Error(addressError);

      // ── Tenant guard ──────────────────────────────────────────────────
      // The active session restaurant is the only tenant we are allowed
      // to write for. RLS would also reject any other restaurant_id, but
      // we surface a clear error before the round-trip.
      const activeRestaurantId = restaurant?.id ?? null;
      if (!activeRestaurantId) {
        throw new Error('No active restaurant in this session. Please select one and try again.');
      }


      // If the loaded settings row points at a different tenant (e.g. the
      // user switched restaurants while this page was open and the cache
      // is stale), refuse to save and tell the caller to refresh.
      const loadedTenantId = settings?.restaurant_id ?? null;
      if (settings?.id && loadedTenantId && loadedTenantId !== activeRestaurantId) {
        throw new Error(
          'These settings belong to a different restaurant than your active session. Refresh the page and try again.',
        );
      }

      const payload = {
        restaurant_name: name.trim() || 'My Restaurant',
        logo_url: logoUrl.trim() || null,
        tax_percentage: taxPct,
        currency,
        qr_ordering_enabled: qrEnabled,
        primary_color: primaryColor,
        accent_color: accentColor,
        tagline: tagline.trim() || null,
        contact_phone: normalizePhoneInput(contactPhone) || null,
        address: normalizeAddressInput(address) || null,

        delivery_enabled: deliveryEnabled,
        pickup_enabled: pickupEnabled,
        delivery_fee: Math.max(0, Number(deliveryFeeSetting) || 0),
        free_delivery_min: freeDeliveryMin.trim() === '' ? null : Math.max(0, Number(freeDeliveryMin) || 0),
        delivery_min_order: Math.max(0, Number(deliveryMinOrder) || 0),
        delivery_eta_minutes: Math.max(1, Number(deliveryEta) || 45),
        pickup_eta_minutes: Math.max(1, Number(pickupEta) || 20),
        delivery_area_note: deliveryAreaNote.trim() || null,
      };

      if (settings?.id) {
        // UPDATE: re-assert restaurant_id in the WHERE clause so a row
        // belonging to another tenant can never be touched, even if the
        // row id were swapped client-side.
        const { data, error } = await supabase
          .from('restaurant_settings')
          .update(payload)
          .eq('id', settings.id)
          .eq('restaurant_id', activeRestaurantId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Save blocked: this settings row does not belong to your active restaurant.');
        }
      } else {
        // INSERT: force restaurant_id to the active session tenant so the
        // RLS WITH CHECK clause holds.
        const { error } = await supabase
          .from('restaurant_settings')
          .insert({ ...payload, restaurant_id: activeRestaurantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['restaurant_settings'] });
      toast.success('Settings saved');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Reset action ──────────────────────────────────────────────────────
  // Resets the settings row of the ACTIVE restaurant back to defaults.
  // The tenant guard mirrors saveSettings: we refuse to run unless the
  // active session restaurant matches the loaded row, and we re-assert
  // restaurant_id in the WHERE clause so a row that does not belong to
  // the active tenant can never be touched even if its primary key were
  // tampered with client-side.
  const resetSettings = useMutation({
    mutationFn: async () => {
      const activeRestaurantId = restaurant?.id ?? null;
      if (!activeRestaurantId) {
        throw new Error('No active restaurant in this session. Please select one and try again.');
      }

      const loadedTenantId = settings?.restaurant_id ?? null;
      if (settings?.id && loadedTenantId && loadedTenantId !== activeRestaurantId) {
        throw new Error(
          'These settings belong to a different restaurant than your active session. Refresh the page and try again.',
        );
      }

      if (settings?.id) {
        const { data, error } = await supabase
          .from('restaurant_settings')
          .update(SETTINGS_DEFAULTS)
          .eq('id', settings.id)
          .eq('restaurant_id', activeRestaurantId)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          throw new Error('Reset blocked: this settings row does not belong to your active restaurant.');
        }
      } else {
        // No row yet — provision one with defaults for the active tenant.
        const { error } = await supabase
          .from('restaurant_settings')
          .insert({ ...SETTINGS_DEFAULTS, restaurant_id: activeRestaurantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      // Sync local form state to defaults immediately so the UI reflects
      // the reset before the query refetch lands.
      setName(SETTINGS_DEFAULTS.restaurant_name);
      setLogoUrl(SETTINGS_DEFAULTS.logo_url ?? '');
      setTaxPct(SETTINGS_DEFAULTS.tax_percentage);
      setCurrency(SETTINGS_DEFAULTS.currency);
      setQrEnabled(SETTINGS_DEFAULTS.qr_ordering_enabled);
      setPrimaryColor(SETTINGS_DEFAULTS.primary_color);
      setAccentColor(SETTINGS_DEFAULTS.accent_color);
      setTagline(SETTINGS_DEFAULTS.tagline ?? '');
      setContactPhone(SETTINGS_DEFAULTS.contact_phone ?? '');
      setAddress(SETTINGS_DEFAULTS.address ?? '');
      qc.invalidateQueries({ queryKey: ['restaurant_settings'] });
      toast.success('Settings reset to defaults for this restaurant');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Derived guard state for the UI ─────────────────────────────────────
  // True when the settings row we have in memory belongs to a different
  // restaurant than the active session. We disable Save and show a banner.
  const tenantMismatch = Boolean(
    settings?.id &&
    settings.restaurant_id &&
    restaurant?.id &&
    settings.restaurant_id !== restaurant.id,
  );

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadLogo(file);
    e.target.value = '';
  };


  const hasChanges = settings && (
    name !== settings.restaurant_name ||
    (logoUrl || '') !== (settings.logo_url || '') ||
    taxPct !== settings.tax_percentage ||
    currency !== settings.currency ||
    qrEnabled !== settings.qr_ordering_enabled ||
    primaryColor !== (settings.primary_color || '#e87c1e') ||
    accentColor !== (settings.accent_color || '#c8a855') ||
    (tagline || '') !== (settings.tagline || '') ||
    (contactPhone || '') !== (settings.contact_phone || '') ||
    (address || '') !== (settings.address || '') ||
    deliveryEnabled !== !!settings.delivery_enabled ||
    pickupEnabled !== !!settings.pickup_enabled ||
    Number(deliveryFeeSetting) !== Number(settings.delivery_fee ?? 0) ||
    (freeDeliveryMin.trim() === '' ? null : Number(freeDeliveryMin)) !==
      (settings.free_delivery_min != null ? Number(settings.free_delivery_min) : null) ||
    Number(deliveryMinOrder) !== Number(settings.delivery_min_order ?? 0) ||
    Number(deliveryEta) !== Number(settings.delivery_eta_minutes ?? 45) ||
    Number(pickupEta) !== Number(settings.pickup_eta_minutes ?? 20) ||
    (deliveryAreaNote || '') !== (settings.delivery_area_note || '')
  );

  if (isLoading) {
    return (
      <AdminLayout title="Settings">
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Settings" subtitle="Restaurant configuration">
      <div className="p-4 lg:p-6 max-w-2xl space-y-6">
        {tenantMismatch && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-400"
          >
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <div className="space-y-1">
              <p className="font-medium">Tenant mismatch detected</p>
              <p className="text-xs opacity-90">
                These settings belong to a different restaurant than your active session
                (<span className="font-mono">{settings?.restaurant_id?.slice(0, 8)}…</span>{' '}
                vs <span className="font-mono">{restaurant?.id?.slice(0, 8)}…</span>).
                Saving has been disabled. Refresh the page to load the correct settings.
              </p>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  resetSettings.isPending ||
                  saveSettings.isPending ||
                  tenantMismatch ||
                  !restaurant?.id
                }
                className="gap-1.5"
              >
                {resetSettings.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
                )}
                Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset settings to defaults?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will reset the settings for{' '}
                  <span className="font-medium text-foreground">
                    {restaurant?.name ?? 'the active restaurant'}
                  </span>{' '}
                  back to their default values. This action only affects your
                  active restaurant and cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-3 text-sm">
                <div
                  className={
                    'rounded-md border p-3 ' +
                    (SETTINGS_DEFAULTS.qr_ordering_enabled
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                      : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400')
                  }
                >
                  <p className="flex items-center gap-2 font-medium">
                    <QrCode className="h-4 w-4" strokeWidth={2} />
                    QR ordering will be{' '}
                    {SETTINGS_DEFAULTS.qr_ordering_enabled ? 'ENABLED' : 'DISABLED'}
                  </p>
                  <p className="mt-1 text-xs opacity-90">
                    {SETTINGS_DEFAULTS.qr_ordering_enabled
                      ? 'Customers will be able to scan table QR codes and place orders.'
                      : 'Customers will not be able to place orders via table QR codes until you re-enable it.'}
                    {qrEnabled !== SETTINGS_DEFAULTS.qr_ordering_enabled && (
                      <>
                        {' '}
                        <span className="font-medium">
                          (Currently{' '}
                          {qrEnabled ? 'enabled' : 'disabled'} — this will change.)
                        </span>
                      </>
                    )}
                  </p>
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-medium text-foreground">
                    Menu &amp; order settings that will change
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>
                      <span className="text-foreground">Tax percentage</span> →{' '}
                      <span className="font-mono">
                        {SETTINGS_DEFAULTS.tax_percentage}%
                      </span>{' '}
                      (currently {taxPct}%) — applied to every new order total.
                    </li>
                    <li>
                      <span className="text-foreground">Currency</span> →{' '}
                      <span className="font-mono">{SETTINGS_DEFAULTS.currency}</span>{' '}
                      (currently {currency}) — changes how menu prices, cart, POS
                      and receipts are formatted.
                    </li>
                    <li>
                      <span className="text-foreground">QR ordering</span> →{' '}
                      <span className="font-mono">
                        {SETTINGS_DEFAULTS.qr_ordering_enabled ? 'on' : 'off'}
                      </span>{' '}
                      (currently {qrEnabled ? 'on' : 'off'}).
                    </li>
                  </ul>
                </div>

                <div className="rounded-md border border-border bg-muted/40 p-3">
                  <p className="font-medium text-foreground">
                    Branding &amp; identity that will change
                  </p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    <li>
                      Restaurant name →{' '}
                      <span className="font-mono">
                        {SETTINGS_DEFAULTS.restaurant_name}
                      </span>
                    </li>
                    <li>Logo will be cleared</li>
                    <li>Tagline will be cleared</li>
                    <li>
                      Primary color →{' '}
                      <span className="font-mono">
                        {SETTINGS_DEFAULTS.primary_color}
                      </span>
                    </li>
                    <li>
                      Accent color →{' '}
                      <span className="font-mono">
                        {SETTINGS_DEFAULTS.accent_color}
                      </span>
                    </li>
                  </ul>
                </div>

                <p className="text-xs text-muted-foreground">
                  Existing orders, menu items, tables and staff are <span className="font-medium text-foreground">not</span> affected.
                </p>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => resetSettings.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Reset settings
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button
            size="sm"
            disabled={!hasChanges || contactInvalid || saveSettings.isPending || tenantMismatch || !restaurant?.id}
            onClick={() => saveSettings.mutate()}
            className="gap-1.5"
          >
            {saveSettings.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" strokeWidth={1.5} />
            )}
            Save
          </Button>
        </div>
        {/* Restaurant Info */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Store className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Restaurant Info</h2>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm text-muted-foreground">Restaurant Name</Label>
            <Input
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="My Restaurant"
              maxLength={100}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact-phone" className="text-sm text-muted-foreground">Contact Phone</Label>
              <Input
                id="contact-phone"
                type="tel"
                inputMode="tel"
                value={contactPhone}
                onChange={e => setContactPhone(e.target.value)}
                onBlur={() => setContactPhone(v => normalizePhoneInput(v))}
                placeholder="+1 555 010 1234"
                maxLength={40}
                aria-invalid={!!phoneError}
                aria-describedby="contact-phone-help"
                className={phoneError ? 'border-destructive focus-visible:ring-destructive' : undefined}
              />
              <p
                id="contact-phone-help"
                className={`text-xs ${phoneError ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {phoneError
                  || (contactPhone.trim()
                    ? `Displays as ${formatPhoneDisplay(contactPhone)}`
                    : 'Digits, spaces and + ( ) - . only. Include the country code for international guests.')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address" className="text-sm text-muted-foreground">Address</Label>
              <Input
                id="address"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onBlur={() => setAddress(v => normalizeAddressInput(v))}
                placeholder="123 Main St, Springfield, IL 62704"
                maxLength={200}
                aria-invalid={!!addressError}
                aria-describedby="address-help"
                className={addressError ? 'border-destructive focus-visible:ring-destructive' : undefined}
              />
              <p
                id="address-help"
                className={`text-xs ${addressError ? 'text-destructive' : 'text-muted-foreground'}`}
              >
                {addressError || 'Separate street, city, region and country with commas for accurate SEO.'}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Shown on your public site and used in your homepage structured data (SEO), so search engines
            display the right phone number and location.
          </p>




          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Logo</Label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <div className="h-16 w-16 rounded-lg bg-secondary overflow-hidden flex items-center justify-center ring-subtle">
                  <img src={logoUrl} alt="Logo" className="h-full w-full object-contain" />
                </div>
              ) : (
                <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center ring-subtle">
                  <Store className="h-6 w-6 text-muted-foreground" strokeWidth={1} />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept={ACCEPT_IMAGE_ATTR}
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                    <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
                      {uploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" strokeWidth={1.5} />
                      )}
                      {uploading ? 'Uploading…' : 'Upload Logo'}
                    </div>
                  </label>
                  {logoUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => { setLogoUrl(''); toast.info('Logo removed — click Save to apply'); }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">PNG or JPG, max 2MB</p>
                <UploadProgress
                  className="mt-2"
                  uploading={uploading}
                  progress={logoProgress}
                  error={logoError}
                  fileName={logoFileName}
                  onCancel={cancelLogo}
                  onRetry={retryLogo}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Branding */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Palette className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Branding</h2>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Tagline</Label>
            <Input
              value={tagline}
              onChange={e => setTagline(e.target.value)}
              placeholder="e.g. Fine dining, redefined"
              maxLength={200}
            />
            <p className="text-xs text-muted-foreground">Displayed on your website hero and footer</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Primary Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="h-10 w-10 rounded-lg border border-border cursor-pointer shrink-0"
                />
                <Input
                  value={primaryColor}
                  onChange={e => setPrimaryColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#e87c1e"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">Buttons, links, and highlights</p>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Accent Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="h-10 w-10 rounded-lg border border-border cursor-pointer shrink-0"
                />
                <Input
                  value={accentColor}
                  onChange={e => setAccentColor(e.target.value)}
                  className="font-mono text-sm"
                  placeholder="#c8a855"
                  maxLength={7}
                />
              </div>
              <p className="text-xs text-muted-foreground">Gold accent on website and menus</p>
            </div>
          </div>

          {/* Live preview */}
          <div className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Live Preview</p>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: primaryColor }}>
                <Store className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-card-foreground">{name || 'My Restaurant'}</p>
                {tagline && <p className="text-xs" style={{ color: accentColor }}>{tagline}</p>}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>
                Primary Button
              </button>
              <button className="px-4 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: accentColor, color: accentColor }}>
                Accent Button
              </button>
            </div>
          </div>
        </section>

        {/* Tax & Currency */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Percent className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Tax & Currency</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tax" className="text-sm text-muted-foreground">Default Tax Rate (%)</Label>
              <div className="relative">
                <Input
                  id="tax"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={taxPct}
                  onChange={e => setTaxPct(Number(e.target.value) || 0)}
                  className="pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(c => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{c.symbol}</span>
                        {c.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* QR Ordering */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
                <QrCode className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">QR Code Ordering</p>
                <p className="text-xs text-muted-foreground">Allow customers to order by scanning table QR codes</p>
              </div>
            </div>
            <Switch
              checked={qrEnabled}
              onCheckedChange={setQrEnabled}
            />
          </div>
          {!qrEnabled && (
            <div className="mt-3 p-3 bg-warning/10 rounded-md">
              <p className="text-xs text-warning">
                QR ordering is disabled. Customers won't be able to place orders from their phones.
              </p>
            </div>
          )}
        </section>


        {/* Delivery & Pickup */}
        <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
          <div className="flex items-center gap-2">
            <Bike className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
            <h2 className="text-sm font-semibold text-card-foreground">Delivery &amp; Pickup</h2>
          </div>
          <p className="text-xs text-muted-foreground -mt-3">
            Let customers order from your menu page without a table QR. Orders are paid in cash on delivery or pickup.
          </p>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-card-foreground">Pickup orders</p>
              <p className="text-xs text-muted-foreground">Customers collect their order at your restaurant</p>
            </div>
            <Switch checked={pickupEnabled} onCheckedChange={setPickupEnabled} aria-label="Enable pickup orders" />
          </div>

          {pickupEnabled && (
            <div className="space-y-1.5">
              <Label className="text-xs">Pickup ready in (minutes)</Label>
              <Input
                type="number" min={1} max={480}
                value={pickupEta}
                onChange={e => setPickupEta(Number(e.target.value))}
              />
            </div>
          )}

          <div className="flex items-center justify-between border-t border-border pt-4">
            <div>
              <p className="text-sm font-medium text-card-foreground">Delivery orders</p>
              <p className="text-xs text-muted-foreground">Customers enter an address and you deliver</p>
            </div>
            <Switch checked={deliveryEnabled} onCheckedChange={setDeliveryEnabled} aria-label="Enable delivery orders" />
          </div>

          {deliveryEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Flat delivery fee</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={deliveryFeeSetting}
                  onChange={e => setDeliveryFeeSetting(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Minimum order for delivery</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={deliveryMinOrder}
                  onChange={e => setDeliveryMinOrder(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Free delivery above (blank = never)</Label>
                <Input
                  type="number" min={0} step="0.01"
                  value={freeDeliveryMin}
                  onChange={e => setFreeDeliveryMin(e.target.value)}
                  placeholder="e.g. 50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Delivery time (minutes)</Label>
                <Input
                  type="number" min={1} max={480}
                  value={deliveryEta}
                  onChange={e => setDeliveryEta(Number(e.target.value))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs">Delivery area note</Label>
                <Input
                  value={deliveryAreaNote}
                  onChange={e => setDeliveryAreaNote(e.target.value)}
                  placeholder="e.g. We deliver within 5 km of downtown"
                  maxLength={200}
                />
              </div>
            </div>
          )}
        </section>


        {/* Custom Domain */}
        {restaurant && (
          <section className="bg-card card-shadow ring-subtle rounded-lg p-5 space-y-5">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold text-card-foreground">Custom Domain</h2>
            </div>
            <p className="text-xs text-muted-foreground -mt-2">
              Serve your menu and ordering pages from your own domain (e.g. <code>bellacucina.com</code>) instead of the default URL.
            </p>

            {canCustomDomain ? (
              <CustomDomainCard
                restaurantId={restaurant.id}
                unlocked
                embedded
              />
            ) : (
              <RequestCustomDomainCard restaurantId={restaurant.id} />
            )}

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                <p className="text-sm font-medium text-card-foreground">DNS Setup Guide</p>
              </div>
              <CustomDomainSetupGuide
                domain={restaurant.custom_domain}
                verified={restaurant.custom_domain_verified}
                compact
              />
            </div>
          </section>
        )}

        {restaurant && <PageUrlsSection restaurant={restaurant} />}

        <NotificationSoundSection />

        {hasChanges && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-foreground text-background px-4 py-2 rounded-full text-sm font-medium shadow-lg flex items-center gap-2 animate-slide-up z-50">
            <div className="h-2 w-2 rounded-full bg-warning animate-pulse-dot" />
            Unsaved changes
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
