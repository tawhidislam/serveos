import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import PlatformLayout from './PlatformLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Shield } from 'lucide-react';
import { toast } from 'sonner';

export default function PlatformUsers() {
  const qc = useQueryClient();
  const [newAdminEmail, setNewAdminEmail] = useState('');

  const { data: admins } = useQuery({
    queryKey: ['platform-admins'],
    queryFn: async () => {
      const { data } = await supabase
        .from('platform_admins')
        .select('id, email, created_at, notes')
        .order('created_at', { ascending: true });
      return data ?? [];
    },
  });

  const { data: members } = useQuery({
    queryKey: ['platform-members-with-restaurant'],
    queryFn: async () => {
      const { data } = await supabase
        .from('restaurant_members')
        .select('user_id, restaurant_id, restaurants(name, slug)')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const addAdmin = async () => {
    if (!newAdminEmail.trim()) return;
    const { error } = await supabase
      .from('platform_admins')
      .insert({ email: newAdminEmail.trim().toLowerCase() });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Platform admin added');
    setNewAdminEmail('');
    qc.invalidateQueries({ queryKey: ['platform-admins'] });
  };

  const removeAdmin = async (id: string) => {
    const { error } = await supabase.from('platform_admins').delete().eq('id', id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success('Removed');
    qc.invalidateQueries({ queryKey: ['platform-admins'] });
  };

  return (
    <PlatformLayout>
      <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Platform users</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Super-admins and tenant memberships
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Platform super-admins
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="admin@example.com"
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
              />
              <Button onClick={addAdmin}>
                <Plus className="h-4 w-4 mr-1.5" /> Add
              </Button>
            </div>
            <div className="space-y-1">
              {(admins ?? []).map((a) => (
                <div key={a.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{a.email}</p>
                    {a.notes && <p className="text-xs text-muted-foreground">{a.notes}</p>}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAdmin(a.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tenant memberships</CardTitle>
          </CardHeader>
          <CardContent>
            {(members ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No memberships</p>
            ) : (
              <div className="space-y-1">
                {(members ?? []).map((m: any, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <p className="text-xs font-mono text-muted-foreground truncate max-w-xs">{m.user_id}</p>
                    <Badge variant="outline" className="text-xs">
                      {m.restaurants?.name ?? '—'}
                    </Badge>
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
