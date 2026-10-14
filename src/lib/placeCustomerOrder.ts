import { supabase } from '@/integrations/supabase/client';
import type { CartItem } from '@/stores/cartStore';

export interface PlaceCustomerOrderInput {
  restaurantId: string;
  items: CartItem[];
  tableId?: string | null;
  orderType?: 'dine_in' | 'pickup' | 'delivery';
  customerName?: string | null;
  customerPhone?: string | null;
  deliveryAddress?: string | null;
  deliveryInstructions?: string | null;
  promotionId?: string | null;
  loyaltyPoints?: number;
}

/**
 * Place a customer (non-staff) order. Pricing, add-ons, promotions and loyalty
 * points are all validated and recorded server-side by `place_customer_order`,
 * so the client only sends what was chosen — never prices or discounts.
 * Returns the new order id.
 */
export async function placeCustomerOrder(input: PlaceCustomerOrderInput): Promise<string> {
  let timezone = 'UTC';
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch { /* keep UTC */ }

  const { data, error } = await supabase.rpc('place_customer_order', {
    _restaurant_id: input.restaurantId,
    _items: input.items.map(item => ({
      menu_item_id: item.menuItemId,
      quantity: item.quantity,
      notes: item.notes || null,
      selected_tags: item.selectedTags || [],
      addon_option_ids: (item.selectedAddons ?? []).map(a => a.optionId),
    })),
    _table_id: input.tableId ?? null,
    _order_type: input.orderType ?? 'dine_in',
    _customer_name: input.customerName ?? null,
    _customer_phone: input.customerPhone ?? null,
    _delivery_address: input.deliveryAddress ?? null,
    _delivery_instructions: input.deliveryInstructions ?? null,
    _promotion_id: input.promotionId ?? null,
    _loyalty_points: input.loyaltyPoints ?? 0,
    _client_timezone: timezone,
  });
  if (error) throw error;
  return data as string;
}
