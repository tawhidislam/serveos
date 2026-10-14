import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import OwnerLayout from './OwnerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function OwnerAnalytics() {
  const { data: restaurant } = useCurrentRestaurant();

  const { data: stats } = useQuery({
    queryKey: ['owner-analytics', restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: orders } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at')
        .eq('restaurant_id', restaurant!.id)
        .gte('created_at', since.toISOString());

      const all = orders ?? [];
      const paid = all.filter((o) => o.status === 'paid');
      const revenue = paid.reduce((s, o) => s + Number(o.total_amount ?? 0), 0);
      const avgOrder = paid.length > 0 ? revenue / paid.length : 0;

      // Group by day
      const byDay = new Map<string, { date: string; orders: number; revenue: number }>();
      for (let i = 29; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        byDay.set(key, { date: key.slice(5), orders: 0, revenue: 0 });
      }
      for (const o of all) {
        const key = o.created_at.slice(0, 10);
        const bucket = byDay.get(key);
        if (bucket) {
          bucket.orders += 1;
          if (o.status === 'paid') bucket.revenue += Number(o.total_amount ?? 0);
        }
      }
      return {
        totalOrders: all.length,
        paidOrders: paid.length,
        revenue,
        avgOrder,
        chart: Array.from(byDay.values()),
      };
    },
  });

  const cards = [
    { label: 'Orders (30d)', value: stats?.totalOrders ?? 0 },
    { label: 'Paid', value: stats?.paidOrders ?? 0 },
    { label: 'Revenue', value: stats ? stats.revenue.toFixed(2) : '0.00' },
    { label: 'Avg order', value: stats ? stats.avgOrder.toFixed(2) : '0.00' },
  ];

  return (
    <OwnerLayout>
      <div className="p-8 space-y-6 max-w-5xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-sm text-muted-foreground mt-1">Last 30 days</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {cards.map((c) => (
            <Card key={c.label}>
              <CardContent className="p-6">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-semibold mt-1">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Daily revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats?.chart ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '6px',
                    }}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
