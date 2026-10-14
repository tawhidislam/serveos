/**
 * Tenant audit dataset — hand-curated from a static scan of every file
 * that calls `supabase.from(...)` in the app (45 files at time of writing).
 *
 * For each entry we record:
 *   - `file`   — source file containing the queries
 *   - `route`  — primary route or "—" for shared components
 *   - `area`   — grouping for UI sections
 *   - `tables` — Supabase tables touched
 *   - `scope`  — how tenant isolation is enforced for this file
 *   - `status` — `ok` / `warn` / `info`
 *   - `notes`  — short human-readable rationale
 *
 * Scope categories:
 *   - `restaurant_id_filter` — queries explicitly include `.eq('restaurant_id', …)`
 *   - `parent_scoped`        — child resource scoped via parent (e.g. menu_item_id)
 *                              and the parent's `restaurant_id` is included on insert
 *   - `rls_only`             — relies on RLS using `auth.uid()` mapping to a single tenant
 *   - `platform_global`      — platform-level data, not tenant-scoped (intended)
 *   - `public_anon`          — public read path, no tenant context required
 *
 * **This is documentation, not enforcement.** Updating a query without
 * updating this list will not fail the build. The audit page also runs
 * a small set of *live* probes against the active restaurant to surface
 * any rows whose `restaurant_id` is NULL or doesn't match.
 */

export type AuditStatus = 'ok' | 'warn' | 'info';
export type AuditScope =
  | 'restaurant_id_filter'
  | 'parent_scoped'
  | 'rls_only'
  | 'platform_global'
  | 'public_anon';

export interface AuditEntry {
  file: string;
  route: string;
  area: 'admin' | 'staff' | 'customer' | 'platform' | 'shared';
  tables: string[];
  scope: AuditScope;
  status: AuditStatus;
  notes: string;
}

export const AUDIT_ENTRIES: AuditEntry[] = [
  // ───── Admin dashboard ────────────────────────────────────────────────
  { file: 'src/pages/AdminDashboard.tsx', route: '/admin', area: 'admin',
    tables: ['orders', 'restaurant_tables'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'All metrics and lists filter by current restaurant_id.' },
  { file: 'src/pages/AdminOrders.tsx', route: '/admin/orders', area: 'admin',
    tables: ['orders', 'order_items'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Orders list and mutations are tenant-scoped; order_items inherit via order_id.' },
  { file: 'src/pages/MenuManagement.tsx', route: '/admin/menu', area: 'admin',
    tables: ['menu_items', 'categories'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Insert payload includes restaurant_id; all reads filter on it.' },
  { file: 'src/pages/AdminMenuItemDetail.tsx', route: '/admin/menu/:itemId', area: 'admin',
    tables: ['menu_items', 'categories'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Item lookup is by id; updates verified against current_restaurant_id.' },
  { file: 'src/pages/TableManagement.tsx', route: '/admin/tables', area: 'admin',
    tables: ['restaurant_tables'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Tenant-scoped CRUD.' },
  { file: 'src/pages/FloorPlanPage.tsx', route: '/admin/floor-plans', area: 'admin',
    tables: ['floor_plans', 'restaurant_tables'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Tenant-scoped CRUD.' },
  { file: 'src/pages/BranchManagement.tsx', route: '/admin/branches', area: 'admin',
    tables: ['branches'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Tenant-scoped CRUD.' },
  { file: 'src/pages/StaffManagement.tsx', route: '/admin/staff', area: 'admin',
    tables: ['user_roles', 'staff_branches'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Staff list scoped via restaurant_members + branches.' },
  { file: 'src/pages/PromotionsManagement.tsx', route: '/admin/promotions', area: 'admin',
    tables: ['promotions'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Insert payload includes restaurant_id; updates by id are RLS-enforced.' },
  { file: 'src/pages/CustomizationTagsManagement.tsx', route: '/admin/customizations', area: 'admin',
    tables: ['customization_tags'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Insert includes restaurant_id; updates by id RLS-enforced.' },
  { file: 'src/pages/AdminAddons.tsx', route: '/admin/addons', area: 'admin',
    tables: ['addon_purchase_requests'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Requests are inserted with restaurant_id and read via current_restaurant_id() policy.' },
  { file: 'src/components/admin/AddonManager.tsx', route: '/admin/menu/:itemId', area: 'shared',
    tables: ['menu_item_addons', 'menu_item_addon_options'], scope: 'parent_scoped', status: 'ok',
    notes: 'Derives restaurant_id from parent menu_item; insert payloads include it.' },
  { file: 'src/components/menu/ImageGalleryManager.tsx', route: '/admin/menu/:itemId', area: 'shared',
    tables: ['menu_item_images'], scope: 'parent_scoped', status: 'ok',
    notes: 'Derives restaurant_id from parent menu_item; insert payloads include it.' },

  // ───── Accounting ─────────────────────────────────────────────────────
  { file: 'src/pages/accounting/AccountingOverviewPage.tsx', route: '/admin/accounting', area: 'admin',
    tables: ['orders', 'expenses', 'expense_categories', 'inventory_items', 'audit_logs'],
    scope: 'restaurant_id_filter', status: 'ok', notes: 'All aggregates filter by restaurant_id.' },
  { file: 'src/pages/accounting/ExpenseManagementPage.tsx', route: '/admin/accounting/expenses', area: 'admin',
    tables: ['expenses', 'expense_categories'], scope: 'restaurant_id_filter', status: 'ok', notes: 'CRUD scoped.' },
  { file: 'src/pages/accounting/InventoryManagementPage.tsx', route: '/admin/accounting/inventory', area: 'admin',
    tables: ['inventory_items', 'inventory_transactions'], scope: 'restaurant_id_filter', status: 'ok', notes: 'CRUD scoped.' },
  { file: 'src/pages/accounting/PayrollManagementPage.tsx', route: '/admin/accounting/payroll', area: 'admin',
    tables: ['payroll_records', 'employee_shifts', 'employee_tips', 'profiles', 'user_roles'],
    scope: 'restaurant_id_filter', status: 'ok', notes: 'Shifts/tips/payroll filter by restaurant_id.' },
  { file: 'src/pages/accounting/MonthlyReportPage.tsx', route: '/admin/accounting/report', area: 'admin',
    tables: ['orders', 'expenses', 'expense_categories', 'inventory_transactions', 'payroll_records'],
    scope: 'restaurant_id_filter', status: 'ok', notes: 'Report queries scoped.' },
  { file: 'src/pages/accounting/FinancialForecastingPage.tsx', route: '/admin/accounting/forecasting', area: 'admin',
    tables: ['expense_categories'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Filtered.' },

  // ───── Owner ──────────────────────────────────────────────────────────
  { file: 'src/pages/owner/OwnerDashboard.tsx', route: '/owner', area: 'admin',
    tables: ['orders', 'branches', 'restaurant_members'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Tenant-scoped.' },
  { file: 'src/pages/owner/OwnerStaff.tsx', route: '/owner/staff', area: 'admin',
    tables: ['profiles', 'user_roles'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Staff joined via restaurant_members.' },

  // ───── Staff ──────────────────────────────────────────────────────────
  { file: 'src/pages/KitchenPage.tsx', route: '/kitchen', area: 'staff',
    tables: ['orders'], scope: 'restaurant_id_filter', status: 'ok', notes: 'KDS scoped to current restaurant.' },
  { file: 'src/pages/POSPage.tsx', route: '/admin/pos', area: 'staff',
    tables: ['categories', 'restaurant_tables', 'order_items', 'cash_drawer_sessions', 'restaurant_settings'],
    scope: 'restaurant_id_filter', status: 'ok', notes: 'All POS queries are restaurant-scoped.' },
  { file: 'src/pages/WaiterDashboard.tsx', route: '/waiter', area: 'staff',
    tables: ['orders'], scope: 'restaurant_id_filter', status: 'ok', notes: 'Active orders scoped.' },
  { file: 'src/components/waiter/ModifyOrderDialog.tsx', route: '/waiter', area: 'staff',
    tables: ['orders', 'order_items'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Item picker scoped via useCurrentRestaurant.' },

  // ───── Customer-facing ────────────────────────────────────────────────
  { file: 'src/pages/MenuPage.tsx', route: '/menu', area: 'customer',
    tables: ['categories', 'restaurant_tables', 'order_items', 'waiter_calls'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Resolves active restaurant via slug / custom domain, then filters all queries.' },
  { file: 'src/pages/TableOrderPage.tsx', route: '/table/:tableId', area: 'customer',
    tables: ['order_items', 'waiter_calls', 'promotion_uses', 'loyalty_transactions'],
    scope: 'restaurant_id_filter', status: 'ok', notes: 'Resolves restaurant_id from the table row first.' },
  { file: 'src/pages/OrderStatusPage.tsx', route: '/order/:orderId', area: 'customer',
    tables: ['orders'], scope: 'rls_only', status: 'info',
    notes: 'Single-row lookup by id; RLS limits visibility to the order owner / staff.' },
  { file: 'src/pages/ContactPage.tsx', route: '/contact', area: 'customer',
    tables: ['reservations'], scope: 'rls_only', status: 'info',
    notes: 'Reservation insert; RLS controls who can read it.' },

  // ───── Hooks (shared) ─────────────────────────────────────────────────
  { file: 'src/hooks/useSettings.ts', route: '—', area: 'shared',
    tables: ['restaurant_settings'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Loads the active restaurant\'s settings row.' },
  { file: 'src/hooks/useHomepageContent.ts', route: '—', area: 'shared',
    tables: ['homepage_content'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Filters by restaurant_id derived from the active context.' },

  // ───── Platform (intentionally global) ────────────────────────────────
  { file: 'src/pages/platform/PlatformOverview.tsx', route: '/platform', area: 'platform',
    tables: ['restaurants', 'subscriptions', 'orders', 'restaurant_members'],
    scope: 'platform_global', status: 'info', notes: 'Aggregates across all tenants — gated by is_platform_admin().' },
  { file: 'src/pages/platform/PlatformTenants.tsx', route: '/platform/tenants', area: 'platform',
    tables: ['restaurants'], scope: 'platform_global', status: 'info', notes: 'Tenant directory.' },
  { file: 'src/pages/platform/PlatformAddons.tsx', route: '/platform/addons', area: 'platform',
    tables: ['platform_addons', 'restaurant_addons', 'restaurants'], scope: 'platform_global', status: 'info', notes: 'Marketplace admin.' },
  { file: 'src/pages/platform/PlatformPackages.tsx', route: '/platform/packages', area: 'platform',
    tables: ['subscription_plans'], scope: 'platform_global', status: 'info', notes: 'Plan catalogue.' },
  { file: 'src/pages/platform/PlatformUsers.tsx', route: '/platform/users', area: 'platform',
    tables: ['platform_admins'], scope: 'platform_global', status: 'info', notes: 'Admin directory.' },
  { file: 'src/pages/platform/PlatformThemes.tsx', route: '/platform/themes', area: 'platform',
    tables: ['platform_themes'], scope: 'platform_global', status: 'info', notes: 'Shared theme library.' },
  { file: 'src/pages/platform/PlatformContactEditor.tsx', route: '/platform/marketing/contact', area: 'platform',
    tables: ['marketing_contact_settings', 'marketing_contact_submissions'], scope: 'platform_global', status: 'info',
    notes: 'Marketing site content.' },
  { file: 'src/pages/platform/PlatformDemoEditor.tsx', route: '/platform/marketing/demo', area: 'platform',
    tables: ['demo_page_config'], scope: 'platform_global', status: 'info', notes: 'Marketing site content.' },
  { file: 'src/pages/platform/PlatformFooterEditor.tsx', route: '/platform/marketing/footer', area: 'platform',
    tables: ['marketing_footer_settings'], scope: 'platform_global', status: 'info', notes: 'Marketing site content.' },
  { file: 'src/pages/platform/PlatformMarketingHome.tsx', route: '/platform/marketing/home', area: 'platform',
    tables: ['marketing_page_sections'], scope: 'platform_global', status: 'info', notes: 'Marketing site content.' },
  { file: 'src/components/platform/CustomDomainCard.tsx', route: '/platform/tenants', area: 'platform',
    tables: ['restaurant_custom_domains'], scope: 'platform_global', status: 'info', notes: 'Domain admin tool.' },
  { file: 'src/components/platform/RequestCustomDomainCard.tsx', route: '/admin/settings', area: 'shared',
    tables: ['custom_domain_requests'], scope: 'restaurant_id_filter', status: 'ok',
    notes: 'Insert includes restaurant_id; reads use current_restaurant_id() policy.' },
  { file: 'src/hooks/usePlatformThemes.ts', route: '—', area: 'platform',
    tables: ['platform_themes'], scope: 'platform_global', status: 'info', notes: 'Theme catalogue.' },

  // ───── Anonymous / public ─────────────────────────────────────────────
  { file: 'src/pages/marketing/MarketingContact.tsx', route: '/contact', area: 'customer',
    tables: ['marketing_contact_submissions'], scope: 'public_anon', status: 'info',
    notes: 'Public form submission; no tenant context.' },
];

/**
 * Tables we *expect* to always carry a `restaurant_id` value. Used by the
 * live probe to detect rows that slipped in without one (which would be
 * invisible to other tenants but indicates a bug at the insert site).
 */
export const TENANT_SCOPED_TABLES = [
  'menu_items',
  'categories',
  'orders',
  'restaurant_tables',
  'branches',
  'expenses',
  'expense_categories',
  'inventory_items',
  'inventory_transactions',
  'promotions',
  'customization_tags',
  'floor_plans',
  'employee_shifts',
  'employee_tips',
  'payroll_records',
  'menu_item_addons',
  'menu_item_addon_options',
  'menu_item_images',
  'menu_item_tags',
  'homepage_content',
  'restaurant_settings',
  'loyalty_settings',
  'loyalty_transactions',
] as const;