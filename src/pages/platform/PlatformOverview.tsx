import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, ShoppingBag, DollarSign, TrendingUp, Activity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';

export default function PlatformOverview() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['platform-stats'],
    queryFn: async () => {
      const [tenants, activeTenants, users, orders, revenue, subs] = await Promise.all([
        supabase.from('restaurants').select('id', { count: 'exact', head: true }),
        supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('restaurant_members').select('user_id', { count: 'exact', head: true }),
        supabase.from('orders').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('total_amount').eq('status', 'paid'),
        supabase.from('subscriptions').select('plan, status'),
      ]);
      const totalRevenue = (revenue.data ?? []).reduce(
        (sum, o: any) => sum + Number(o.total_amount ?? 0),
        0
      );
      const paidSubs = (subs.data ?? []).filter((s: any) => s.plan !== 'free' && s.status === 'active');
      // Stub MRR: $49 pro, $199 enterprise — replace with real prices when Stripe is live
      const mrr = paidSubs.reduce((sum, s: any) => sum + (s.plan === 'enterprise' ? 199 : 49), 0);
      return {
        tenants: tenants.count ?? 0,
        active: activeTenants.count ?? 0,
        users: users.count ?? 0,
        orders: orders.count ?? 0,
        revenue: totalRevenue,
        mrr,
        paidCount: paidSubs.length,
      };
    },
  });

  const { data: signups } = useQuery({
    queryKey: ['platform-signups-30d'],
    queryFn: async () => {
      const since = subDays(new Date(), 30).toISOString();
      const { data } = await supabase
        .from('restaurants')
        .select('created_at')
        .gte('created_at', since);
      const buckets = new Map<string, number>();
      for (let i = 29; i >= 0; i--) {
        const key = format(startOfDay(subDays(new Date(), i)), 'MMM d');
        buckets.set(key, 0);
      }
      (data ?? []).forEach((r: any) => {
        const key = format(startOfDay(new Date(r.created_at)), 'MMM d');
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
      });
      return Array.from(buckets, ([day, count]) => ({ day, count }));
    },
  });

  const { data: topTenants } = useQuery({
    queryKey: ['platform-top-tenants'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('restaurant_id, total_amount, restaurants!inner(name, slug)')
        .eq('status', 'paid');
      const map = new Map<string, { name: string; slug: string; total: number; orders: number }>();
      (data ?? []).forEach((o: any) => {
        if (!o.restaurant_id) return;
        const cur = map.get(o.restaurant_id) ?? { name: o.restaurants.name, slug: o.restaurants.slug, total: 0, orders: 0 };
        cur.total += Number(o.total_amount ?? 0);
        cur.orders += 1;
        map.set(o.restaurant_id, cur);
      });
      return Array.from(map.values()).sort((a, b) => b.total - a.total).slice(0, 5);
    },
  });

  const cards = [
    { label: 'Tenants', value: stats?.tenants ?? 0, sub: `${stats?.active ?? 0} active`, icon: Building2 },
    { label: 'Total users', value: stats?.users ?? 0, icon: Users },
    { label: 'Total orders', value: stats?.orders ?? 0, icon: ShoppingBag },
    { label: 'Gross GMV', value: stats ? `$${stats.revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '$0', icon: DollarSign },
    { label: 'MRR (est.)', value: stats ? `$${stats.mrr.toLocaleString()}` : '$0', sub: `${stats?.paidCount ?? 0} paid`, icon: TrendingUp },
    { label: '30-day signups', value: (signups ?? []).reduce((s, d) => s + d.count, 0), icon: Activity },
  ];

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-8 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform overview</h1>
          <p className="text-sm text-muted-foreground mt-1">All restaurants on the platform</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => {
            const Icon = c.icon;
            return (
              <Card key={c.label}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                      <p className="text-2xl font-semibold mt-1 tabular-nums">{isLoading ? '—' : c.value}</p>
                      {c.sub && <p className="text-xs text-muted-foreground mt-0.5">{c.sub}</p>}
                    </div>
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Signups (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={signups ?? []} margin={{ left: -20, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} interval={4} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  />
                  <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#signupGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top tenants by revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {!topTenants || topTenants.length === 0 ? (
              <p className="text-sm text-muted-foreground">No paid orders yet</p>
            ) : (
              <div className="space-y-2">
                {topTenants.map((t, i) => (
                  <div key={t.slug} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge variant="outline" className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs">
                        {i + 1}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.orders} orders</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold tabular-nums">${t.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PlatformLayout>
  );
}
