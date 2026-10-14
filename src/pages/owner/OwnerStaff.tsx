import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import OwnerLayout from './OwnerLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

const ROLES = [
  { value: 'manager', label: 'Manager' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'waiter', label: 'Waiter' },
] as const;

export default function OwnerStaff() {
  const qc = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'manager' | 'kitchen' | 'waiter'>('waiter');
  const [submitting, setSubmitting] = useState(false);

  const { data: staff } = useQuery({
    queryKey: ['owner-staff', restaurant?.id],
    enabled: !!restaurant?.id,
    queryFn: async () => {
      const { data: members } = await supabase
        .from('restaurant_members')
        .select('user_id, created_at')
        .eq('restaurant_id', restaurant!.id);
      if (!members || members.length === 0) return [];
      const userIds = members.map((m) => m.user_id);
      const [profiles, roles] = await Promise.all([
        supabase.from('profiles').select('user_id, display_name').in('user_id', userIds),
        supabase.from('user_roles').select('user_id, role').in('user_id', userIds),
      ]);
      return members.map((m) => ({
        user_id: m.user_id,
        joined: m.created_at,
        display_name: profiles.data?.find((p) => p.user_id === m.user_id)?.display_name ?? '—',
        roles: (roles.data ?? []).filter((r) => r.user_id === m.user_id).map((r) => r.role),
      }));
    },
  });

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurant) return;
    if (!email.trim() || !password.trim()) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: {
          email: email.trim(),
          password,
          display_name: name.trim() || undefined,
          role,
          restaurant_id: restaurant.id,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success('Staff member created');
      setEmail('');
      setPassword('');
      setName('');
      qc.invalidateQueries({ queryKey: ['owner-staff', restaurant.id] });
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to create staff');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OwnerLayout>
      <div className="p-8 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Staff</h1>
          <p className="text-sm text-muted-foreground mt-1">Invite team members and assign roles</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Add a team member
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="staff-name">Name</Label>
                <Input id="staff-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-role">Role</Label>
                <Select value={role} onValueChange={(v: any) => setRole(v)}>
                  <SelectTrigger id="staff-role"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-email">Email</Label>
                <Input id="staff-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="jane@example.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="staff-password">Temporary password</Label>
                <Input id="staff-password" type="text" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="Share with them" />
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={submitting}>
                  {submitting ? 'Creating…' : 'Create staff account'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Current team</CardTitle>
          </CardHeader>
          <CardContent>
            {!staff || staff.length === 0 ? (
              <p className="text-sm text-muted-foreground">No staff yet</p>
            ) : (
              <div className="divide-y divide-border">
                {staff.map((s) => (
                  <div key={s.user_id} className="py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{s.display_name}</p>
                      <p className="text-xs text-muted-foreground">Joined {new Date(s.joined).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-1.5">
                      {s.roles.length === 0 ? (
                        <Badge variant="outline" className="text-xs">No role</Badge>
                      ) : (
                        s.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="text-xs">{r}</Badge>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </OwnerLayout>
  );
}
