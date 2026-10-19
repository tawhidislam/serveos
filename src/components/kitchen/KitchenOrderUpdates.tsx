import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function KitchenOrderUpdates({ restaurantId, order, onClose, canSend = false }: {
  restaurantId: string; order: { id: string; status: string; label: string; dueAt?: string | null }; onClose: () => void; canSend?: boolean;
}) {
  const client = useQueryClient();
  const [message, setMessage] = useState('');
  const thread = useQuery({
    queryKey: ['kitchen_thread', restaurantId, order.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('kitchen_updates').select('*').eq('restaurant_id', restaurantId).eq('order_id', order.id).order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      return data;
    }, refetchInterval: 5000,
  });
  const send = useMutation({
    mutationFn: async ({ text, extra }: { text: string; extra?: number }) => {
      const { error } = await supabase.rpc('kitchen_send_update', { _restaurant: restaurantId, _order: order.id, _message: text, ...extra ? { _extra_minutes: extra } : {} });
      if (error) throw error;
    },
    onSuccess: () => {
      setMessage('');
      void client.invalidateQueries({ queryKey: ['kitchen_thread', restaurantId] });
      void client.invalidateQueries({ queryKey: ['kitchen_updates', restaurantId] });
      void client.invalidateQueries({ queryKey: ['kitchen_orders', restaurantId] });
      toast.success('Update sent to waiters');
    }, onError: (error: Error) => toast.error(error.message),
  });
  const active = ['pending', 'confirmed', 'preparing', 'ready'].includes(order.status);
  return (
    <Dialog open onOpenChange={open => !open && !send.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Kitchen updates · {order.label}</DialogTitle><DialogDescription>{canSend ? 'Send a preparation update to the waiter panel for this order.' : 'Updates from the kitchen for this order.'}</DialogDescription></DialogHeader>
        {canSend && active && <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="min-h-11" disabled={send.isPending || order.status !== 'preparing' || !order.dueAt} onClick={() => send.mutate({ text: 'Please allow five more minutes.', extra: 5 })}>5 more minutes</Button>
            <Button variant="outline" className="min-h-11" disabled={send.isPending} onClick={() => setMessage('An item is unavailable. Please check with the kitchen for an alternative.')}>Item unavailable</Button>
          </div>
          <p className="text-xs text-muted-foreground">“5 more minutes” adds five minutes to the current ETA, or from now if overdue.</p>
          <label className="block space-y-2 text-sm font-medium">Message to waiter<Textarea aria-label="Message to waiter" maxLength={500} value={message} onChange={event => setMessage(event.target.value)} placeholder="e.g. Grilled chicken needs five more minutes…" /></label>
          <div className="flex items-center justify-between gap-3"><span className="text-xs text-muted-foreground">{message.length}/500</span><Button className="min-h-11" disabled={send.isPending || !message.trim()} onClick={() => send.mutate({ text: message.trim() })}>{send.isPending ? 'Sending…' : 'Send update'}</Button></div>
        </div>}
        <div className="space-y-3 border-t pt-4" aria-label="Kitchen message history">
          {thread.isPending ? <p role="status" className="text-sm text-muted-foreground">Loading updates…</p> : thread.isError ? <div role="alert"><p>Couldn’t load updates.</p><Button variant="outline" onClick={() => void thread.refetch()}>Retry</Button></div> : thread.data.length === 0 ? <p className="text-sm text-muted-foreground">No kitchen updates yet.</p> : <>{thread.data.map(update => <div key={update.id} className="rounded-xl bg-secondary/50 p-3"><p className="whitespace-pre-wrap break-words text-sm">{update.message}</p><p className="mt-2 text-xs text-muted-foreground">Kitchen · {format(new Date(update.created_at), 'MMM d, HH:mm')}{update.extra_minutes ? ` · ETA +${update.extra_minutes} min` : ''}</p></div>)}{thread.data.length === 50 && <p className="text-xs text-muted-foreground">Showing the latest 50 updates.</p>}</>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
