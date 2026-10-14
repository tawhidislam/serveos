import { useState, useEffect } from 'react';
import { useCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ImageOff, Plus, Minus } from 'lucide-react';
import {
  Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerDescription,
} from '@/components/ui/drawer';
import type { SelectedAddon } from '@/stores/cartStore';

interface AddonOption {
  id: string;
  name: string;
  price_modifier: number;
  sort_order: number;
}

interface AddonGroup {
  id: string;
  name: string;
  type: string; // 'single' | 'multi'
  required: boolean;
  sort_order: number;
  options: AddonOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  item: MenuItem | null;
  addonGroups: AddonGroup[];
  onAddToCart: (item: MenuItem, addons: SelectedAddon[], qty: number) => void;
}

export default function AddonSelectionDrawer({ open, onClose, item, addonGroups, onAddToCart }: Props) {
  const { format: fmt } = useCurrency();
  const [selections, setSelections] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);

  // Reset state when item changes
  useEffect(() => {
    if (open && item) {
      setQty(1);
      const defaults: Record<string, string[]> = {};
      addonGroups.forEach(g => {
        if (g.required && g.type === 'single' && g.options.length > 0) {
          defaults[g.id] = [g.options[0].id];
        }
      });
      setSelections(defaults);
    }
  }, [open, item?.id]);

  if (!item) return null;

  const handleSingleSelect = (groupId: string, optionId: string) => {
    setSelections(prev => ({ ...prev, [groupId]: [optionId] }));
  };

  const handleMultiToggle = (groupId: string, optionId: string) => {
    setSelections(prev => {
      const current = prev[groupId] || [];
      return {
        ...prev,
        [groupId]: current.includes(optionId)
          ? current.filter(id => id !== optionId)
          : [...current, optionId],
      };
    });
  };

  // Check if all required groups have selections
  const allRequiredFilled = addonGroups
    .filter(g => g.required)
    .every(g => (selections[g.id]?.length ?? 0) > 0);

  // Calculate total price
  const addonTotal = addonGroups.reduce((sum, group) => {
    const selected = selections[group.id] || [];
    return sum + group.options
      .filter(o => selected.includes(o.id))
      .reduce((s, o) => s + Number(o.price_modifier), 0);
  }, 0);

  const unitPrice = Number(item.price) + addonTotal;
  const totalPrice = unitPrice * qty;

  const handleAdd = () => {
    const selectedAddons: SelectedAddon[] = [];
    addonGroups.forEach(group => {
      const selected = selections[group.id] || [];
      group.options
        .filter(o => selected.includes(o.id))
        .forEach(o => {
          selectedAddons.push({
            addonId: group.id,
            optionId: o.id,
            optionName: o.name,
            priceModifier: Number(o.price_modifier),
          });
        });
    });
    onAddToCart(item, selectedAddons, qty);
    onClose();
  };

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[85dvh]">
        <DrawerHeader className="text-left pb-2">
          <div className="flex gap-3 items-start">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-16 h-16 rounded-xl object-cover shrink-0" />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-secondary flex items-center justify-center shrink-0">
                <ImageOff className="h-6 w-6 text-muted-foreground/30" strokeWidth={1} />
              </div>
            )}
            <div className="min-w-0">
              <DrawerTitle className="text-lg">{item.name}</DrawerTitle>
              {item.description && (
                <DrawerDescription className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {item.description}
                </DrawerDescription>
              )}
              <p className="text-sm font-semibold text-primary mt-1">{fmt(Number(item.price))}</p>
            </div>
          </div>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-2 space-y-5 flex-1">
          {addonGroups
            .sort((a, b) => a.sort_order - b.sort_order)
            .map(group => (
              <div key={group.id}>
                <div className="flex items-center gap-2 mb-2.5">
                  <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                  {group.required && (
                    <span className="text-[10px] font-medium uppercase tracking-wider text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                      Required
                    </span>
                  )}
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {group.type === 'single' ? 'Pick one' : 'Pick any'}
                  </span>
                </div>

                {group.type === 'single' ? (
                  <RadioGroup
                    value={selections[group.id]?.[0] ?? ''}
                    onValueChange={(val) => handleSingleSelect(group.id, val)}
                    className="space-y-1"
                  >
                    {group.options.sort((a, b) => a.sort_order - b.sort_order).map(option => (
                      <label
                        key={option.id}
                        className="flex items-center gap-3 rounded-xl border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                      >
                        <RadioGroupItem value={option.id} id={option.id} />
                        <span className="flex-1 text-sm text-foreground">{option.name}</span>
                        {Number(option.price_modifier) !== 0 && (
                          <span className="text-xs font-medium text-muted-foreground tabular-nums">
                            +{fmt(Number(option.price_modifier))}
                          </span>
                        )}
                      </label>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-1">
                    {group.options.sort((a, b) => a.sort_order - b.sort_order).map(option => {
                      const checked = (selections[group.id] || []).includes(option.id);
                      return (
                        <label
                          key={option.id}
                          className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:bg-accent/50 transition-colors ${
                            checked ? 'border-primary bg-primary/5' : 'border-border'
                          }`}
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() => handleMultiToggle(group.id, option.id)}
                          />
                          <span className="flex-1 text-sm text-foreground">{option.name}</span>
                          {Number(option.price_modifier) !== 0 && (
                            <span className="text-xs font-medium text-muted-foreground tabular-nums">
                              +{fmt(Number(option.price_modifier))}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
        </div>

        <DrawerFooter className="border-t border-border pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 bg-secondary rounded-full p-1">
              <button
                onClick={() => setQty(q => Math.max(1, q - 1))}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-card text-foreground hover:bg-accent transition-colors"
              >
                <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
              <span className="text-sm font-bold tabular-nums w-8 text-center">{qty}</span>
              <button
                onClick={() => setQty(q => q + 1)}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            </div>
            <span className="text-base font-bold text-foreground tabular-nums">{fmt(totalPrice)}</span>
          </div>
          <Button
            className="w-full h-12 text-base font-semibold rounded-xl"
            disabled={!allRequiredFilled}
            onClick={handleAdd}
          >
            Add to order · {fmt(totalPrice)}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
