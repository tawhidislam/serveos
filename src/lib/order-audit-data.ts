/**
 * Order-query audit dataset.
 *
 * Static index of every place in the app that reads or writes the
 * `orders` / `order_items` tables, classified by:
 *   - `op`            — supabase verb used at the call site
 *   - `tenantScope`   — how the call is constrained to one restaurant
 *   - `severity`      — `ok` (safe), `warn` (review), `error` (unsafe)
 *
 * Keep this list in sync when you add or move order queries.
 * The `/admin/order-audit` page renders this dataset alongside a
 * live database probe for orphan or cross-tenant rows.
 */

export type OrderOp = 'select' | 'insert' | 'update' | 'delete';
export type OrderSeverity = 'ok' | 'info' | 'warn' | 'error';
export type OrderTenantScope =
  | 'restaurant_id_filter'   // .eq('restaurant_id', restaurantId)
  | 'order_id_scoped'        // operates on a single order/order_items by id
  | 'parent_join_filter'     // joined through orders!inner with restaurant_id filter
  | 'rls_only'               // relies on RLS without explicit filter
  | 'platform_global'        // intentionally cross-tenant (platform admin)
  | 'public_lookup';         // single-row lookup by id (e.g. status page)

export interface OrderAuditEntry {
  file: string;
  line: number;
  route: string;
  area: 'admin' | 'staff' | 'customer' | 'platform' | 'shared' | 'accounting';
  table: 'orders' | 'order_items';
  op: OrderOp;
  tenantScope: OrderTenantScope;
  severity: OrderSeverity;
  notes: string;
}

export const ORDER_AUDIT_ENTRIES: OrderAuditEntry[] = [
  // ─── Admin ─────────────────────────────────────────────────────────────
  { file: 'src/pages/AdminDashboard.tsx', line: 46, route: '/admin', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Dashboard totals scoped via .eq(restaurant_id, restaurantId).' },
  { file: 'src/pages/AdminDashboard.tsx', line: 48, route: '/admin', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Today metrics scoped on restaurant_id.' },
  { file: 'src/pages/AdminDashboard.tsx', line: 50, route: '/admin', area: 'admin',
    table: 'order_items', op: 'select', tenantScope: 'parent_join_filter', severity: 'ok',
    notes: 'order_items joined via orders!inner with restaurant_id filter.' },
  { file: 'src/pages/AdminOrders.tsx', line: 118, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Main orders list filters on restaurant_id.' },
  { file: 'src/pages/AdminOrders.tsx', line: 146, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Detail items fetched by order_id; orders RLS already isolates tenant.' },
  { file: 'src/pages/AdminOrders.tsx', line: 188, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Status update on a row already loaded under tenant filter; RLS blocks foreign rows.' },
  { file: 'src/pages/AdminOrders.tsx', line: 200, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Settle / payment update — RLS enforces restaurant_id match.' },
  { file: 'src/pages/AdminOrders.tsx', line: 222, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Item lookup for split flow, by order_id.' },
  { file: 'src/pages/AdminOrders.tsx', line: 229, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Move items to merge target; RLS enforces tenant on parent order.' },
  { file: 'src/pages/AdminOrders.tsx', line: 235, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Total recalc after merge; RLS enforces tenant.' },
  { file: 'src/pages/AdminOrders.tsx', line: 239, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Cancel source orders after merge using .in(id, sourceIds) loaded under tenant filter.' },
  { file: 'src/pages/AdminOrders.tsx', line: 261, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'insert', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Split-bill insert now sets restaurant_id explicitly (verified).' },
  { file: 'src/pages/AdminOrders.tsx', line: 275, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Re-parents items to the new split order; RLS enforces tenant on parent.' },
  { file: 'src/pages/AdminOrders.tsx', line: 283, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items lookup to recompute totals.' },
  { file: 'src/pages/AdminOrders.tsx', line: 289, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Total update post-split.' },
  { file: 'src/pages/AdminOrders.tsx', line: 311, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Notes update by id; RLS check blocks foreign tenants.' },
  { file: 'src/pages/AdminOrders.tsx', line: 326, route: '/admin/orders', area: 'admin',
    table: 'order_items', op: 'delete', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Delete items by order_id before deleting the order.' },
  { file: 'src/pages/AdminOrders.tsx', line: 329, route: '/admin/orders', area: 'admin',
    table: 'orders', op: 'delete', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Order delete by id, gated by RLS DELETE policy on restaurant_id.' },

  // ─── Staff ─────────────────────────────────────────────────────────────
  { file: 'src/pages/KitchenPage.tsx', line: 178, route: '/kitchen', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Active tickets list scoped on restaurant_id.' },
  { file: 'src/pages/KitchenPage.tsx', line: 264, route: '/kitchen', area: 'staff',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Status transition by order id; RLS enforces tenant.' },
  { file: 'src/pages/WaiterDashboard.tsx', line: 140, route: '/waiter', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Active orders list scoped on restaurant_id.' },
  { file: 'src/pages/WaiterDashboard.tsx', line: 156, route: '/waiter', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Served history scoped on restaurant_id.' },
  { file: 'src/pages/WaiterDashboard.tsx', line: 247, route: '/waiter', area: 'staff',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Status update by id; RLS enforces tenant.' },
  { file: 'src/pages/WaiterDashboard.tsx', line: 259, route: '/waiter', area: 'staff',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Table reassignment by id; RLS enforces tenant.' },
  { file: 'src/pages/WaiterHistory.tsx', line: 20, route: '/waiter/history', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Waiter history filters on restaurant_id.' },
  { file: 'src/pages/BillingPage.tsx', line: 85, route: '/billing', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Billing list scoped on restaurant_id.' },
  { file: 'src/pages/BillingPage.tsx', line: 112, route: '/billing', area: 'staff',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items for selected order.' },
  { file: 'src/pages/BillingPage.tsx', line: 128, route: '/billing', area: 'staff',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Mark paid / settle by id; RLS enforces tenant.' },
  { file: 'src/pages/BillingPage.tsx', line: 487, route: '/billing', area: 'staff',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Receipt items lookup.' },
  { file: 'src/pages/POSPage.tsx', line: 148, route: '/pos', area: 'staff',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Open POS tabs scoped on restaurant_id.' },
  { file: 'src/pages/POSPage.tsx', line: 179, route: '/pos', area: 'staff',
    table: 'orders', op: 'insert', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'POS order insert sets restaurant_id explicitly.' },
  { file: 'src/pages/POSPage.tsx', line: 204, route: '/pos', area: 'staff',
    table: 'order_items', op: 'insert', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items inserted with order_id of a freshly-created tenant order.' },
  { file: 'src/pages/TableManagement.tsx', line: 115, route: '/admin/tables', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Active orders per table scoped on restaurant_id.' },
  { file: 'src/components/waiter/ModifyOrderDialog.tsx', line: 173, route: '—', area: 'staff',
    table: 'order_items', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Cancel item by id; RLS enforces tenant via parent order.' },
  { file: 'src/components/waiter/ModifyOrderDialog.tsx', line: 183, route: '—', area: 'staff',
    table: 'order_items', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Quantity edit by id; RLS enforces tenant.' },
  { file: 'src/components/waiter/ModifyOrderDialog.tsx', line: 191, route: '—', area: 'staff',
    table: 'order_items', op: 'insert', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'New item inserted with order_id; RLS enforces tenant via parent.' },
  { file: 'src/components/waiter/ModifyOrderDialog.tsx', line: 204, route: '—', area: 'staff',
    table: 'orders', op: 'update', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Total recalc after item edit.' },

  // ─── Customer ──────────────────────────────────────────────────────────
  { file: 'src/pages/MenuPage.tsx', line: 231, route: '/menu', area: 'customer',
    table: 'orders', op: 'insert', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Customer order insert sets restaurant_id from active context.' },
  { file: 'src/pages/MenuPage.tsx', line: 255, route: '/menu', area: 'customer',
    table: 'order_items', op: 'insert', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items inserted with newly-created order_id.' },
  { file: 'src/pages/TableOrderPage.tsx', line: 121, route: '/table/:tableId', area: 'customer',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Open orders for the table filtered by table\'s restaurant_id.' },
  { file: 'src/pages/TableOrderPage.tsx', line: 249, route: '/table/:tableId', area: 'customer',
    table: 'orders', op: 'insert', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Insert now sets restaurant_id from the table\'s tenant (verified).' },
  { file: 'src/pages/TableOrderPage.tsx', line: 270, route: '/table/:tableId', area: 'customer',
    table: 'order_items', op: 'insert', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items inserted with new order_id; RLS enforces tenant via parent.' },
  { file: 'src/pages/OrderHistory.tsx', line: 54, route: '/order-history', area: 'customer',
    table: 'orders', op: 'select', tenantScope: 'rls_only', severity: 'ok',
    notes: 'Customer\'s own orders — RLS limits by user_id; cross-tenant by design (a customer can order at multiple restaurants).' },
  { file: 'src/pages/OrderStatusPage.tsx', line: 25, route: '/order-status/:orderId', area: 'customer',
    table: 'orders', op: 'select', tenantScope: 'public_lookup', severity: 'info',
    notes: 'Single-row lookup by order id; RLS gates access to the row.' },
  { file: 'src/pages/OrderStatusPage.tsx', line: 36, route: '/order-status/:orderId', area: 'customer',
    table: 'order_items', op: 'select', tenantScope: 'order_id_scoped', severity: 'ok',
    notes: 'Items by order_id; RLS gates the parent order.' },

  // ─── Accounting / analytics ───────────────────────────────────────────
  { file: 'src/pages/owner/OwnerDashboard.tsx', line: 28, route: '/owner', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Owner stat counts scoped on restaurant_id.' },
  { file: 'src/pages/owner/OwnerAnalytics.tsx', line: 18, route: '/owner/analytics', area: 'admin',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Analytics queries filter on restaurant_id.' },
  { file: 'src/pages/accounting/AccountingOverviewPage.tsx', line: 108, route: '/accounting', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Overview range scoped on restaurant_id.' },
  { file: 'src/pages/accounting/AccountingOverviewPage.tsx', line: 163, route: '/accounting', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Comparison range scoped on restaurant_id.' },
  { file: 'src/pages/accounting/MonthlyReportPage.tsx', line: 83, route: '/accounting/monthly', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Monthly report scoped on restaurant_id.' },
  { file: 'src/pages/accounting/SalesRevenuePage.tsx', line: 76, route: '/accounting/sales', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Sales totals scoped on restaurant_id.' },
  { file: 'src/pages/accounting/SalesRevenuePage.tsx', line: 98, route: '/accounting/sales', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Sales detail scoped on restaurant_id.' },
  { file: 'src/pages/accounting/ProfitLossPage.tsx', line: 68, route: '/accounting/p-l', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'P&L scoped on restaurant_id.' },
  { file: 'src/pages/accounting/TaxReportingPage.tsx', line: 60, route: '/accounting/tax', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Tax report scoped on restaurant_id.' },
  { file: 'src/pages/accounting/TaxReportingPage.tsx', line: 77, route: '/accounting/tax', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Tax detail scoped on restaurant_id.' },
  { file: 'src/pages/accounting/FinancialForecastingPage.tsx', line: 70, route: '/accounting/forecast', area: 'accounting',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Forecast input scoped on restaurant_id.' },

  // ─── Platform-global (intentional) ────────────────────────────────────
  { file: 'src/pages/platform/PlatformOverview.tsx', line: 20, route: '/platform', area: 'platform',
    table: 'orders', op: 'select', tenantScope: 'platform_global', severity: 'info',
    notes: 'Platform-wide order count — intentionally cross-tenant; RLS gated by is_platform_admin().' },
  { file: 'src/pages/platform/PlatformOverview.tsx', line: 21, route: '/platform', area: 'platform',
    table: 'orders', op: 'select', tenantScope: 'platform_global', severity: 'info',
    notes: 'Platform-wide GMV — intentionally cross-tenant.' },
  { file: 'src/pages/platform/PlatformOverview.tsx', line: 68, route: '/platform', area: 'platform',
    table: 'orders', op: 'select', tenantScope: 'platform_global', severity: 'info',
    notes: 'Platform recent activity — intentionally cross-tenant.' },
  { file: 'src/pages/platform/PlatformOrders.tsx', line: 12, route: '/platform/orders', area: 'platform',
    table: 'orders', op: 'select', tenantScope: 'platform_global', severity: 'info',
    notes: 'Platform orders explorer — intentionally cross-tenant.' },

  // ─── Demo / marketing ─────────────────────────────────────────────────
  { file: 'src/pages/marketing/MarketingDemo.tsx', line: 763, route: '/demo', area: 'shared',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Demo dashboard preview scoped to demo restaurant_id.' },
  { file: 'src/pages/marketing/MarketingDemo.tsx', line: 780, route: '/demo', area: 'shared',
    table: 'orders', op: 'select', tenantScope: 'restaurant_id_filter', severity: 'ok',
    notes: 'Demo dashboard preview scoped to demo restaurant_id.' },
  { file: 'src/pages/marketing/MarketingDemo.tsx', line: 797, route: '/demo', area: 'shared',
    table: 'order_items', op: 'select', tenantScope: 'parent_join_filter', severity: 'ok',
    notes: 'Demo preview joins through orders!inner with restaurant_id filter.' },
];

/**
 * Convenience helpers for the audit page UI.
 */
export const ORDER_AUDIT_TABLES = ['orders', 'order_items'] as const;

export function summarizeOrderAudit(entries: OrderAuditEntry[]) {
  return {
    total: entries.length,
    ok: entries.filter(e => e.severity === 'ok').length,
    info: entries.filter(e => e.severity === 'info').length,
    warn: entries.filter(e => e.severity === 'warn').length,
    error: entries.filter(e => e.severity === 'error').length,
    inserts: entries.filter(e => e.op === 'insert').length,
    mutations: entries.filter(e => e.op !== 'select').length,
  };
}