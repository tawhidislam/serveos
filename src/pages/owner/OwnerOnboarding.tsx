import { edgeFunctionError } from '@/lib/edge-function-error';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2, ArrowRight, ArrowLeft, Check, Store, UtensilsCrossed, LayoutGrid, QrCode } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { toast } from 'sonner';

type MenuTemplate = 'cafe' | 'fastfood' | 'finedining' | 'bakery' | 'bar';

const MENU_OPTIONS: { value: MenuTemplate; label: string; description: string }[] = [
  { value: 'cafe', label: 'Café', description: 'Coffee, pastries, light bites' },
  { value: 'fastfood', label: 'Fast Food', description: 'Burgers, fries, drinks' },
  { value: 'finedining', label: 'Fine Dining', description: 'Starters, mains, desserts' },
  { value: 'bakery', label: 'Bakery', description: 'Breads, cakes, cookies' },
  { value: 'bar', label: 'Bar', description: 'Cocktails, beer, bites' },
];

const QR_TEMPLATES = ['classic', 'modern', 'minimal', 'rounded'] as const;

const STEPS = [
  { id: 'details', label: 'Details', icon: Store },
  { id: 'menu', label: 'Menu', icon: UtensilsCrossed },
  { id: 'tables', label: 'Tables', icon: LayoutGrid },
  { id: 'qr', label: 'QR', icon: QrCode },
] as const;

export default function OwnerOnboarding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const qc = useQueryClient();
  const { data: restaurant, isLoading } = useCurrentRestaurant();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Step 1 — Details
  const [cuisineType, setCuisineType] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [tagline, setTagline] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [taxPercentage, setTaxPercentage] = useState(10);
  const [primaryColor, setPrimaryColor] = useState('#e87c1e');
  const [accentColor, setAccentColor] = useState('#c8a855');

  // Step 2 — Menu
  const [menuTemplate, setMenuTemplate] = useState<MenuTemplate>('cafe');

  // Step 3 — Tables
  const [tableCount, setTableCount] = useState(8);
  const [tablePrefix, setTablePrefix] = useState('T');
  const [tableCapacity, setTableCapacity] = useState(4);

  // Step 4 — QR
  const [qrTemplate, setQrTemplate] = useState<string>('classic');
  const [qrEnabled, setQrEnabled] = useState(true);
  const [qrPrimary, setQrPrimary] = useState('#000000');
  const [qrBg, setQrBg] = useState('#ffffff');

  useEffect(() => {
    if (!isLoading && !restaurant) {
      navigate('/staff-login', { replace: true });
    }
  }, [restaurant, isLoading, navigate]);

  useEffect(() => {
    if (restaurant) {
      setPrimaryColor(restaurant.primary_color || '#e87c1e');
      setAccentColor(restaurant.accent_color || '#c8a855');
      setQrPrimary(restaurant.primary_color || '#000000');
      setTagline(restaurant.tagline || '');
    }
  }, [restaurant]);

  const canNext = useMemo(() => {
    if (step === 0) return cuisineType.trim().length > 0 && address.trim().length > 0;
    if (step === 2) return tableCount >= 1 && tableCount <= 100;
    return true;
  }, [step, cuisineType, address, tableCount]);

  const next = () => setStep((s) => Math.min(STEPS.length - 1, s + 1));
  const back = () => setStep((s) => Math.max(0, s - 1));

  const handleFinish = async () => {
    if (!restaurant) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('tenant-onboard', {
        body: {
          restaurantId: restaurant.id,
          details: {
            cuisineType: cuisineType.trim(),
            phone: phone.trim() || undefined,
            address: address.trim() || undefined,
            tagline: tagline.trim() || undefined,
            currency,
            taxPercentage,
            primaryColor,
            accentColor,
          },
          menu: { template: menuTemplate },
          tables: {
            count: tableCount,
            defaultCapacity: tableCapacity,
            prefix: tablePrefix.trim() || 'T',
          },
          qr: {
            template: qrTemplate,
            enabled: qrEnabled,
            primaryColor: qrPrimary,
            backgroundColor: qrBg,
          },
        },
      });
      if (error) throw await edgeFunctionError(error);
      if (data?.error) throw new Error(data.error);
      toast.success(
        `Setup complete! Created ${data.menuCreated ?? 0} menu items and ${data.tablesCreated ?? 0} tables.`
      );
      await qc.invalidateQueries();
      const next = searchParams.get('next');
      navigate(next?.startsWith('/admin/subscription?') ? next : '/owner', { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Onboarding failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-10 px-4">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to {restaurant.name}</h1>
          <p className="text-muted-foreground mt-2">Let's get your restaurant ready in a few quick steps.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.id} className="flex-1 flex items-center">
                <div
                  className={`flex flex-col items-center gap-2 ${
                    active ? 'text-primary' : done ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : done
                        ? 'border-primary bg-primary/10'
                        : 'border-muted'
                    }`}
                  >
                    {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                  </div>
                  <span className="text-xs font-medium">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${i < step ? 'bg-primary' : 'bg-muted'}`} />
                )}
              </div>
            );
          })}
        </div>

        <Card className="p-6 md:p-8">
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Restaurant Details</h2>
                <p className="text-sm text-muted-foreground">Basic information customers will see.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="onboarding-cuisine">Cuisine Type *</Label>
                  <Input id="onboarding-cuisine" value={cuisineType} onChange={(e) => setCuisineType(e.target.value)} placeholder="Italian, Indian, Café…" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 123 4567" />
                </div>
              </div>
              <div>
                <Label htmlFor="onboarding-address">Address *</Label>
                <Textarea id="onboarding-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St, City" rows={2} />
              </div>
              <div>
                <Label>Tagline</Label>
                <Input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Authentic flavors, served fresh" />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['USD', 'EUR', 'GBP', 'BDT', 'INR', 'AED', 'CAD', 'AUD'].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Tax %</Label>
                  <Input type="number" min={0} max={50} step={0.5} value={taxPercentage} onChange={(e) => setTaxPercentage(Number(e.target.value))} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Primary</Label>
                    <Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-10 p-1" />
                  </div>
                  <div>
                    <Label>Accent</Label>
                    <Input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} className="h-10 p-1" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Pick a starter menu</h2>
                <p className="text-sm text-muted-foreground">We'll create categories and sample dishes you can edit anytime.</p>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {MENU_OPTIONS.map((opt) => {
                  const selected = menuTemplate === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setMenuTemplate(opt.value)}
                      className={`text-left p-4 rounded-lg border-2 transition-colors ${
                        selected ? 'border-primary bg-primary/5' : 'border-muted hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-sm text-muted-foreground">{opt.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">Set up tables</h2>
                <p className="text-sm text-muted-foreground">We'll create labelled tables you can rearrange later.</p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div>
                  <Label>How many tables?</Label>
                  <Input type="number" min={1} max={100} value={tableCount} onChange={(e) => setTableCount(Number(e.target.value))} />
                </div>
                <div>
                  <Label>Label prefix</Label>
                  <Input value={tablePrefix} onChange={(e) => setTablePrefix(e.target.value)} maxLength={8} />
                </div>
                <div>
                  <Label>Default seats</Label>
                  <Input type="number" min={1} max={20} value={tableCapacity} onChange={(e) => setTableCapacity(Number(e.target.value))} />
                </div>
              </div>
              <div className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">
                Preview: {Array.from({ length: Math.min(5, Math.max(0, tableCount)) }, (_, i) => `${tablePrefix}${i + 1}`).join(', ')}
                {tableCount > 5 ? `, …, ${tablePrefix}${tableCount}` : ''}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">QR ordering</h2>
                <p className="text-sm text-muted-foreground">Configure the QR codes guests scan from each table.</p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-medium">Enable QR ordering</div>
                  <div className="text-sm text-muted-foreground">Guests can scan and order from their phone.</div>
                </div>
                <Switch checked={qrEnabled} onCheckedChange={setQrEnabled} />
              </div>
              <div>
                <Label>QR Template</Label>
                <Select value={qrTemplate} onValueChange={setQrTemplate}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {QR_TEMPLATES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>QR Color</Label>
                  <Input type="color" value={qrPrimary} onChange={(e) => setQrPrimary(e.target.value)} className="h-10 p-1" />
                </div>
                <div>
                  <Label>Background</Label>
                  <Input type="color" value={qrBg} onChange={(e) => setQrBg(e.target.value)} className="h-10 p-1" />
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-4 border-t">
            <Button type="button" variant="ghost" onClick={back} disabled={step === 0 || submitting}>
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={next} disabled={!canNext}>
                Continue <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button type="button" onClick={handleFinish} disabled={submitting}>
                {submitting ? (
                  <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Provisioning…</>
                ) : (
                  <>Finish setup <Check className="h-4 w-4 ml-1" /></>
                )}
              </Button>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
