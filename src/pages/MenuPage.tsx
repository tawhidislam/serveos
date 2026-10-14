import { useEffect, useRef, useState } from 'react';
import { useCurrency } from '@/lib/currency';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCartStore, SelectedAddon, saveCartForUser, loadCartForUser } from '@/stores/cartStore';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { useWebsitePrefix } from '@/hooks/useWebsitePrefix';
import {
  readIntentFromUrl, storeIntent, loadStoredIntent, resolveApplicableIntent, clearIntent,
} from '@/lib/checkout-intent';
import { ChefHat, Bell, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { motion as m } from 'framer-motion';
import WaiterLayout from '@/components/waiter/WaiterLayout';
import WebsiteLayout from '@/components/website/WebsiteLayout';
import MenuHeader from '@/components/menu/MenuHeader';
import CategoryScroller from '@/components/menu/CategoryScroller';
import MenuItemCard from '@/components/menu/MenuItemCard';
import CartFAB from '@/components/menu/CartFAB';
import CartSheet from '@/components/menu/CartSheet';
import AddonSelectionDrawer from '@/components/menu/AddonSelectionDrawer';
import { useActiveRestaurantId } from '@/hooks/useActiveRestaurantId';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { useCurrentCustomer } from '@/hooks/useCurrentCustomer';
import { useHomepageContent } from '@/hooks/useHomepageContent';
import { useTenantSeo } from '@/hooks/useTenantSeo';
import { useParams } from 'react-router-dom';
import { useSettings } from '@/hooks/useSettings';
import { placeCustomerOrder } from '@/lib/placeCustomerOrder';
import FulfillmentPanel, {
  emptyFulfillment, computeDeliveryFee, validateFulfillment,
  type FulfillmentDetails, type FulfillmentConfig,
} from '@/components/menu/FulfillmentPanel';

export default function MenuPage() {
  const { data: activeRestaurantId } = useActiveRestaurantId();
  const [searchParams] = useSearchParams();
  const tableId = searchParams.get('table_id') || searchParams.get('table');
  const waiterModeParam = searchParams.get('mode') === 'waiter';
  const {
    setTableId, items, addItem, updateQuantity, updateNotes, updateTags,
    totalItems, totalAmount, clearCart, resetCart, getQtyForItem, mergeItems,
    setActiveRestaurant,
  } = useCartStore();
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [waiterMode, setWaiterMode] = useState(waiterModeParam);
  const [selectedTable, setSelectedTable] = useState<string>(tableId ?? '');
  const [addonDrawerItem, setAddonDrawerItem] = useState<any>(null);
  const [callingWaiter, setCallingWaiter] = useState(false);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const { user, hasAnyRole } = useAuth();
  const { format: fmt } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { withPrefix } = useWebsitePrefix();
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const isScrollingRef = useRef(false);

  const isStaff = hasAnyRole(['waiter', 'server', 'admin', 'manager']);

  useEffect(() => {
    if (tableId) setTableId(tableId);
  }, [tableId, setTableId]);

  // Tenant-aware SEO for /r/:slug/menu
  const { restaurant } = useResolvedRestaurant();
  const { data: customer } = useCurrentCustomer(restaurant?.id ?? activeRestaurantId);
  const { slug } = useParams<{ slug?: string }>();
  const { data: tenantHomeContent } = useHomepageContent(restaurant?.id);
  const { data: settings } = useSettings();

  // ── Delivery / pickup (online ordering, no table QR) ──────────────────
  const fulfillmentConfig: FulfillmentConfig = {
    deliveryEnabled: !!settings?.delivery_enabled,
    pickupEnabled: !!settings?.pickup_enabled,
    deliveryFee: Number(settings?.delivery_fee ?? 0),
    freeDeliveryMin: settings?.free_delivery_min != null ? Number(settings.free_delivery_min) : null,
    deliveryMinOrder: Number(settings?.delivery_min_order ?? 0),
    deliveryEtaMinutes: Number(settings?.delivery_eta_minutes ?? 45),
    pickupEtaMinutes: Number(settings?.pickup_eta_minutes ?? 20),
    deliveryAreaNote: settings?.delivery_area_note ?? null,
  };
  const onlineOrderingAvailable =
    !tableId && !waiterMode && (fulfillmentConfig.deliveryEnabled || fulfillmentConfig.pickupEnabled);
  const [fulfillment, setFulfillment] = useState<FulfillmentDetails>(emptyFulfillment);

  // ── Checkout preselection ────────────────────────────────────────────
  // Intent can arrive from any inbound link (?order=, ?fulfillment=, #order=,
  // aliases like takeaway) — including external/custom links. Once seen it is
  // persisted per tenant so it survives navigation and the sign-in round trip.
  const intentRestaurantId = restaurant?.id ?? activeRestaurantId ?? null;
  const urlIntent = readIntentFromUrl(location.search, location.hash);

  useEffect(() => {
    if (urlIntent) storeIntent(urlIntent, intentRestaurantId);
  }, [urlIntent, intentRestaurantId]);

  // Dine-in / reservation intents belong on other flows — send them there.
  useEffect(() => {
    if (!urlIntent || tableId || waiterMode) return;
    if (urlIntent === 'dine_in') navigate(withPrefix('/dine-in'), { replace: true });
    else if (urlIntent === 'reserve') navigate(`${withPrefix('/contact')}#reserve`, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlIntent, tableId, waiterMode]);

  // Apply the intent (URL first, then the sticky one) whenever config resolves,
  // falling back to whichever type the restaurant actually offers.
  useEffect(() => {
    if (!onlineOrderingAvailable) return;
    const intent = urlIntent ?? loadStoredIntent(intentRestaurantId);
    const preselected = resolveApplicableIntent(intent, {
      deliveryEnabled: fulfillmentConfig.deliveryEnabled,
      pickupEnabled: fulfillmentConfig.pickupEnabled,
    });
    setFulfillment(prev => {
      if (preselected) {
        return prev.orderType === preselected ? prev : { ...prev, orderType: preselected };
      }
      const ok = prev.orderType === 'delivery' ? fulfillmentConfig.deliveryEnabled
        : prev.orderType === 'pickup' ? fulfillmentConfig.pickupEnabled
        : false;
      if (ok) return prev;
      return { ...prev, orderType: fulfillmentConfig.pickupEnabled ? 'pickup' : 'delivery' };
    });
  }, [urlIntent, intentRestaurantId, onlineOrderingAvailable, fulfillmentConfig.deliveryEnabled, fulfillmentConfig.pickupEnabled]);

  // Keep the sticky intent in sync when the customer changes it manually.
  const handleFulfillmentChange = (next: FulfillmentDetails) => {
    setFulfillment(next);
    if (next.orderType === 'delivery' || next.orderType === 'pickup') {
      storeIntent(next.orderType, intentRestaurantId);
    }
  };



  const deliveryFee = onlineOrderingAvailable
    ? computeDeliveryFee(fulfillmentConfig, fulfillment.orderType, totalAmount())
    : 0;
  const fulfillmentError = onlineOrderingAvailable
    ? validateFulfillment(fulfillmentConfig, fulfillment, totalAmount())
    : null;

  const seoCfg = (tenantHomeContent as any)?.seo || {};
  const tenantName = restaurant?.name || 'Menu';
  const seoTitle = seoCfg.menu_meta_title || `Menu — ${tenantName}`;
  const seoDesc = seoCfg.menu_meta_description
    || `Browse the full menu at ${tenantName}. Order your favorites for dine-in or takeaway.`;
  const seoImage = seoCfg.menu_og_image_url
    || seoCfg.og_image_url
    || (tenantHomeContent as any)?.hero?.hero_image_url;
  const canonicalPath = slug
    ? `/r/${slug}/menu`
    : restaurant?.slug ? `/r/${restaurant.slug}/menu` : '/menu';
  useTenantSeo({
    title: seoTitle,
    description: typeof seoDesc === 'string' ? seoDesc.slice(0, 160) : undefined,
    ogImage: seoImage,
    canonicalPath,
  });

  // Auto-open cart after returning from sign-in
  useEffect(() => {
    if (searchParams.get('openCart') === '1' && items.length > 0) {
      setCartOpen(true);
    }
  }, [searchParams, items.length]);

  // Scope the cart to the current restaurant tenant. Switching tenants drops items
  // belonging to other restaurants from the active workspace so customers never see
  // or reuse another /r/:slug's cart.
  const tenantId = restaurant?.id ?? activeRestaurantId ?? null;
  useEffect(() => {
    setActiveRestaurant(tenantId);
  }, [tenantId, setActiveRestaurant]);

  // Merge any pre-login cart with the user's previously saved cart on auth (per tenant).
  const mergedForUserRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user?.id || !tenantId) return;
    const key = `${user.id}::${tenantId}`;
    if (mergedForUserRef.current === key) return;
    const saved = loadCartForUser(user.id, tenantId);
    if (saved.length > 0) mergeItems(saved);
    mergedForUserRef.current = key;
  }, [user?.id, tenantId, mergeItems]);

  // Persist the user's cart whenever it changes while signed in (per tenant).
  useEffect(() => {
    if (!user?.id || !tenantId) return;
    const tenantItems = items.filter(i => i.restaurantId === tenantId);
    saveCartForUser(user.id, tenantId, tenantItems);
  }, [user?.id, tenantId, items]);

  const { data: allTables = [] } = useQuery({
    queryKey: ['all_tables', activeRestaurantId],
    enabled: waiterMode,
    queryFn: async () => {
      let q = supabase.from('restaurant_tables').select('id, label').order('label');
      if (activeRestaurantId) q = q.eq('restaurant_id', activeRestaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', activeRestaurantId],
    queryFn: async () => {
      let q = supabase.from('categories').select('*').order('sort_order');
      if (activeRestaurantId) q = q.eq('restaurant_id', activeRestaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: menuItems = [] } = useQuery({
    queryKey: ['menu_items_available', activeRestaurantId],
    queryFn: async () => {
      let q = supabase
        .from('menu_items')
        .select('*')
        .eq('is_available', true)
        .order('name');
      if (activeRestaurantId) q = q.eq('restaurant_id', activeRestaurantId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const { data: addonsMap = {} } = useQuery({
    queryKey: ['menu_addons', activeRestaurantId],
    queryFn: async () => {
      let aq = supabase
        .from('menu_item_addons')
        .select('*, menu_item_addon_options(*)')
        .order('sort_order');
      if (activeRestaurantId) aq = aq.eq('restaurant_id', activeRestaurantId);
      const { data: addons, error: addonsErr } = await aq;
      if (addonsErr) throw addonsErr;
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

  const { data: tableName } = useQuery({
    queryKey: ['table_label', tableId],
    queryFn: async () => {
      if (!tableId) return null;
      const { data } = await supabase
        .from('restaurant_tables')
        .select('label')
        .eq('id', tableId)
        .single();
      return data?.label ?? null;
    },
    enabled: !!tableId,
  });

  useEffect(() => {
    if (categories.length > 0 && !activeCategoryId) {
      setActiveCategoryId(categories[0].id);
    }
  }, [categories, activeCategoryId]);

  const query = searchQuery.toLowerCase().trim();
  const filteredItems = query
    ? menuItems.filter(item =>
        item.name.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      )
    : menuItems;

  const grouped = categories
    .map(cat => ({
      ...cat,
      items: filteredItems.filter(item => item.category_id === cat.id),
    }))
    .filter(cat => cat.items.length > 0);

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
  }, [grouped]);

  const scrollToCategory = (catId: string) => {
    setActiveCategoryId(catId);
    isScrollingRef.current = true;
    const el = sectionRefs.current[catId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => { isScrollingRef.current = false; }, 600);
    }
  };

  const getQty = (id: string) => getQtyForItem(id);

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
    if (!tableId) return;
    setCallingWaiter(true);
    try {
      const { error } = await supabase.from('waiter_calls').insert({ table_id: tableId });
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
    if (items.length === 0) return;

    // Delivery / pickup checkout is guest-friendly: contact details replace login.
    if (onlineOrderingAvailable) {
      const err = validateFulfillment(fulfillmentConfig, fulfillment, totalAmount());
      if (err) { toast.error(err); return; }
    } else if (!user && !tableId) {
      // Require login before placing an order. Waiter mode requires staff login;
      // table-QR walk-ins remain anonymous.
      // Build a return URL that restores waiter mode + selected table after sign-in.
      const params = new URLSearchParams(location.search);
      if (waiterMode) {
        params.set('mode', 'waiter');
        if (selectedTable) params.set('table', selectedTable);
      }
      params.set('openCart', '1');
      const returnTo = `${location.pathname}?${params.toString()}`;
      const loginBase = waiterMode
        ? '/staff-login'
        : restaurant?.slug ? `/r/${restaurant.slug}/login` : '/auth';
      toast.info(waiterMode ? 'Please sign in as staff to place this order' : 'Please sign in to place your order');
      navigate(`${loginBase}?redirect=${encodeURIComponent(returnTo)}`);
      setCartOpen(false);
      return;
    }

    setSubmitting(true);
    try {
      let orderId: string;
      if (waiterMode) {
        // Staff placing an order for a table: direct insert, scoped by RLS.
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: selectedTable || undefined,
            user_id: user?.id || null,
            customer_id: customer?.id || null,
            status: 'pending',
            total_amount: totalAmount(),
            restaurant_id: activeRestaurantId || undefined,
          })
          .select()
          .single();
        if (orderError) throw orderError;

        const orderItems = items.map(item => ({
          order_id: order.id,
          menu_item_id: item.menuItemId,
          quantity: item.quantity,
          notes: item.notes || null,
          status: 'pending',
          selected_tags: item.selectedTags || [],
          // Server resolves names/prices from the option ids.
          selected_addons: (item.selectedAddons ?? []).map(a => ({ option_id: a.optionId })),
          restaurant_id: activeRestaurantId || undefined,
        }));
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) throw itemsError;
        orderId = order.id;
      } else {
        // Customers (guest or signed in): totals, promotion and loyalty are
        // validated and recorded server-side.
        orderId = await placeCustomerOrder({
          restaurantId: activeRestaurantId!,
          items,
          tableId,
          promotionId: promoId ?? null,
          loyaltyPoints: loyaltyPointsUsed ?? 0,
          ...(onlineOrderingAvailable ? {
            orderType: fulfillment.orderType,
            customerName: fulfillment.customerName.trim(),
            customerPhone: fulfillment.customerPhone.trim(),
            deliveryAddress: fulfillment.orderType === 'delivery' ? fulfillment.deliveryAddress.trim() : null,
            deliveryInstructions: fulfillment.deliveryInstructions.trim() || null,
          } : {}),
        });
      }

      resetCart(user?.id ?? null);
      clearIntent(intentRestaurantId);
      setCartOpen(false);
      toast.success('Order placed!');
      navigate(`/order/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  const menuContent = (
    <div className={waiterMode ? 'bg-background pb-28' : 'pb-28'}>
      <MenuHeader
        tableName={tableName}
        tableId={tableId}
        user={user}
        isStaff={isStaff}
        waiterMode={waiterMode}
        onToggleWaiterMode={() => setWaiterMode(p => !p)}
        selectedTable={selectedTable}
        onSelectTable={setSelectedTable}
        allTables={allTables}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <CategoryScroller
        categories={categories}
        menuItems={menuItems}
        activeCategoryId={activeCategoryId}
        onSelect={scrollToCategory}
        waiterMode={waiterMode}
      />

      {/* Menu grid */}
      <div className={waiterMode ? 'px-4 pt-1' : 'max-w-6xl mx-auto px-6 sm:px-10 lg:px-16 pt-8'}>
        {grouped.map(cat => (
          <div
            key={cat.id}
            id={`cat-${cat.id}`}
            ref={(el) => { sectionRefs.current[cat.id] = el; }}
            className={waiterMode ? 'mb-8 scroll-mt-[120px]' : 'mb-12 scroll-mt-[140px]'}
          >
            <h2 className={waiterMode
              ? 'font-display text-xl font-bold text-foreground mb-4 pt-2'
              : 'font-display text-2xl sm:text-3xl font-bold text-white mb-2 pt-2'
            }>
              {cat.name}
            </h2>
            {!waiterMode && (
              <p className="text-white/25 text-sm mb-6">{cat.items.length} {cat.items.length === 1 ? 'dish' : 'dishes'}</p>
            )}
            <div className={waiterMode
              ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'
              : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
            }>
              {cat.items.map((item, idx) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  qty={getQty(item.id)}
                  formattedPrice={fmt(Number(item.price))}
                  onAdd={() => handleItemAdd(item)}
                  onUpdateQty={(newQty) => updateQuantity(item.id, newQty)}
                  index={idx}
                  hasAddons={!!(addonsMap[item.id]?.length)}
                  waiterMode={waiterMode}
                />
              ))}
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="text-center py-24">
            <ChefHat className={`h-16 w-16 mx-auto mb-4 ${waiterMode ? 'text-muted-foreground/20' : 'text-white/[0.08]'}`} strokeWidth={1} />
            <p className={`text-lg font-display ${waiterMode ? 'text-muted-foreground' : 'text-white/40'}`}>No menu items available</p>
            <p className={`text-sm mt-1 ${waiterMode ? 'text-muted-foreground/60' : 'text-white/20'}`}>Check back soon!</p>
          </div>
        )}
      </div>

      {/* Call Waiter button - only for table QR orders (not waiter mode) */}
      {tableId && !waiterMode && (
        <m.button
          whileTap={{ scale: 0.9 }}
          disabled={callingWaiter || waiterCalled}
          onClick={handleCallWaiter}
          className={`fixed bottom-24 left-4 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 ${
            waiterCalled
              ? 'bg-green-500 text-white'
              : 'bg-card text-foreground border border-border hover:bg-primary hover:text-primary-foreground'
          }`}
        >
          {waiterCalled ? (
            <><Check className="h-4 w-4" strokeWidth={2.5} /><span className="text-sm font-semibold">Waiter Notified</span></>
          ) : (
            <><Bell className="h-4 w-4" strokeWidth={2.5} /><span className="text-sm font-semibold">{callingWaiter ? 'Calling...' : 'Call Waiter'}</span></>
          )}
        </m.button>
      )}

      <CartFAB
        totalItems={totalItems()}
        totalAmount={fmt(totalAmount())}
        visible={totalItems() > 0 && !cartOpen}
        onClick={() => setCartOpen(true)}
        waiterMode={waiterMode}
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
        onClearCart={() => { resetCart(user?.id ?? null); setCartOpen(false); }}
        deliveryFee={deliveryFee}
        placeDisabled={!!fulfillmentError}
        placeLabel={onlineOrderingAvailable
          ? (fulfillment.orderType === 'delivery' ? 'Place Delivery Order' : 'Place Pickup Order')
          : 'Place Order'}
        fulfillmentSlot={onlineOrderingAvailable ? (
          <FulfillmentPanel
            config={fulfillmentConfig}
            value={fulfillment}
            onChange={handleFulfillmentChange}
            format={fmt}
            subtotal={totalAmount()}
            restaurantId={tenantId}
          />
        ) : undefined}
        onSignIn={(tableId || onlineOrderingAvailable) && !waiterMode ? undefined : () => {
          // Build a return URL that re-opens the cart on the menu after auth.
          const params = new URLSearchParams(location.search);
          if (waiterMode) {
            params.set('mode', 'waiter');
            if (selectedTable) params.set('table', selectedTable);
          }
          params.set('openCart', '1');
          const returnTo = `${location.pathname}?${params.toString()}`;
          const loginBase = waiterMode
            ? '/staff-login'
            : restaurant?.slug ? `/r/${restaurant.slug}/login` : '/auth';
          setCartOpen(false);
          navigate(`${loginBase}?redirect=${encodeURIComponent(returnTo)}`);
        }}
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

  if (waiterMode) {
    return (
      <WaiterLayout title="New Order" subtitle={`${totalItems()} items in cart`}>
        {menuContent}
      </WaiterLayout>
    );
  }

  return (
    <WebsiteLayout>
      <div className="bg-[#070707] min-h-screen">
        {menuContent}
      </div>
    </WebsiteLayout>
  );
}
