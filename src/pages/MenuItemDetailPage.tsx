import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/lib/currency';
import { useCartStore, SelectedAddon } from '@/stores/cartStore';
import { useAuth } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
import WebsiteLayout from '@/components/website/WebsiteLayout';
import ImageGalleryViewer from '@/components/menu/ImageGalleryViewer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { motion } from 'framer-motion';
import { ArrowLeft, Plus, Minus, ChefHat, ShoppingCart, SlidersHorizontal, Flame, Leaf, Star, Clock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function MenuItemDetailPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id') || searchParams.get('table');
  const { format: fmt } = useCurrency();
  const { addItem, getQtyForItem, updateQuantity, setActiveRestaurant } = useCartStore();
  const { data: restaurant } = useCurrentRestaurant();
  const [qty, setQty] = useState(1);
  const [selections, setSelections] = useState<Record<string, string[]>>({});

  // Accept both UUIDs (legacy) and custom_slug values. We scope custom_slug
  // lookups to the current restaurant when known so two tenants can use the
  // same friendly URL on their own domains.
  const { data: item, isLoading } = useQuery({
    queryKey: ['menu_item_detail', itemId, restaurant?.id ?? null],
    queryFn: async () => {
      if (!itemId) return null;
      if (UUID_RE.test(itemId)) {
        const { data, error } = await supabase
          .from('menu_items')
          .select('*')
          .eq('id', itemId)
          .maybeSingle();
        if (error) throw error;
        return data;
      }
      let query = supabase
        .from('menu_items')
        .select('*')
        .eq('custom_slug', itemId.toLowerCase());
      if (restaurant?.id) query = query.eq('restaurant_id', restaurant.id);
      const { data, error } = await query.limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!itemId,
  });

  // Tenant-scope the cart so detail-page additions are isolated per restaurant.
  const itemRestaurantId = (item as any)?.restaurant_id ?? restaurant?.id ?? null;
  useEffect(() => {
    if (itemRestaurantId) setActiveRestaurant(itemRestaurantId);
  }, [itemRestaurantId, setActiveRestaurant]);

  const { data: category } = useQuery({
    queryKey: ['category_detail', item?.category_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('name')
        .eq('id', item!.category_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!item?.category_id,
  });

  const resolvedId = item?.id ?? null;

  const { data: addonGroups = [] } = useQuery({
    queryKey: ['menu_item_addons_detail', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_addons')
        .select('*, menu_item_addon_options(*)')
        .eq('menu_item_id', resolvedId!)
        .order('sort_order');
      if (error) throw error;
      return (data || []).map((addon: any) => ({
        ...addon,
        options: (addon.menu_item_addon_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
      }));
    },
    enabled: !!resolvedId,
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['menu_item_tags_detail', resolvedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_item_tags')
        .select('tag_id, customization_tags(name, emoji, color)')
        .eq('menu_item_id', resolvedId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!resolvedId,
  });

  const { data: relatedItems = [] } = useQuery({
    queryKey: ['related_items', item?.category_id, resolvedId, (item as any)?.restaurant_id ?? null],
    queryFn: async () => {
      let q = supabase
        .from('menu_items')
        .select('id, name, price, image_url, custom_slug')
        .eq('category_id', item!.category_id)
        .eq('is_available', true)
        .neq('id', resolvedId!)
        .limit(4);
      const itemRestaurantId = (item as any)?.restaurant_id;
      if (itemRestaurantId) q = q.eq('restaurant_id', itemRestaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
    enabled: !!item?.category_id && !!resolvedId,
  });


  useEffect(() => {
    if (addonGroups.length > 0) {
      const defaults: Record<string, string[]> = {};
      addonGroups.forEach((g: any) => {
        if (g.required && g.type === 'single' && g.options.length > 0) {
          defaults[g.id] = [g.options[0].id];
        }
      });
      setSelections(defaults);
    }
  }, [addonGroups]);

  if (isLoading) {
    return (
      <WebsiteLayout>
        <div className="bg-[#070707] min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
        </div>
      </WebsiteLayout>
    );
  }

  if (!item) {
    return (
      <WebsiteLayout>
        <div className="bg-[#070707] min-h-screen flex flex-col items-center justify-center text-white">
          <ChefHat className="h-16 w-16 text-white/10 mb-4" />
          <p className="text-white/40 text-lg">Item not found</p>
          <Button variant="link" onClick={() => navigate('/menu')} className="text-amber-500 mt-4">
            Back to Menu
          </Button>
        </div>
      </WebsiteLayout>
    );
  }

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

  const addonTotal = addonGroups.reduce((sum: number, group: any) => {
    const selected = selections[group.id] || [];
    return sum + group.options
      .filter((o: any) => selected.includes(o.id))
      .reduce((s: number, o: any) => s + Number(o.price_modifier), 0);
  }, 0);

  const unitPrice = Number(item.price) + addonTotal;
  const totalPrice = unitPrice * qty;

  const allRequiredFilled = addonGroups
    .filter((g: any) => g.required)
    .every((g: any) => (selections[g.id]?.length ?? 0) > 0);

  const handleAddToCart = () => {
    const selectedAddons: SelectedAddon[] = [];
    addonGroups.forEach((group: any) => {
      const selected = selections[group.id] || [];
      group.options
        .filter((o: any) => selected.includes(o.id))
        .forEach((o: any) => {
          selectedAddons.push({
            addonId: group.id,
            optionId: o.id,
            optionName: o.name,
            priceModifier: Number(o.price_modifier),
          });
        });
    });
    for (let i = 0; i < qty; i++) {
      addItem({ menuItemId: item.id, name: item.name, price: Number(item.price), selectedAddons });
    }
    toast.success(`${qty}× ${item.name} added to cart`);
    if (navigator.vibrate) navigator.vibrate(10);
  };

  const cartQty = getQtyForItem(item.id);

  return (
    <WebsiteLayout>
      <div className="bg-[#070707] min-h-screen">
        {/* Back button */}
        <div className="max-w-5xl mx-auto px-6 pt-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to menu
          </button>
        </div>

        <div className="max-w-5xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* Image Gallery */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <ImageGalleryViewer
                menuItemId={item.id}
                mainImageUrl={item.image_url}
                itemName={item.name}
              />
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex flex-col"
            >
              {/* Category badge */}
              {category && (
                <span className="text-amber-500/70 text-sm font-medium uppercase tracking-wider mb-2">
                  {category.name}
                </span>
              )}

              <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">{item.name}</h1>

              {/* Tags */}
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {tags.map((t: any) => (
                    <span
                      key={t.tag_id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border border-white/10 bg-white/[0.04] text-white/70"
                    >
                      {t.customization_tags?.emoji} {t.customization_tags?.name}
                    </span>
                  ))}
                </div>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-amber-500 tabular-nums">
                  {fmt(Number(item.price))}
                </span>
                {!item.is_available && (
                  <Badge variant="destructive" className="text-xs">Unavailable</Badge>
                )}
              </div>

              {/* Description */}
              {item.description && (
                <p className="text-white/40 text-base leading-relaxed mb-4">
                  {item.description}
                </p>
              )}

              {/* Prep time */}
              {item.prep_time_minutes != null && (
                <div className="flex items-center gap-2 mb-6 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.06] w-fit">
                  <Clock className="h-4 w-4 text-amber-500" strokeWidth={1.5} />
                  <span className="text-sm text-white/60">
                    Prep time: <span className="text-white/90 font-medium">~{item.prep_time_minutes} min</span>
                  </span>
                </div>
              )}

              <Separator className="bg-white/[0.06] mb-6" />

              {/* Addon groups */}
              {addonGroups.length > 0 && (
                <div className="space-y-5 mb-6">
                  {addonGroups.map((group: any) => (
                    <div key={group.id}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                        {group.required && (
                          <span className="text-[10px] font-medium uppercase tracking-wider text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">
                            Required
                          </span>
                        )}
                        <span className="text-[10px] text-white/30 ml-auto">
                          {group.type === 'single' ? 'Pick one' : 'Pick any'}
                        </span>
                      </div>

                      {group.type === 'single' ? (
                        <RadioGroup
                          value={selections[group.id]?.[0] ?? ''}
                          onValueChange={(val) => handleSingleSelect(group.id, val)}
                          className="space-y-1.5"
                        >
                          {group.options.map((option: any) => (
                            <label
                              key={option.id}
                              className="flex items-center gap-3 rounded-xl border border-white/[0.08] p-3 cursor-pointer hover:bg-white/[0.03] transition-colors has-[[data-state=checked]]:border-amber-500/40 has-[[data-state=checked]]:bg-amber-500/[0.05]"
                            >
                              <RadioGroupItem value={option.id} />
                              <span className="flex-1 text-sm text-white/80">{option.name}</span>
                              {Number(option.price_modifier) !== 0 && (
                                <span className="text-xs font-medium text-white/40 tabular-nums">
                                  +{fmt(Number(option.price_modifier))}
                                </span>
                              )}
                            </label>
                          ))}
                        </RadioGroup>
                      ) : (
                        <div className="space-y-1.5">
                          {group.options.map((option: any) => {
                            const checked = (selections[group.id] || []).includes(option.id);
                            return (
                              <label
                                key={option.id}
                                className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer hover:bg-white/[0.03] transition-colors ${
                                  checked ? 'border-amber-500/40 bg-amber-500/[0.05]' : 'border-white/[0.08]'
                                }`}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => handleMultiToggle(group.id, option.id)}
                                />
                                <span className="flex-1 text-sm text-white/80">{option.name}</span>
                                {Number(option.price_modifier) !== 0 && (
                                  <span className="text-xs font-medium text-white/40 tabular-nums">
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
              )}

              {/* Qty + Add to Cart */}
              {item.is_available && (
                <div className="mt-auto space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 bg-white/[0.05] rounded-full p-1">
                      <button
                        onClick={() => setQty(q => Math.max(1, q - 1))}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-white/[0.08] text-white hover:bg-white/[0.12] transition-colors"
                      >
                        <Minus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                      <span className="text-base font-bold tabular-nums w-10 text-center text-white">{qty}</span>
                      <button
                        onClick={() => setQty(q => q + 1)}
                        className="h-10 w-10 flex items-center justify-center rounded-full bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                      >
                        <Plus className="h-4 w-4" strokeWidth={2.5} />
                      </button>
                    </div>
                    <span className="text-2xl font-bold text-white tabular-nums">{fmt(totalPrice)}</span>
                  </div>

                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAddToCart}
                    disabled={!allRequiredFilled}
                    className="w-full h-14 flex items-center justify-center gap-3 rounded-2xl bg-amber-500 text-black text-base font-bold hover:bg-amber-400 transition-all duration-300 hover:shadow-[0_8px_30px_rgba(245,158,11,0.3)] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ShoppingCart className="h-5 w-5" />
                    Add to Order · {fmt(totalPrice)}
                  </motion.button>

                  {cartQty > 0 && (
                    <p className="text-center text-amber-500/60 text-sm">
                      {cartQty} already in cart
                    </p>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* Related items */}
          {relatedItems.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16"
            >
              <h2 className="text-xl font-bold text-white mb-6">More from {category?.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {relatedItems.map((related) => (
                  <button
                    key={related.id}
                    onClick={() => navigate(`/menu/${(related as any).custom_slug || related.id}`)}
                    className="group text-left bg-white/[0.03] rounded-2xl overflow-hidden border border-white/[0.06] hover:border-amber-500/20 transition-all"
                  >
                    <div className="aspect-[16/10] overflow-hidden">
                      {related.image_url ? (
                        <img src={related.image_url} alt={related.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-white/[0.02]">
                          <ChefHat className="h-6 w-6 text-white/[0.06]" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <h3 className="text-sm font-medium text-white truncate">{related.name}</h3>
                      <p className="text-amber-500 text-sm font-bold mt-1">{fmt(Number(related.price))}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </WebsiteLayout>
  );
}
