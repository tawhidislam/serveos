import { useParams, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCartStore, SelectedAddon } from '@/stores/cartStore';
import { placeCustomerOrder } from '@/lib/placeCustomerOrder';
import { useCurrency } from '@/lib/currency';
import { hexToHSL } from '@/lib/hex-hsl';

import { useSettings } from '@/hooks/useSettings';
import { useAuth } from '@/hooks/useAuth';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { ChefHat, Search, X, Bell, Check } from 'lucide-react';
import CartFAB from '@/components/menu/CartFAB';
import CartSheet from '@/components/menu/CartSheet';
import AddonSelectionDrawer from '@/components/menu/AddonSelectionDrawer';
import ActiveOrdersBanner from '@/components/table-order/ActiveOrdersBanner';
import PromoBanner from '@/components/promotions/PromoBanner';
import { ORDER_LAYOUTS, isOrderPageTemplate } from '@/components/table-order/layouts';

export default function TableOrderPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user, hasAnyRole } = useAuth();
  const { format: fmt } = useCurrency();
  const { data: settings } = useSettings();
  const [searchParams] = useSearchParams();
  const reducedMotion = usePrefersReducedMotion();



  const {
    setTableId, items, addItem, updateQuantity, updateNotes, updateTags,
    totalItems, totalAmount, clearCart, resetCart, getQtyForItem, setActiveRestaurant,
  } = useCartStore();

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [addonDrawerItem, setAddonDrawerItem] = useState<any>(null);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [ordersExpanded, setOrdersExpanded] = useState(false);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrollingRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);

  // ─── Data fetching ─────────────────────────────────────────
  const { data: table, isLoading, isError } = useQuery({
    queryKey: ['table-lookup', tableId],
    queryFn: async () => {
      if (!tableId) return null;
      const { data, error } = await supabase
        .from('restaurant_tables')
        .select('id, label, status, restaurant_id')
        .eq('id', tableId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });

  // The table itself is the source of truth for which tenant this QR belongs
  // to. Every menu/category/addon query below MUST be scoped by this id so
  // diners only ever see the menu of the restaurant they're sitting in.
  const tableRestaurantId = (table as any)?.restaurant_id ?? null;

  // Ordering-page layout + branding chosen by this table's restaurant. Read
  // from the table's tenant (not the viewer's) so anonymous diners get the
  // right look.
  const { data: tableSettings } = useQuery({
    queryKey: ['table_order_settings', tableRestaurantId],
    enabled: !!tableRestaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_settings')
        .select('order_page_template, order_page_logo_url, order_page_primary_color, order_page_header_text, order_page_subtext, logo_url, restaurant_name')
        .eq('restaurant_id', tableRestaurantId!)
        .maybeSingle();
      return data;
    },
  });


  // Live-propagate admin layout/branding changes to every open QR page.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!tableRestaurantId) return;
    const channel = supabase
      .channel(`order-page-settings-${tableRestaurantId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'restaurant_settings',
          filter: `restaurant_id=eq.${tableRestaurantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['table_order_settings', tableRestaurantId] });
          queryClient.invalidateQueries({ queryKey: ['restaurant_settings'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tableRestaurantId, queryClient]);

  // Layout is an admin-only setting. The `?_order_template=` query param is a
  // preview aid for restaurant staff only — diners always get the saved choice.
  const canPreviewTemplate = !!user && hasAnyRole(['owner', 'admin', 'manager']);
  const templateOverride = canPreviewTemplate ? searchParams.get('_order_template') : null;
  const orderTemplate = isOrderPageTemplate(templateOverride)
    ? templateOverride
    : isOrderPageTemplate((tableSettings as any)?.order_page_template)
      ? ((tableSettings as any).order_page_template as any)
      : isOrderPageTemplate(settings?.order_page_template)
        ? (settings!.order_page_template as any)
        : 'classic';
  const LayoutComponent = ORDER_LAYOUTS[orderTemplate];

  // Branding overrides for the QR ordering page (admin-configured).
  const brand = {
    logoUrl:
      (tableSettings as any)?.order_page_logo_url ||
      (tableSettings as any)?.logo_url ||
      settings?.order_page_logo_url ||
      settings?.logo_url ||
      null,
    headerText:
      (tableSettings as any)?.order_page_header_text ||
      settings?.order_page_header_text ||
      (tableSettings as any)?.restaurant_name ||
      settings?.restaurant_name ||
      'Restaurant',
    subtext:
      (tableSettings as any)?.order_page_subtext ||
      settings?.order_page_subtext ||
      null,
    primaryColor:
      (tableSettings as any)?.order_page_primary_color ||
      settings?.order_page_primary_color ||
      null,
  };
  const brandHsl = brand.primaryColor ? hexToHSL(brand.primaryColor) : '';
  const brandStyle = brandHsl
    ? ({ '--primary': brandHsl, '--ring': brandHsl, '--accent': brandHsl } as React.CSSProperties)
    : undefined;




  const { data: categories = [] } = useQuery({
    queryKey: ['categories', tableRestaurantId],
    enabled: !!tableRestaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', tableRestaurantId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu_items_available', tableRestaurantId],
    enabled: !!tableRestaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('menu_items')
        .select('*')
        .eq('restaurant_id', tableRestaurantId!)
        .eq('is_available', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: addonsMap = {} } = useQuery({
    queryKey: ['menu_addons', tableRestaurantId],
    enabled: !!tableRestaurantId,
    queryFn: async () => {
      const { data: addons, error } = await supabase
        .from('menu_item_addons')
        .select('*, menu_item_addon_options(*)')
        .eq('restaurant_id', tableRestaurantId!)
        .order('sort_order');
      if (error) throw error;
      const map: Record<string, any[]> = {};
      (addons || []).forEach((addon: any) => {
        if (!map[addon.menu_item_id]) map[addon.menu_item_id] = [];
        map[addon.menu_item_id].push({
          ...addon,
          options: (addon.menu_item_addon_options || []).sort((a: any, b: any) => a.sort_order - b.sort_order),
        });
      });
      return map;
    },
  });

  const { data: tableOrders = [], refetch: refetchOrders } = useQuery({
    queryKey: ['table_active_orders', tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('id, status, created_at, total_amount')
        .eq('table_id', tableId!)
        .in('status', ['pending', 'confirmed', 'preparing'])
        .order('created_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!tableId,
  });

  // ─── Effects ───────────────────────────────────────────────
  useEffect(() => {
    if (table?.id) setTableId(table.id);
  }, [table?.id, setTableId]);

  // Tenant-scope the cart by the table's restaurant so QR scans across different
  // restaurants never share or mix cart contents.
  useEffect(() => {
    setActiveRestaurant(tableRestaurantId ?? null);
  }, [tableRestaurantId, setActiveRestaurant]);

  useEffect(() => {
    if (!tableId) return;
    const channel = supabase
      .channel(`table-orders-${tableId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `table_id=eq.${tableId}` }, () => {
        refetchOrders();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [tableId, refetchOrders]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [searchOpen]);

  // Scroll active category pill into view
  useEffect(() => {
    if (!activeCategoryId || !categoryScrollRef.current) return;
    const pill = categoryScrollRef.current.querySelector(`[data-cat="${activeCategoryId}"]`);
    if (pill) pill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeCategoryId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveCategoryId(entry.target.id.replace('cat-', ''));
          }
        }
      },
      { rootMargin: '-120px 0px -60% 0px', threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [categories, menuItems]);

  // ─── Filter & group ────────────────────────────────────────
  const query = searchQuery.toLowerCase().trim();
  const filteredItems = query
    ? menuItems.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      )
    : menuItems;

  const grouped = categories
    .map(cat => ({ ...cat, items: filteredItems.filter(item => item.category_id === cat.id) }))
    .filter(cat => cat.items.length > 0);

  // ─── Handlers ──────────────────────────────────────────────
  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    isScrollingRef.current = true;
    const el = sectionRefs.current[catId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isScrollingRef.current = false; }, 600);
    }
  };

  const handleItemAdd = (item: any) => {
    const itemAddons = addonsMap[item.id];
    if (itemAddons && itemAddons.length > 0) {
      setAddonDrawerItem(item);
    } else {
      addItem({ menuItemId: item.id, name: item.name, price: Number(item.price) });
      if (navigator.vibrate) navigator.vibrate(10);
    }
  };

  const handleAddonAdd = (item: any, addons: SelectedAddon[], qty: number) => {
    for (let i = 0; i < qty; i++) {
      addItem({ menuItemId: item.id, name: item.name, price: Number(item.price), selectedAddons: addons });
    }
  };

  const handleCallWaiter = async () => {
    setCallingWaiter(true);
    try {
      const { error } = await supabase.from('waiter_calls' as any).insert({ table_id: tableId });
      if (error) throw error;
      setWaiterCalled(true);
      toast.success('Waiter has been notified!');
      if (navigator.vibrate) navigator.vibrate([50, 30, 50]);
      setTimeout(() => setWaiterCalled(false), 30000);
    } catch {
      toast.error('Failed to call waiter');
    } finally {
      setCallingWaiter(false);
    }
  };

  const handlePlaceOrder = async (promoId?: string, _discount?: number, loyaltyPointsUsed?: number) => {
    if (items.length === 0 || !tableRestaurantId) return;
    setSubmitting(true);
    try {
      // Totals, promotion and loyalty are validated and recorded server-side.
      const orderId = await placeCustomerOrder({
        restaurantId: tableRestaurantId,
        items,
        tableId,
        promotionId: promoId ?? null,
        loyaltyPoints: loyaltyPointsUsed ?? 0,
      });

      resetCart(user?.id ?? null);
      setCartOpen(false);
      toast.success('Order placed!');
      navigate(`/order/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Early returns ─────────────────────────────────────────
  if (!tableId) return <Navigate to="/menu" replace />;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Loading menu…</p>
        </div>
      </div>
    );
  }

  if (isError || !table) return <Navigate to="/menu" replace />;

  const restaurantName = brand.headerText;
  const logoUrl = brand.logoUrl;

  return (
    <div className="min-h-screen bg-background" style={brandStyle}>
      {/* ─── Header ─────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border/50">
        {/* Top row */}
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          {/* Logo */}
          {logoUrl ? (
            <div className="h-9 w-9 rounded-xl overflow-hidden shrink-0 bg-secondary ring-1 ring-border/50">
              <img src={logoUrl} alt={restaurantName} className="h-full w-full object-cover" />
            </div>
          ) : (
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <ChefHat className="h-4.5 w-4.5 text-primary" strokeWidth={1.5} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <p className="text-muted-foreground/60 text-[11px] font-medium uppercase tracking-[0.15em] leading-none mb-1 truncate">
              {restaurantName}
            </p>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse shrink-0" />
              <h1 className="text-foreground font-display font-bold text-base truncate">
                {table.label}
              </h1>
            </div>
            {brand.subtext && (
              <p className="text-muted-foreground text-[11px] mt-1 truncate">{brand.subtext}</p>
            )}
          </div>


          {/* Call waiter */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            disabled={callingWaiter || waiterCalled}
            onClick={handleCallWaiter}
            className={`relative p-2.5 rounded-xl transition-all duration-300 ${
              waiterCalled
                ? 'bg-success/10 text-success'
                : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
            }`}
          >
            {waiterCalled ? (
              <Check className="h-4 w-4" strokeWidth={2.5} />
            ) : (
              <>
                <Bell className="h-4 w-4" strokeWidth={1.5} />
                <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-primary opacity-0 group-hover:opacity-100" />
              </>
            )}
          </motion.button>

          {/* Search toggle */}
          <button
            onClick={() => setSearchOpen(p => !p)}
            className={`p-2.5 rounded-xl transition-all duration-300 ${
              searchOpen || searchQuery
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
            }`}
          >
            <Search className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Search bar */}
        <AnimatePresence>
          {searchOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-3 max-w-2xl mx-auto">
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" strokeWidth={1.5} />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search dishes…"
                    className="w-full h-10 rounded-xl bg-secondary border border-border pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                    >
                      <X className="h-4 w-4" strokeWidth={1.5} />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category pills */}
        {grouped.length > 0 && (
          <div
            ref={categoryScrollRef}
            className="flex gap-1.5 px-4 pb-3 overflow-x-auto scrollbar-hide max-w-2xl mx-auto"
            style={{ scrollPaddingInline: '16px' }}
          >
            {categories.map(cat => {
              const count = filteredItems.filter(i => i.category_id === cat.id).length;
              if (count === 0) return null;
              const isActive = activeCategoryId === cat.id;
              return (
                <button
                  key={cat.id}
                  data-cat={cat.id}
                  onClick={() => scrollToCategory(cat.id)}
                  className={`shrink-0 px-4 py-1.5 rounded-full text-[13px] font-medium transition-all duration-300 ${
                    isActive
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary text-muted-foreground hover:text-foreground hover:bg-secondary/80'
                  }`}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ─── Active orders ────────────────────────────────────── */}
      <AnimatePresence>
        {tableOrders.length > 0 && (
          <ActiveOrdersBanner
            orders={tableOrders}
            expanded={ordersExpanded}
            onToggle={() => setOrdersExpanded(p => !p)}
            format={fmt}
          />
        )}
      </AnimatePresence>

      {/* ─── Promo Banner ─────────────────────────────────────── */}
      <PromoBanner />

      {/* ─── Menu content ─────────────────────────────────────── */}
      <main className="max-w-2xl mx-auto px-4 pt-5 pb-28">
        <LayoutComponent
          groups={grouped as any}
          registerSection={(catId, el) => { sectionRefs.current[catId] = el; }}
          getQty={getQtyForItem}
          format={fmt}
          onAdd={handleItemAdd}
          onUpdateQty={updateQuantity}
          hasAddons={(id) => !!(addonsMap[id]?.length)}
          reducedMotion={reducedMotion}
        />


        {grouped.length === 0 && (
          <div className="text-center py-24">
            <div className="h-16 w-16 rounded-2xl bg-secondary mx-auto mb-4 flex items-center justify-center">
              <ChefHat className="h-7 w-7 text-muted-foreground/20" strokeWidth={1} />
            </div>
            <p className="text-muted-foreground font-display text-lg">No dishes found</p>
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); setSearchOpen(false); }}
                className="mt-3 text-primary text-sm font-medium hover:underline"
              >
                Clear search
              </button>
            )}
          </div>
        )}
      </main>

      {/* ─── Bottom accent line ───────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent pointer-events-none" />

      {/* ─── Cart & Drawers ───────────────────────────────────── */}
      <CartFAB
        totalItems={totalItems()}
        totalAmount={fmt(totalAmount())}
        visible={totalItems() > 0 && !cartOpen}
        onClick={() => setCartOpen(true)}
      />

      <CartSheet
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        items={items}
        totalItems={totalItems()}
        totalAmount={totalAmount()}
        format={fmt}
        user={user}
        submitting={submitting}
        onPlaceOrder={handlePlaceOrder}
        onUpdateQuantity={updateQuantity}
        onUpdateNotes={updateNotes}
        onUpdateTags={updateTags}
        onClearCart={() => { resetCart(user?.id ?? null); }}
      />

      <AddonSelectionDrawer
        open={!!addonDrawerItem}
        onClose={() => setAddonDrawerItem(null)}
        item={addonDrawerItem}
        addonGroups={addonDrawerItem ? (addonsMap[addonDrawerItem.id] || []) : []}
        onAddToCart={handleAddonAdd}
      />
    </div>
  );
}
