import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { format as fmtDate } from 'date-fns';
import { toast } from 'sonner';
import {
  ShoppingBag, Star, CalendarDays, User,
  Clock, ChefHat, CheckCircle2, XCircle, Package, Truck,
  LogOut, Heart, AlertTriangle, RotateCcw,
} from 'lucide-react';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCurrency } from '@/lib/currency';
import { useResolvedRestaurant } from '@/hooks/useResolvedRestaurant';
import { useCartStore } from '@/stores/cartStore';
import SavedAddresses from '@/components/customer/SavedAddresses';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

const statusConfig: Record<string, { label: string; class: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   class: 'bg-warning/10 text-warning',         icon: Clock },
  confirmed: { label: 'Confirmed', class: 'bg-primary/10 text-primary',         icon: Package },
  preparing: { label: 'Preparing', class: 'bg-primary/10 text-primary',         icon: ChefHat },
  ready:     { label: 'Ready',     class: 'bg-success/10 text-success',         icon: CheckCircle2 },
  served:    { label: 'Served',    class: 'bg-success/10 text-success',         icon: Truck },
  completed: { label: 'Completed', class: 'bg-muted text-muted-foreground',     icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', class: 'bg-destructive/10 text-destructive', icon: XCircle },
};

export default function CustomerDashboard() {
  const { user, signOut } = useAuth();
  const { format } = useCurrency();
  const { restaurant, restaurantId, isLoading: restaurantLoading } = useResolvedRestaurant();
  const navigate = useNavigate();

  // If we're on the bare /account route (no slug), find any restaurant this
  // user is a customer of and redirect to its scoped dashboard.
  const { data: fallbackRestaurant, isLoading: fallbackLoading } = useQuery({
    queryKey: ['my-first-restaurant', user?.id],
    enabled: !!user?.id && !restaurantLoading && !restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_customers')
        .select('restaurants(id, slug, name)')
        .eq('auth_user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.restaurants ?? null;
    },
  });

  useEffect(() => {
    if (fallbackRestaurant?.slug) {
      navigate(`/r/${fallbackRestaurant.slug}/account`, { replace: true });
    }
  }, [fallbackRestaurant, navigate]);

  // Customer row for this user at THIS restaurant
  const { data: customerRow } = useQuery({
    queryKey: ['my-customer-row', user?.id, restaurantId],
    enabled: !!user?.id && !!restaurantId,
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_customers')
        .select('id, email, display_name, phone, restaurant_id')
        .eq('auth_user_id', user!.id)
        .eq('restaurant_id', restaurantId!)
        .maybeSingle();
      return data as any;
    },
  });

  const customerId = customerRow?.id;

  const { data: orders = [] } = useQuery({
    queryKey: ['my-orders', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, status, total_amount, created_at, restaurant_id, customer_id, restaurant_tables(label), order_items(id, quantity, notes, menu_items(id, name, price, is_available))')
        .eq('customer_id', customerId!)
        .order('created_at', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const { addItem, setActiveRestaurant } = useCartStore();

  /** One-tap reorder: refill the cart with a past order and jump to checkout. */
  const handleReorder = (order: any) => {
    const lines = (order.order_items ?? []).filter((i: any) => i.menu_items?.is_available !== false);
    if (lines.length === 0) {
      toast.error('These items are no longer available');
      return;
    }
    setActiveRestaurant(order.restaurant_id ?? restaurantId ?? null);
    let count = 0;
    for (const line of lines) {
      for (let i = 0; i < Math.max(1, line.quantity); i++) {
        addItem({
          menuItemId: line.menu_items.id,
          restaurantId: order.restaurant_id ?? restaurantId ?? null,
          name: line.menu_items.name,
          price: Number(line.menu_items.price),
          notes: line.notes ?? undefined,
        });
        count++;
      }
    }
    toast.success(`${count} item${count !== 1 ? 's' : ''} added to your cart`);
    navigate(restaurant?.slug ? `/r/${restaurant.slug}/menu?openCart=1` : '/menu?openCart=1');
  };


  const { data: reservations = [] } = useQuery({
    queryKey: ['my-reservations', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('reservations')
        .select('id, guest_name, party_size, reservation_date, reservation_time, status, notes, customer_id, restaurant_id')
        .eq('customer_id', customerId!)
        .order('reservation_date', { ascending: false })
        .limit(20);
      return (data ?? []) as any[];
    },
  });

  const { data: totalPoints = 0 } = useQuery({
    queryKey: ['my-loyalty', customerId],
    enabled: !!customerId,
    queryFn: async () => {
      const { data } = await supabase
        .from('loyalty_transactions')
        .select('points, expires_at')
        .eq('customer_id', customerId!);
      return (data ?? []).reduce((sum: number, t: any) => {
        if (t.expires_at && new Date(t.expires_at) < new Date()) return sum;
        return sum + Number(t.points || 0);
      }, 0);
    },
  });

  const totalOrders = orders.length;
  const totalSpent = orders.reduce((s, o) => s + Number(o.total_amount || 0), 0);
  const upcomingReservations = reservations.filter(
    r => new Date(r.reservation_date) >= new Date(new Date().toDateString())
  ).length;

  const displayName =
    customerRow?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split('@')[0] ||
    'Guest';

  if (!restaurantLoading && !restaurantId) {
    if (fallbackLoading || fallbackRestaurant) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <p className="text-sm text-muted-foreground">Loading your account…</p>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No restaurant detected. Please open this page from a restaurant URL (e.g. <code>/r/your-restaurant/account</code>).
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
              <User className="h-5 w-5 text-primary-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                {restaurant?.name ? `Welcome to ${restaurant.name}` : 'Welcome back'}
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{displayName}</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {restaurant?.slug && (
              <Link to={`/r/${restaurant.slug}/menu`}>
                <Button variant="outline" size="sm">Order</Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => signOut()}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <ShoppingBag className="h-3.5 w-3.5" /> Orders
            </div>
            <p className="text-2xl font-semibold">{totalOrders}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Heart className="h-3.5 w-3.5" /> Total Spent
            </div>
            <p className="text-2xl font-semibold">{format(totalSpent)}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Star className="h-3.5 w-3.5" /> Points
            </div>
            <p className="text-2xl font-semibold">{totalPoints}</p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <CalendarDays className="h-3.5 w-3.5" /> Upcoming
            </div>
            <p className="text-2xl font-semibold">{upcomingReservations}</p>
          </Card>
        </section>

        <section>
          <h2 className="text-base font-semibold tracking-tight mb-3">Recent Orders</h2>
          {orders.length === 0 ? (
            <Card className="p-8 text-center">
              <ShoppingBag className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-3">No orders yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {orders.map(o => {
                const cfg = statusConfig[o.status] ?? statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <Link key={o.id} to={`/order/${o.id}`}>
                    <Card className="p-4 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <Badge className={`${cfg.class} gap-1`} variant="secondary">
                              <Icon className="h-3 w-3" /> {cfg.label}
                            </Badge>
                            {o.restaurant_tables?.label && (
                              <span className="text-xs text-muted-foreground">Table {o.restaurant_tables.label}</span>
                            )}
                          </div>
                          <p className="text-sm text-foreground truncate">
                            {o.order_items?.map((i: any) => `${i.menu_items?.name ?? '?'} x${i.quantity}`).join(', ') || 'No items'}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {fmtDate(new Date(o.created_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                        <div className="text-right shrink-0 space-y-2">
                          <p className="font-semibold">{format(Number(o.total_amount))}</p>
                          {o.status !== 'cancelled' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1"
                              onClick={e => { e.preventDefault(); e.stopPropagation(); handleReorder(o); }}
                            >
                              <RotateCcw className="h-3.5 w-3.5" /> Reorder
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        <SavedAddresses restaurantId={restaurantId} />


        <section>
          <h2 className="text-base font-semibold tracking-tight mb-3">My Reservations</h2>
          {reservations.length === 0 ? (
            <Card className="p-8 text-center">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No reservations yet</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {reservations.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Badge variant="secondary" className="capitalize">{r.status}</Badge>
                        <span className="text-xs text-muted-foreground">Party of {r.party_size}</span>
                      </div>
                      <p className="text-sm text-foreground">
                        {fmtDate(new Date(r.reservation_date), 'EEE, MMM d, yyyy')} at {r.reservation_time}
                      </p>
                      {r.notes && <p className="text-xs text-muted-foreground mt-1 truncate">{r.notes}</p>}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
