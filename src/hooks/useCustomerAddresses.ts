import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentCustomer } from '@/hooks/useCurrentCustomer';
import { toast } from 'sonner';

export interface CustomerAddress {
  id: string;
  restaurant_id: string;
  customer_id: string;
  label: string;
  address: string;
  instructions: string | null;
  phone: string | null;
  is_default: boolean;
  created_at: string;
}

export interface AddressInput {
  label: string;
  address: string;
  instructions?: string | null;
  phone?: string | null;
  is_default?: boolean;
}

/**
 * Saved delivery addresses for the signed-in guest at a given restaurant.
 * Returns an empty list (and disabled mutations) for guests without an account.
 */
export function useCustomerAddresses(restaurantId: string | null | undefined) {
  const qc = useQueryClient();
  const { data: customer } = useCurrentCustomer(restaurantId);
  const customerId = customer?.id ?? null;
  const key = ['customer-addresses', restaurantId, customerId];

  const list = useQuery({
    queryKey: key,
    enabled: !!restaurantId && !!customerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('customer_addresses')
        .select('*')
        .eq('customer_id', customerId!)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as CustomerAddress[];
    },
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const clearDefaults = async () => {
    if (!customerId) return;
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);
  };

  const saveAddress = useMutation({
    mutationFn: async ({ id, ...input }: AddressInput & { id?: string }) => {
      if (!customerId || !restaurantId) throw new Error('Sign in to save addresses');
      if (input.is_default) await clearDefaults();
      if (id) {
        const { error } = await supabase
          .from('customer_addresses')
          .update({
            label: input.label,
            address: input.address,
            instructions: input.instructions ?? null,
            phone: input.phone ?? null,
            is_default: !!input.is_default,
          })
          .eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('customer_addresses').insert({
          restaurant_id: restaurantId,
          customer_id: customerId,
          label: input.label,
          address: input.address,
          instructions: input.instructions ?? null,
          phone: input.phone ?? null,
          is_default: !!input.is_default,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidate(); toast.success('Address saved'); },
    onError: (e: any) => toast.error(e.message || 'Could not save address'),
  });

  const deleteAddress = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('customer_addresses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { invalidate(); toast.success('Address removed'); },
    onError: (e: any) => toast.error(e.message || 'Could not remove address'),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await clearDefaults();
      const { error } = await supabase
        .from('customer_addresses')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    addresses: list.data ?? [],
    isLoading: list.isLoading,
    canSave: !!customerId && !!restaurantId,
    saveAddress,
    deleteAddress,
    setDefault,
  };
}
