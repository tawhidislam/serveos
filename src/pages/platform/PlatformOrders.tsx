import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function PlatformOrders() {
  const { data: orders } = useQuery({
    queryKey: ['platform-orders'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, total_amount, status, created_at, restaurant_id, restaurants(name, slug)')
        .order('created_at', { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recent orders</h1>
          <p className="text-sm text-muted-foreground mt-1">Latest 100 orders across all tenants</p>
        </div>

        <Card>
          <CardContent className="p-0">
            {!orders || orders.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">No orders yet</div>
            ) : (
              <div className="divide-y divide-border">
                {orders.map((o: any) => (
                  <div key={o.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium font-mono">#{o.id.slice(0, 8)}</p>
                        <Badge variant="outline" className="text-xs">
                          {o.restaurants?.name ?? 'Unknown'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(o.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{Number(o.total_amount).toFixed(2)}</p>
                      <Badge variant={o.status === 'paid' ? 'default' : 'secondary'} className="text-xs mt-0.5">
                        {o.status}
                      </Badge>
                    </div>
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
