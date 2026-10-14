import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Users, Shield, Building2, Loader2, Plus, Trash2, X, UserPlus, Mail, Lock, Tag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppRole } from '@/hooks/useAuth';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import PlanLimitNotice, { usePlanLimitGate } from '@/components/PlanLimitNotice';

const ALL_ROLES: AppRole[] = ['admin', 'manager', 'kitchen', 'waiter', 'server', 'customer'];
const STAFF_ROLES: AppRole[] = ['admin', 'manager', 'kitchen', 'waiter', 'server'];

const roleBadgeClass: Record<string, string> = {
  admin: 'bg-destructive/15 text-destructive border-destructive/20',
  manager: 'bg-warning/15 text-warning border-warning/20',
  kitchen: 'bg-primary/15 text-primary border-primary/20',
  waiter: 'bg-success/15 text-success border-success/20',
  server: 'bg-success/15 text-success border-success/20',
  customer: 'bg-muted text-muted-foreground border-border',
};

interface StaffMember {
  user_id: string;
  display_name: string | null;
  email: string;
  roles: AppRole[];
  branches: { id: string; branch_id: string; branch_name: string }[];
}

interface Branch {
  id: string;
  name: string;
}

export default function StaffManagement() {
  const qc = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [selectedUser, setSelectedUser] = useState<StaffMember | null>(null);
  const [addRoleValue, setAddRoleValue] = useState<string>('');
  const [addBranchValue, setAddBranchValue] = useState<string>('');
  const [addStaffOpen, setAddStaffOpen] = useState(false);
  const [newStaff, setNewStaff] = useState({ email: '', password: '', display_name: '', role: '' });
  const { disabled: limitReached, reason: limitReason } = usePlanLimitGate('maxStaff', 'staff seats');

  // Fetch all staff with roles and branch assignments — scoped to tenant
  const { data: staff = [], isLoading } = useQuery({
    queryKey: ['staff_members', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      // Get user IDs that belong to this tenant
      const { data: members, error: mErr } = await supabase
        .from('restaurant_members')
        .select('user_id')
        .eq('restaurant_id', restaurantId!);
      if (mErr) throw mErr;
      const userIds = (members ?? []).map(m => m.user_id);
      if (userIds.length === 0) return [];

      // Get profiles for those users
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds)
        .order('created_at', { ascending: true });
      if (pErr) throw pErr;

      // Get all roles for those users
      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', userIds);
      if (rErr) throw rErr;

      // Get all branch assignments for those users
      const { data: staffBranches, error: sbErr } = await supabase
        .from('staff_branches')
        .select('id, user_id, branch_id, branches(name, restaurant_id)')
        .in('user_id', userIds);
      if (sbErr) throw sbErr;

      const roleMap = new Map<string, AppRole[]>();
      for (const r of roles ?? []) {
        const arr = roleMap.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        roleMap.set(r.user_id, arr);
      }

      const branchMap = new Map<string, { id: string; branch_id: string; branch_name: string }[]>();
      for (const sb of staffBranches ?? []) {
        const branchInfo = sb.branches as any;
        // Filter to branches that belong to this restaurant
        if (branchInfo?.restaurant_id && branchInfo.restaurant_id !== restaurantId) continue;
        const arr = branchMap.get(sb.user_id) ?? [];
        arr.push({
          id: sb.id,
          branch_id: sb.branch_id,
          branch_name: branchInfo?.name ?? 'Unknown',
        });
        branchMap.set(sb.user_id, arr);
      }

      return (profiles ?? []).map(p => ({
        user_id: p.user_id,
        display_name: p.display_name,
        email: p.display_name ?? p.user_id.slice(0, 8),
        roles: roleMap.get(p.user_id) ?? [],
        branches: branchMap.get(p.user_id) ?? [],
      })) as StaffMember[];
    },
  });

  const { data: branches = [] } = useQuery({
    queryKey: ['branches', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('id, name')
        .eq('is_active', true)
        .eq('restaurant_id', restaurantId!);
      if (error) throw error;
      return data as Branch[];
    },
  });

  const addRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_members'] });
      setAddRoleValue('');
      toast.success('Role assigned');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_members'] });
      toast.success('Role removed');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addBranch = useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { error } = await supabase.from('staff_branches').insert({ user_id: userId, branch_id: branchId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_members'] });
      setAddBranchValue('');
      toast.success('Branch assigned');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_members'] });
      toast.success('Branch unassigned');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createStaff = useMutation({
    mutationFn: async () => {
      if (!newStaff.email.trim() || !newStaff.password) {
        throw new Error('Email and password are required');
      }
      if (newStaff.password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      const { data, error } = await supabase.functions.invoke('create-staff', {
        body: {
          email: newStaff.email.trim(),
          password: newStaff.password,
          display_name: newStaff.display_name.trim() || newStaff.email.trim(),
          role: newStaff.role || null,
          restaurant_id: restaurant?.id ?? null,
        },
      });
      // FunctionsHttpError wraps non-2xx responses; pull the real message from the response body
      if (error) {
        let msg = error.message;
        const ctx: any = (error as any).context;
        try {
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) msg = typeof body.error === 'string' ? body.error : JSON.stringify(body.error);
          } else if (ctx && typeof ctx.text === 'function') {
            const text = await ctx.text();
            if (text) msg = text;
          }
        } catch {}
        throw new Error(msg);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff_members'] });
      setAddStaffOpen(false);
      setNewStaff({ email: '', password: '', display_name: '', role: '' });
      toast.success('Staff member created');
    },
    onError: (e: any) => toast.error(e.message || 'Failed to create staff'),
  });

  const openUser = (user: StaffMember) => {
    setSelectedUser(user);
    setAddRoleValue('');
    setAddBranchValue('');
  };

  // Refresh selected user data when staff updates
  const currentUser = selectedUser ? staff.find(s => s.user_id === selectedUser.user_id) ?? selectedUser : null;
  const availableRoles = currentUser ? ALL_ROLES.filter(r => !currentUser.roles.includes(r)) : [];
  const availableBranches = currentUser ? branches.filter(b => !currentUser.branches.some(sb => sb.branch_id === b.id)) : [];


  return (
    <AdminLayout title="Staff Management" subtitle={`${staff.length} user${staff.length !== 1 ? 's' : ''}`}>
      <div className="p-4 lg:p-6 max-w-3xl space-y-3">
        <PlanLimitNotice limitKey="maxStaff" resource="staff seats" />
        {/* Add Staff Button */}
        <div className="flex justify-end">
          <Button
            onClick={() => setAddStaffOpen(true)}
            size="sm"
            className="gap-1.5"
            disabled={limitReached}
            title={limitReason}
          >
            <UserPlus className="h-4 w-4" strokeWidth={2} />
            Add Staff
          </Button>
        </div>
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : staff.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p>No users found</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {staff.map((member, i) => (
              <motion.button
                key={member.user_id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openUser(member)}
                className="w-full text-left bg-card card-shadow ring-subtle rounded-lg p-4 hover:card-shadow-hover transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Users className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <span className="font-semibold text-card-foreground truncate">
                        {member.display_name ?? 'Unnamed User'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mb-2">{member.user_id.slice(0, 8)}…</p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.roles.map(role => (
                        <Badge
                          key={role}
                          variant="outline"
                          className={`text-[11px] capitalize ${roleBadgeClass[role] ?? ''}`}
                        >
                          {role}
                        </Badge>
                      ))}
                      {member.roles.length === 0 && (
                        <span className="text-xs text-muted-foreground italic">No roles</span>
                      )}
                    </div>
                  </div>
                  {member.branches.length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Building2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span className="text-xs text-muted-foreground">{member.branches.length}</span>
                    </div>
                  )}
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* User Detail Dialog */}
      <Dialog open={!!selectedUser} onOpenChange={o => !o && setSelectedUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              {currentUser?.display_name ?? 'Unnamed User'}
            </DialogTitle>
            <DialogDescription>
              Manage roles and branch assignments for this user.
            </DialogDescription>
          </DialogHeader>

          {currentUser && (
            <div className="space-y-5">
              {/* Roles Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <span className="label-ui">Roles</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {currentUser.roles.map(role => (
                    <Badge
                      key={role}
                      variant="outline"
                      className={`capitalize gap-1 pr-1 ${roleBadgeClass[role] ?? ''}`}
                    >
                      {role}
                      <button
                        onClick={() => removeRole.mutate({ userId: currentUser.user_id, role })}
                        className="ml-0.5 h-4 w-4 rounded-full flex items-center justify-center hover:bg-foreground/10 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                  {currentUser.roles.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No roles assigned</span>
                  )}
                </div>
                {availableRoles.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={addRoleValue} onValueChange={setAddRoleValue}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Add role…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map(r => (
                          <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!addRoleValue || addRole.isPending}
                      onClick={() => addRoleValue && addRole.mutate({ userId: currentUser.user_id, role: addRoleValue as AppRole })}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>

              {/* Branches Section */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Building2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                  <span className="label-ui">Branch Assignments</span>
                </div>
                <div className="space-y-2 mb-3">
                  {currentUser.branches.map(sb => (
                    <div key={sb.id} className="flex items-center justify-between bg-secondary/50 rounded-md px-3 py-2">
                      <span className="text-sm text-foreground">{sb.branch_name}</span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeBranch.mutate(sb.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                      </Button>
                    </div>
                  ))}
                  {currentUser.branches.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No branches assigned</span>
                  )}
                </div>
                {availableBranches.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Select value={addBranchValue} onValueChange={setAddBranchValue}>
                      <SelectTrigger className="h-9 flex-1">
                        <SelectValue placeholder="Assign branch…" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableBranches.map(b => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      disabled={!addBranchValue || addBranch.isPending}
                      onClick={() => addBranchValue && addBranch.mutate({ userId: currentUser.user_id, branchId: addBranchValue })}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Close</Button></DialogClose>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Staff Dialog */}
      <Dialog open={addStaffOpen} onOpenChange={setAddStaffOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" strokeWidth={1.5} />
              Add Staff Member
            </DialogTitle>
            <DialogDescription>
              Create a new account with a specific role. They can sign in immediately.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label className="label-ui mb-1.5 flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5" strokeWidth={1.5} />
                Display Name
              </Label>
              <Input
                value={newStaff.display_name}
                onChange={e => setNewStaff(p => ({ ...p, display_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label className="label-ui mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" strokeWidth={1.5} />
                Email
              </Label>
              <Input
                type="email"
                value={newStaff.email}
                onChange={e => setNewStaff(p => ({ ...p, email: e.target.value }))}
                placeholder="staff@restaurant.com"
              />
            </div>
            <div>
              <Label className="label-ui mb-1.5 flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" strokeWidth={1.5} />
                Password
              </Label>
              <Input
                type="password"
                value={newStaff.password}
                onChange={e => setNewStaff(p => ({ ...p, password: e.target.value }))}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <Label className="label-ui mb-1.5 flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
                Role
              </Label>
              <Select value={newStaff.role} onValueChange={v => setNewStaff(p => ({ ...p, role: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a role…" />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map(r => (
                    <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button
              onClick={() => createStaff.mutate()}
              disabled={createStaff.isPending || !newStaff.email.trim() || !newStaff.password}
              className="gap-1.5"
            >
              {createStaff.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}
              Create Staff
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
