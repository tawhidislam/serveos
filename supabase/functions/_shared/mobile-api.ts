export type StaffRole = 'owner' | 'admin' | 'manager' | 'kitchen' | 'waiter' | 'server';
export const ADMIN_ROLES: StaffRole[] = ['owner', 'admin', 'manager'];
export const SERVICE_ROLES: StaffRole[] = ['owner', 'admin', 'manager', 'waiter', 'server'];
export const STAFF_ROLES: StaffRole[] = [...SERVICE_ROLES, 'kitchen'];
export class ApiError extends Error { constructor(public status: number, public code: string, message: string) { super(message); } }
export const uuid = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function requireUuid(value: unknown, label = 'id') { if (!uuid(value)) throw new ApiError(400, 'INVALID_ID', `A valid ${label} is required.`); return value; }
export function record(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ApiError(400, 'INVALID_BODY', 'A JSON object is required.'); return value as Record<string, unknown>; }
export function allowFields(body: Record<string, unknown>, fields: string[]) { const unexpected = Object.keys(body).filter(key => !fields.includes(key)); if (unexpected.length) throw new ApiError(400, 'UNKNOWN_FIELDS', `Unsupported fields: ${unexpected.join(', ')}`); }
export function text(value: unknown, name: string, max = 4000, required = false) { if (value == null && !required) return null; if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new ApiError(400, 'INVALID_INPUT', `Invalid ${name}.`); return value.trim(); }
export function pagination(params: URLSearchParams) { const limit = Number(params.get('limit') ?? 50), offset = Number(params.get('offset') ?? 0); if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0 || offset > 10000) throw new ApiError(400, 'INVALID_PAGINATION', 'limit must be 1–100; offset must be 0–10000.'); return { limit, offset }; }
export interface Resource { table: string; fields: string[]; read: StaffRole[]; write: StaffRole[]; feature?: string; branch?: boolean; filters?: string[]; refs?: Record<string, string>; required?: string[]; select?: string; singleton?: boolean; readOnly?: boolean; }
const resource = (table: string, fields: string, extra: Partial<Resource> = {}): Resource => ({ table, fields: fields.split(' ').filter(Boolean), read: ADMIN_ROLES, write: ADMIN_ROLES, ...extra });
export const RESOURCES: Record<string, Resource> = {
  branches: resource('branches', 'name address phone is_active', { read: STAFF_ROLES, write: ['owner', 'admin'], required: ['name'] }),
  categories: resource('categories', 'name sort_order branch_id', { read: STAFF_ROLES, branch: true, required: ['name'] }),
  'menu-items': resource('menu_items', 'category_id name description price is_available image_url branch_id sort_order prep_time_minutes custom_slug', { read: STAFF_ROLES, branch: true, refs: { category_id: 'categories' }, required: ['category_id', 'name', 'price'] }),
  'menu-addons': resource('menu_item_addons', 'menu_item_id name type required sort_order', { read: STAFF_ROLES, refs: { menu_item_id: 'menu_items' }, required: ['menu_item_id', 'name'] }),
  'menu-addon-options': resource('menu_item_addon_options', 'addon_id name price_modifier sort_order', { read: STAFF_ROLES, refs: { addon_id: 'menu_item_addons' }, required: ['addon_id', 'name'] }),
  'menu-images': resource('menu_item_images', 'menu_item_id image_url caption sort_order', { read: STAFF_ROLES, refs: { menu_item_id: 'menu_items' }, required: ['menu_item_id', 'image_url'] }),
  'customization-tags': resource('customization_tags', 'name category emoji color is_active sort_order', { read: STAFF_ROLES, required: ['name'] }),
  'menu-tags': resource('menu_item_tags', 'menu_item_id tag_id', { read: STAFF_ROLES, refs: { menu_item_id: 'menu_items', tag_id: 'customization_tags' }, required: ['menu_item_id', 'tag_id'] }),
  tables: resource('restaurant_tables', 'label capacity status qr_code_url branch_id floor_plan_id position_x position_y', { read: STAFF_ROLES, write: ADMIN_ROLES, branch: true, feature: 'operations', refs: { floor_plan_id: 'floor_plans' }, required: ['label'] }),
  'floor-plans': resource('floor_plans', 'name image_url sort_order is_active branch_id', { read: SERVICE_ROLES, branch: true, feature: 'floorPlans', required: ['name'] }),
  reservations: resource('reservations', 'guest_name email phone reservation_date reservation_time party_size notes status', { read: SERVICE_ROLES, write: SERVICE_ROLES, feature: 'operations', required: ['guest_name', 'reservation_date', 'reservation_time', 'party_size'] }),
  promotions: resource('promotions', 'name description type discount_value promo_code min_order_amount max_discount_amount max_uses max_uses_per_user applies_to applies_to_ids happy_hour_start happy_hour_end happy_hour_days is_first_order_only is_active starts_at ends_at branch_id', { branch: true, feature: 'promotions', required: ['name', 'type', 'discount_value'] }),
  customers: resource('restaurant_customers', 'display_name phone', { feature: 'loyalty', readOnly: true }),
  'loyalty-settings': resource('loyalty_settings', 'is_enabled earn_type points_per_order points_per_currency redemption_type point_value min_redeem_points redemption_tiers expiry_enabled expiry_days', { singleton: true, feature: 'loyalty' }),
  'loyalty-transactions': resource('loyalty_transactions', '', { feature: 'loyalty', readOnly: true, filters: ['customer_id', 'user_id', 'order_id', 'type'] }),
  'expense-categories': resource('expense_categories', 'name description icon color is_active branch_id', { branch: true, feature: 'accounting', required: ['name'] }),
  expenses: resource('expenses', 'category_id amount description vendor reference_number expense_date payment_method branch_id receipt_url is_recurring recurring_interval', { branch: true, feature: 'accounting', refs: { category_id: 'expense_categories' }, required: ['amount', 'expense_date'] }),
  'budget-alerts': resource('budget_alerts', 'category_id monthly_budget alert_threshold_pct branch_id is_active', { branch: true, feature: 'accounting', refs: { category_id: 'expense_categories' }, required: ['category_id', 'monthly_budget'] }),
  inventory: resource('inventory_items', 'name category unit min_stock cost_per_unit branch_id is_active', { branch: true, feature: 'accounting', required: ['name'] }),
  'inventory-transactions': resource('inventory_transactions', '', { branch: true, feature: 'accounting', readOnly: true, filters: ['item_id', 'type'] }),
  'inventory-adjustments': resource('inventory_adjustments', '', { branch: true, feature: 'accounting', readOnly: true, filters: ['item_id', 'reason'] }),
  'menu-ingredients': resource('menu_item_ingredients', 'menu_item_id inventory_item_id quantity_per_unit branch_id', { branch: true, feature: 'accounting', refs: { menu_item_id: 'menu_items', inventory_item_id: 'inventory_items' }, required: ['menu_item_id', 'inventory_item_id', 'quantity_per_unit'] }),
  suppliers: resource('suppliers', 'name contact_name phone email notes is_active branch_id', { branch: true, feature: 'accounting', required: ['name'] }),
  'stock-receipts': resource('stock_receipts', '', { branch: true, feature: 'accounting', readOnly: true }),
  'stock-receipt-lines': resource('stock_receipt_lines', '', { feature: 'accounting', readOnly: true, filters: ['receipt_id', 'item_id'] }),
  shifts: resource('employee_shifts', 'user_id shift_date start_time end_time hours_worked hourly_rate branch_id notes status', { branch: true, feature: 'accounting', required: ['user_id', 'shift_date'] }),
  tips: resource('employee_tips', 'user_id tip_date amount source order_id branch_id notes', { branch: true, feature: 'accounting', refs: { order_id: 'orders' }, required: ['user_id', 'amount'] }),
  payroll: resource('payroll_records', 'user_id period_start period_end base_pay tips_total bonuses deductions status notes branch_id', { branch: true, feature: 'accounting', required: ['user_id', 'period_start', 'period_end', 'base_pay'] }),
  'cash-drawers': resource('cash_drawer_sessions', 'opening_balance closing_balance cash_in cash_out notes status branch_id', { branch: true, feature: 'operations', required: ['opening_balance'] }),
  settings: resource('restaurant_settings', 'restaurant_name logo_url tax_percentage currency qr_ordering_enabled primary_color accent_color tagline qr_template qr_color_overrides homepage_template delivery_enabled pickup_enabled delivery_fee free_delivery_min delivery_min_order delivery_eta_minutes pickup_eta_minutes delivery_area_note contact_phone address order_page_template order_page_logo_url order_page_primary_color order_page_header_text order_page_subtext', { read: ADMIN_ROLES, singleton: true }),
  homepage: resource('homepage_content', 'section_key content', { required: ['section_key', 'content'] }),
  'custom-domains': resource('restaurant_custom_domains', 'domain label', { write: ['owner'], feature: 'customDomain', required: ['domain'] }),
  'domain-requests': resource('custom_domain_requests', 'requested_domain message', { write: ['owner'], feature: 'customDomain', required: ['requested_domain'] }),
  'staff-branches': resource('staff_branches', 'user_id branch_id', { write: ['owner', 'admin'], branch: true, refs: { branch_id: 'branches' }, required: ['user_id', 'branch_id'] }),
  'qr-short-links': resource('qr_short_links', 'code table_id label is_active', { write: ['owner', 'admin'], feature: 'operations', refs: { table_id: 'restaurant_tables' }, required: ['code'] }),
  'qr-scans': resource('qr_scans', '', { feature: 'operations', readOnly: true, filters: ['short_link_id', 'table_id'] }),
  'cta-clicks': resource('cta_clicks', '', { readOnly: true, filters: ['destination_type', 'source', 'fulfillment'] }),
};
/** Validate additions and existing lines without accepting client-supplied prices. */
export function validateOrderItems(value: unknown, editing = false) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) throw new ApiError(400, 'INVALID_ITEMS', 'An order needs 1 to 100 items.');
  for (const entry of value) {
    const item = record(entry), existing = editing && item.id != null;
    allowFields(item, existing ? ['id', 'quantity', 'notes'] : ['menu_item_id', 'quantity', 'notes', 'selected_tags', 'addon_option_ids']);
    requireUuid(existing ? item.id : item.menu_item_id, existing ? 'order_item_id' : 'menu_item_id');
    if (!Number.isInteger(item.quantity) || Number(item.quantity) < (existing ? 0 : 1) || Number(item.quantity) > 100) throw new ApiError(400, 'INVALID_QUANTITY', `Quantity must be ${existing ? '0' : '1'}–100.`);
    if (item.notes != null) text(item.notes, 'notes', 4000);
    for (const field of ['selected_tags', 'addon_option_ids']) if (item[field] != null) {
      if (!Array.isArray(item[field]) || (item[field] as unknown[]).length > 30) throw new ApiError(400, 'INVALID_ITEMS', `Invalid ${field}.`);
      for (const selected of item[field] as unknown[]) requireUuid(selected, field);
    }
  }
}
export function kitchenOrder(value: Record<string, unknown>) {
  const result = Object.fromEntries(['id','restaurant_id','branch_id','table_id','status','order_type','ticket_number','notes','created_at','updated_at','restaurant_tables'].filter(key => key in value).map(key => [key, value[key]]));
  if (Array.isArray(value.order_items)) result.order_items = value.order_items.map(entry => kitchenOrderItem(record(entry)));
  return result;
}
export function kitchenOrderItem(value: Record<string, unknown>) {
  const result = Object.fromEntries(['id','order_id','menu_item_id','quantity','notes','status','selected_tags','menu_items'].filter(key => key in value).map(key => [key,value[key]]));
  if (Array.isArray(value.selected_addons)) result.selected_addons = value.selected_addons.map(entry => { const addon = record(entry); return Object.fromEntries(['option_id','addon_name','name'].filter(key=>key in addon).map(key=>[key,addon[key]])); });
  return result;
}
export function validateResourceBody(config: Resource, value: unknown, creating: boolean) {
  const body = record(value); allowFields(body, config.fields); if (!Object.keys(body).length) throw new ApiError(400, 'EMPTY_BODY', 'At least one writable field is required.');
  if (creating) for (const key of config.required ?? []) if (body[key] == null || body[key] === '') throw new ApiError(400, 'MISSING_FIELD', `${key} is required.`);
  for (const [key, value] of Object.entries(body)) {
    if (key.endsWith('_id') && value != null) requireUuid(value, key);
    if (key==='currency' && (typeof value!=='string' || !/^[A-Z]{3}$/.test(value))) throw new ApiError(400,'INVALID_INPUT','currency must be a three-letter ISO code.');
    if (['tax_percentage','alert_threshold_pct'].includes(key) && typeof value==='number' && value>100) throw new ApiError(400,'INVALID_INPUT',`${key} must not exceed 100.`);
    if (['party_size','capacity'].includes(key) && (!Number.isInteger(value) || Number(value)<1)) throw new ApiError(400,'INVALID_INPUT',`${key} must be a positive integer.`);
    if (typeof value === 'string' && value.length > 6000) throw new ApiError(400, 'INVALID_INPUT', `${key} is too long.`);
    if (/^(amount|price|price_modifier|capacity|party_size|cost_per_unit|min_stock|monthly_budget|quantity_per_unit|opening_balance|closing_balance|cash_in|cash_out|hours_worked|hourly_rate|base_pay|tips_total|bonuses|deductions|tax_percentage|discount_value|delivery_fee)$/.test(key) && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new ApiError(400, 'INVALID_INPUT', `${key} must be a non-negative number.`);
    if ((key.startsWith('is_') || key.endsWith('_enabled') || key === 'required') && typeof value !== 'boolean') throw new ApiError(400, 'INVALID_INPUT', `${key} must be boolean.`);
    if (['image_url', 'logo_url', 'receipt_url', 'qr_code_url', 'order_page_logo_url'].includes(key) && value != null && (typeof value !== 'string' || (!value.startsWith('/') && !/^https?:\/\//i.test(value)))) throw new ApiError(400, 'INVALID_INPUT', `${key} must be an HTTP URL or absolute path.`);
  }
  return body;
}
export function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`; if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson((value as Record<string, unknown>)[k])}`).join(',')}}`; return JSON.stringify(value); }
