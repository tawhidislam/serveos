import { useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentRestaurant } from '@/hooks/useCurrentRestaurant';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, Plus, Pencil, Trash2, MapPin, Phone,
  Loader2, Check, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import PlanLimitNotice, { usePlanLimitGate } from '@/components/PlanLimitNotice';

type Branch = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
};

export default function BranchManagement() {
  const qc = useQueryClient();
  const { data: restaurant } = useCurrentRestaurant();
  const restaurantId = restaurant?.id;
  const [editBranch, setEditBranch] = useState<Branch | null>(null);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [deleteBranch, setDeleteBranch] = useState<Branch | null>(null);
  const { disabled: limitReached, reason: limitReason } = usePlanLimitGate('maxBranches', 'branches');

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ['branches', restaurantId ?? 'none'],
    enabled: !!restaurantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('restaurant_id', restaurantId!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as unknown as Branch[];
    },
  });

  const saveBranch = useMutation({
    mutationFn: async (branch: { id?: string; name: string; address: string | null; phone: string | null }) => {
      if (branch.id) {
        const { error } = await supabase.from('branches')
          .update({ name: branch.name, address: branch.address, phone: branch.phone })
          .eq('id', branch.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('branches')
          .insert({ name: branch.name, address: branch.address, phone: branch.phone, restaurant_id: restaurantId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      closeForm();
      toast.success(editBranch ? 'Branch updated' : 'Branch created');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('branches').update({ is_active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['branches'] }),
    onError: (e: any) => toast.error(e.message),
  });

  const removeBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setDeleteBranch(null);
      toast.success('Branch deleted');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditBranch(null);
    setCreating(true);
    setFormName('');
    setFormAddress('');
    setFormPhone('');
  };

  const openEdit = (b: Branch) => {
    setEditBranch(b);
    setCreating(true);
    setFormName(b.name);
    setFormAddress(b.address ?? '');
    setFormPhone(b.phone ?? '');
  };

  const closeForm = () => {
    setCreating(false);
    setEditBranch(null);
  };

  const handleSave = () => {
    if (!formName.trim()) { toast.error('Name is required'); return; }
    saveBranch.mutate({
      id: editBranch?.id,
      name: formName.trim(),
      address: formAddress.trim() || null,
      phone: formPhone.trim() || null,
    });
  };

  return (
    <AdminLayout title="Branch Management" subtitle={`${branches.length} branch${branches.length !== 1 ? 'es' : ''}`}>
      <div className="p-4 lg:p-6 max-w-3xl space-y-3">
        <PlanLimitNotice limitKey="maxBranches" resource="branches" />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={openCreate}
            className="gap-1"
            disabled={limitReached}
            title={limitReason}
          >
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Add Branch
          </Button>
        </div>
        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
          </div>
        ) : branches.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" strokeWidth={1} />
            <p>No branches yet</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {branches.map((branch, i) => (
              <motion.div
                key={branch.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: i * 0.03 }}
                className={`bg-card card-shadow ring-subtle rounded-lg p-4 ${!branch.is_active ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
                      <span className="font-semibold text-card-foreground">{branch.name}</span>
                      {!branch.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactive</span>
                      )}
                    </div>
                    {branch.address && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3" strokeWidth={1.5} />
                        {branch.address}
                      </p>
                    )}
                    {branch.phone && (
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Phone className="h-3 w-3" strokeWidth={1.5} />
                        {branch.phone}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch
                      checked={branch.is_active}
                      onCheckedChange={v => toggleActive.mutate({ id: branch.id, is_active: v })}
                    />
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(branch)}>
                      <Pencil className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteBranch(branch)}>
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={creating} onOpenChange={o => !o && closeForm()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBranch ? 'Edit Branch' : 'New Branch'}</DialogTitle>
            <DialogDescription>
              {editBranch ? 'Update branch details.' : 'Add a new restaurant branch.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Branch Name *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Downtown Branch" maxLength={100} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Address</Label>
              <Input value={formAddress} onChange={e => setFormAddress(e.target.value)} placeholder="123 Main St" maxLength={200} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Phone</Label>
              <Input value={formPhone} onChange={e => setFormPhone(e.target.value)} placeholder="+1 234 567 8900" maxLength={20} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button onClick={handleSave} disabled={saveBranch.isPending}>
              {saveBranch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : editBranch ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteBranch} onOpenChange={o => !o && setDeleteBranch(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Branch</DialogTitle>
            <DialogDescription>
              This will permanently delete "{deleteBranch?.name}". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            <Button variant="destructive" onClick={() => deleteBranch && removeBranch.mutate(deleteBranch.id)} disabled={removeBranch.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
