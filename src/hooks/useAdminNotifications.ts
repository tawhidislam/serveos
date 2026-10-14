import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { playSoundPreset, getEventSoundPreset } from './useNotifications';

export interface AdminNotification {
  id: string;
  message: string;
  time: string;
  read: boolean;
  type: 'new_order' | 'status_change' | 'waiter_call' | 'low_stock';
  orderId?: string;
}


const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  served: 'Served',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function useAdminNotifications() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const initializedRef = useRef(false);

  // Mark a single notification as read
  const markAsRead = useCallback((id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  // Clear all
  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    // Skip first load to avoid flooding with existing data
    const initTimeout = setTimeout(() => {
      initializedRef.current = true;
    }, 3000);

    // Subscribe to order changes
    const ordersChannel = supabase
      .channel('admin-notif-orders')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders' },
        (payload) => {
          if (!initializedRef.current) return;
          const order = payload.new as any;
          const tableLabel = order.table_id ? `Table order` : 'New order';
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          playSoundPreset(getEventSoundPreset('newOrder'));

          setNotifications(prev => [
            {
              id: `order-new-${order.id}-${Date.now()}`,
              message: `${tableLabel} #${order.id.slice(0, 8)} received`,
              time: now,
              read: false,
              type: 'new_order' as const,
              orderId: order.id,
            },
            ...prev,
          ].slice(0, 50)); // Keep max 50 notifications
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          if (!initializedRef.current) return;
          const oldOrder = payload.old as any;
          const newOrder = payload.new as any;

          // Only notify on status changes
          if (oldOrder.status === newOrder.status) return;

          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const fromLabel = STATUS_LABELS[oldOrder.status] || oldOrder.status;
          const toLabel = STATUS_LABELS[newOrder.status] || newOrder.status;

          // Play sound for ready orders
          if (newOrder.status === 'ready') {
            playSoundPreset(getEventSoundPreset('orderReady'));
          }

          setNotifications(prev => [
            {
              id: `order-status-${newOrder.id}-${Date.now()}`,
              message: `Order #${newOrder.id.slice(0, 8)}: ${fromLabel} → ${toLabel}`,
              time: now,
              read: false,
              type: 'status_change' as const,
              orderId: newOrder.id,
            },
            ...prev,
          ].slice(0, 50));
        }
      )
      .subscribe();

    // Subscribe to waiter calls
    const waiterChannel = supabase
      .channel('admin-notif-waiter')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'waiter_calls' },
        (payload) => {
          if (!initializedRef.current) return;
          const call = payload.new as any;
          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          playSoundPreset(getEventSoundPreset('waiterCall'));

          setNotifications(prev => [
            {
              id: `waiter-call-${call.id}-${Date.now()}`,
              message: `Waiter requested at a table`,
              time: now,
              read: false,
              type: 'waiter_call' as const,
            },
            ...prev,
          ].slice(0, 50));
        }
      )
      .subscribe();

    // Subscribe to inventory stock changes → low-stock alerts
    const inventoryChannel = supabase
      .channel('admin-notif-inventory')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'inventory_items' },
        (payload) => {
          if (!initializedRef.current) return;
          const oldItem = payload.old as any;
          const item = payload.new as any;
          if (!item?.is_active) return;

          const threshold = Number(item.min_stock ?? 0);
          if (threshold <= 0) return;

          const current = Number(item.current_stock ?? 0);
          const previous = Number(oldItem?.current_stock ?? current);
          const wasLow = previous <= threshold;
          const isLow = current <= threshold;

          // Only alert when the item crosses below its configured threshold.
          if (!isLow || wasLow) return;

          const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          playSoundPreset(getEventSoundPreset('waiterCall'));

          setNotifications(prev => [
            {
              id: `low-stock-${item.id}-${Date.now()}`,
              message:
                current <= 0
                  ? `${item.name} is out of stock`
                  : `Low stock: ${item.name} — ${current} ${item.unit ?? ''} left (min ${threshold})`,
              time: now,
              read: false,
              type: 'low_stock' as const,
            },
            ...prev,
          ].slice(0, 50));
        }
      )
      .subscribe();

    return () => {
      clearTimeout(initTimeout);
      supabase.removeChannel(ordersChannel);
      supabase.removeChannel(waiterChannel);
      supabase.removeChannel(inventoryChannel);
    };
  }, []);


  return {
    notifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
