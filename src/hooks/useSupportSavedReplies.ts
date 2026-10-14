import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { SupportSavedReply } from '@/lib/support';

const KEY = ['support-saved-replies'];

export function useSupportSavedReplies() {
  return useQuery<SupportSavedReply[]>({
    queryKey: KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('support_saved_replies').select('*').order('title');
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useSaveSupportReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reply: { id?: string; title: string; shortcut: string | null; body: string }) => {
      const row = { title: reply.title.trim(), shortcut: reply.shortcut?.trim() || null, body: reply.body.trim() };
      const { error } = reply.id
        ? await supabase.from('support_saved_replies').update(row).eq('id', reply.id)
        : await supabase.from('support_saved_replies').insert(row);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useDeleteSupportReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('support_saved_replies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

/** Fill placeholders in a saved reply. */
export function fillSavedReply(body: string, vars: { name?: string | null }) {
  return body.replace(/\{name\}/g, vars.name?.trim() || 'there');
}
