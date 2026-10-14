import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePromotions, type Promotion } from '@/hooks/usePromotions';
import { useCurrency } from '@/lib/currency';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, Ticket, DollarSign, BarChart3, Users } from 'lucide-react';

interface PromoUse {
  id: string;
  promotion_id: string;
  user_id: string | null;
  order_id: string | null;
  discount_applied: number;
  used_at: string;
}

const COLORS = [
  'hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))',
  'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--accent))',
];

export default function PromotionAnalytics() {
  const { data: promotions = [] } = usePromotions();
  const { format } = useCurrency();

  const { data: promoUses = [], isLoading } = useQuery({
    queryKey: ['promotion_uses_analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('promotion_uses' as any)
        .select('*')
        .order('used_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as PromoUse[];
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  // Aggregate stats
  const totalRedemptions = promoUses.length;
  const totalDiscountGiven = promoUses.reduce((s, u) => s + Number(u.discount_applied), 0);
  const uniqueUsers = new Set(promoUses.filter(u => u.user_id).map(u => u.user_id)).size;

  // Per-promotion stats
  const promoMap = new Map<string, Promotion>();
  promotions.forEach(p => promoMap.set(p.id, p));

  const perPromo = promotions.map(p => {
    const uses = promoUses.filter(u => u.promotion_id === p.id);
    const totalDiscount = uses.reduce((s, u) => s + Number(u.discount_applied), 0);
    return {
      id: p.id,
      name: p.name,
      code: p.promo_code || '(auto)',
      type: p.type,
      redemptions: uses.length,
      totalDiscount,
      avgDiscount: uses.length > 0 ? totalDiscount / uses.length : 0,
      maxUses: p.max_uses,
      redemptionRate: p.max_uses ? Math.round((uses.length / p.max_uses) * 100) : null,
    };
  }).sort((a, b) => b.redemptions - a.redemptions);

  // Top 6 for charts
  const topPromos = perPromo.filter(p => p.redemptions > 0).slice(0, 6);

  // Redemptions over last 7 days
  const last7Days: { day: string; count: number; discount: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    const dayUses = promoUses.filter(u => u.used_at.slice(0, 10) === dayStr);
    last7Days.push({
      day: d.toLocaleDateString('en', { weekday: 'short' }),
      count: dayUses.length,
      discount: dayUses.reduce((s, u) => s + Number(u.discount_applied), 0),
    });
  }

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Ticket className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground tabular-nums">{totalRedemptions}</p>
              <p className="text-xs text-muted-foreground">Total Redemptions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground tabular-nums">{format(totalDiscountGiven)}</p>
              <p className="text-xs text-muted-foreground">Total Discounts Given</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground tabular-nums">{uniqueUsers}</p>
              <p className="text-xs text-muted-foreground">Unique Users</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-chart-3/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-2xl font-bold text-card-foreground tabular-nums">
                {totalRedemptions > 0 ? format(totalDiscountGiven / totalRedemptions) : format(0)}
              </p>
              <p className="text-xs text-muted-foreground">Avg Discount / Use</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Redemptions over time */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" /> Redemptions (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={last7Days}>
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                    formatter={(value: number, name: string) => [
                      name === 'count' ? value : format(value),
                      name === 'count' ? 'Redemptions' : 'Discount Given',
                    ]}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top promos pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Ticket className="h-4 w-4 text-primary" /> Most Popular Promotions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {topPromos.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">No redemptions yet</div>
            ) : (
              <div className="flex flex-col gap-3 sm:h-52 sm:flex-row sm:items-center sm:gap-4">
                <div className="h-44 w-full sm:h-full sm:w-1/2">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={topPromos}
                        dataKey="redemptions"
                        nameKey="name"
                        cx="50%" cy="50%"
                        outerRadius={70}
                        innerRadius={40}
                      >
                        {topPromos.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 12, fontSize: 12, border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-1.5 sm:w-1/2">

                  {topPromos.map((p, i) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs">
                      <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <span className="truncate text-card-foreground font-medium">{p.name}</span>
                      <span className="text-muted-foreground tabular-nums ml-auto">{p.redemptions}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per-promotion table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Promotion Performance</CardTitle>
        </CardHeader>
        <CardContent>
          {perPromo.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No promotions created yet</p>
          ) : (
            <div className="touch-scroll-x scrollbar-hide max-h-[60dvh] overflow-y-auto -mx-2 px-2">
              <table className="w-full min-w-[560px] text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground [&>th]:sticky [&>th]:top-0 [&>th]:z-10 [&>th]:bg-card">
                    <th className="text-left py-2 font-medium">Promotion</th>
                    <th className="text-left py-2 font-medium">Code</th>
                    <th className="text-right py-2 font-medium">Redemptions</th>
                    <th className="text-right py-2 font-medium">Total Discount</th>
                    <th className="text-right py-2 font-medium">Avg Discount</th>
                    <th className="text-right py-2 font-medium">Usage Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {perPromo.map(p => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="py-2.5 font-medium text-card-foreground">{p.name}</td>
                      <td className="py-2.5 text-muted-foreground font-mono">{p.code}</td>
                      <td className="py-2.5 text-right tabular-nums text-card-foreground">{p.redemptions}</td>
                      <td className="py-2.5 text-right tabular-nums text-card-foreground">{format(p.totalDiscount)}</td>
                      <td className="py-2.5 text-right tabular-nums text-muted-foreground">{format(p.avgDiscount)}</td>
                      <td className="py-2.5 text-right">
                        {p.redemptionRate !== null ? (
                          <span className={`tabular-nums font-medium ${p.redemptionRate >= 80 ? 'text-destructive' : p.redemptionRate >= 50 ? 'text-warning' : 'text-primary'}`}>
                            {p.redemptionRate}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground">∞</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

          )}
        </CardContent>
      </Card>
    </div>
  );
}
