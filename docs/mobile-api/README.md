# ServeOS restaurant mobile API

The local API is running at:

`http://127.0.0.1:54321/functions/v1/mobile-api/v1`

This API is for restaurant owners, admins, managers, kitchen staff, waiters, and
servers. It provides the existing restaurant modules through a versioned REST
interface; it does not expose platform administrator tools or Gemini secrets.

## Connect a mobile app

1. `POST /auth/login` with `{ "email": "...", "password": "..." }`.
2. Store the returned session using native Keychain/Keystore storage.
3. Send `Authorization: Bearer <access_token>` on authenticated requests.
4. `GET /restaurants`, choose the restaurant, and read its role/entitlements.
5. `GET /restaurants/{restaurant_id}/capabilities` to decide which screens/actions
   to show. Every API request checks the permissions again on the server.
6. Refresh sessions with `POST /auth/refresh`; logout with `POST /auth/logout`.

The refresh token rotates. Store the new refresh token after each refresh. Logout
revokes the current refresh session; already-issued Supabase JWTs have their
normal expiration. Removing a staff membership immediately prevents further
restaurant API access even if that account still has a token.

For Android emulator access, replace `127.0.0.1` with `10.0.2.2`. A physical
phone needs your development machine's reachable LAN address, or a hosted HTTPS
URL. The production base is
`https://<project-ref>.supabase.co/functions/v1/mobile-api/v1`.

A framework-independent TypeScript client is in `sdk/serveos-mobile-api.ts`:

```ts
const api = new ServeOSMobileApi(BASE_URL, yourSecureStorage);
await api.login(email, password);
const { data: restaurants } = await api.restaurants();
const restaurantId = restaurants[0].restaurant.id;
const menu = await api.list(restaurantId, 'menu-items', { limit: 50 });
```

Import `openapi.json` into Swagger or another OpenAPI client. Import
`ServeOS-Mobile-API.postman_collection.json` into Postman and set the collection
variables. No real passwords, access tokens, or API keys are bundled in either.

## Modules

| Area | Routes under `/restaurants/{restaurant_id}` |
|---|---|
| Restaurant | Context, capabilities, branding, settings, branches |
| Menu | Categories, menu-items, menu-addons, menu-addon-options, menu-images, customization-tags, menu-tags |
| Service | Orders, kitchen queue, per-item statuses, tables, table QR URLs, QR short links/scans, floor-plans, waiter-calls, reservations |
| Staff | Account creation, roles, membership removal, staff-branches |
| Website | Homepage content, branding/theme overrides, themes, custom-domains, domain-requests, CTA click analytics |
| Subscription | Subscription/entitlements, packages, payment-methods, subscription-payments, addon-catalog, addon-requests, active-addons |
| Accounting | Expenses, expense-categories, budget-alerts, inventory, inventory transactions/adjustments, suppliers, stock receipts/lines, menu ingredients, shifts, tips, payroll, cash-drawers |
| Customers | Customer contacts, loyalty settings/transactions, authorized point adjustments |
| Reports | Dashboard totals, reports, CSV export, order receipts, accounting audit history |
| Support | Own or owner/admin restaurant-shared conversations/messages, customer rating, AI/human typing status |
| Images | Multipart menu, website, and floor-plan image uploads |
| Updates | Cursor-based order events for foreground synchronization |

Read-only ledger/catalog resources cannot be modified by generic CRUD. Use the
stock receive/adjust, loyalty, order, payment, or platform-review actions instead.
Customer login identities are managed by the existing customer auth flow; the
staff API reads customer records and manages loyalty, not customer passwords.

## Roles and branch access

Owners and admins manage restaurant configuration and staff. Only owners can
create another restaurant admin. Managers manage ordinary configuration and
business operations but cannot administer staff accounts or assign staff branches.
Kitchen staff can read operational menus/tickets and mark items/orders preparing
or ready; their order responses omit financial and customer-contact fields.
Waiters/servers create orders, confirm/serve orders, move tables, resolve service
calls, manage reservations, and use support. Only owner/admin/manager can record
restaurant payments or read accounting/reports.

Access always requires membership or ownership of the selected restaurant. A
per-membership role is stored for newly managed staff; legacy accounts without
that field fall back to their existing app roles. Branch assignments restrict
branch-scoped operational data. Owners/admins can operate all branches. Staff
without branch assignments have restaurant-wide operational access, matching the
existing app. Restaurant-wide reference/settings data is scoped to the restaurant.

The mobile gateway enforces its own checks instead of relying on permissive
legacy table policies. Direct PostgREST and web SDK access still use the
repository's existing RLS policies; this API does not replace that separate access
surface or claim to audit every legacy policy.

## Create and fulfil an order

`POST /restaurants/{restaurant_id}/orders` requires a stable `Idempotency-Key`:

```json
{
  "branch_id": "<branch UUID>",
  "table_id": "<table UUID>",
  "items": [
    { "menu_item_id": "<menu item UUID>", "quantity": 2,
      "addon_option_ids": [], "selected_tags": [] }
  ]
}
```

The server validates restaurant/branch ownership, availability, quantities,
required customization choices, tax, delivery fee, and authoritative menu/add-on
prices. Orders and all items are committed together. Repeating the same request
and key returns the same order. Reusing a key with different content returns 409.
New order lines store a price snapshot. Later menu edits don't change these
orders' prices; historical rows without snapshots retain their legacy calculation.
Render invoice lines from `order_items.unit_price` (which includes add-ons), rather
than the menu's current price.

`PATCH /orders/{id}` edits an unpaid ticket. Send `expected_updated_at` from the
last response to detect changes from another device. When `items` is present it
is the complete desired set: existing lines use `{ "id": "...", "quantity": 2 }`,
new lines use the creation format above. Omitted existing lines, or quantity zero,
become cancelled with quantity zero; history is retained. Existing lines retain
their prices; new lines use current catalog prices. Quantity changes update
inventory usage. Adding/increasing items on ready or served tickets returns the
ticket to preparing. All changes commit or fail together.

Use `POST /orders/{id}/status` with both `status` and `expected_status`:

`pending → confirmed → preparing → ready → served → completed`

Pending/confirmed can also move directly to preparing. Administrators can cancel
unpaid pending/confirmed/preparing/ready orders. Closed or paid cancellation
requires a separate business refund workflow. A stale expected status returns 409;
refresh the order instead of overwriting another device's update. Kitchen roles
can prepare/ready; waiters can confirm/serve/complete.

`POST /orders/{id}/discount` lets owners/admins/managers apply a non-negative
discount up to the pre-tax subtotal before payment. The server recalculates the
total; kitchen/waiter roles cannot set prices or discounts.

`POST /orders/{id}/payment` records a cash/card/bKash/Nagad/Rocket/bank-transfer
payment once. Cash payments update the branch's open cash drawer. No real payment
gateway charge is made by this record operation. `GET /orders/{id}/receipt`
returns structured invoice data and the restaurant currency for app rendering.

## Catalog and subscription payments

Package terms are encoded by tier; monthly, quarterly, biannual, yearly and trial
cover one, three, six, twelve months and seven days. Package amounts are totals
for their stated term. The server prices subscription/add-on requests and checks
supported public packages; clients cannot set amounts, approval statuses or grants.
Subscription and add-on coupon codes are validated when a package payment is submitted.
Package payment requests require the sender number and transaction ID.
Platform administrators perform payment/add-on review in the platform panel.
Expired subscriptions and unavailable features return 403 for their modules;
billing/catalog endpoints remain accessible to administrators for upgrades.

## Files, synchronization and reports

`POST /uploads` accepts multipart `kind=menu|website|floor-plan` and `file` (PNG,
JPEG or WebP, maximum 5 MB). Uploaded paths start with the current restaurant ID.
The small JSON/base64 format is supported for compatibility, subject to the
64 KB JSON request limit. Attach the returned URL to the appropriate menu/image,
branding or floor-plan record.

`GET /events?since=<ISO timestamp>&after_id=<UUID>` returns up to 100 order changes,
a `next_cursor` and `has_more`. Persist the cursor; consume all pages when
`has_more=true`, then poll again. It is a foreground polling API, not a configured
APNs/FCM push delivery service. The app must fetch its initial order queue first.

List routes use `limit` (1–100) and `offset` (0–10000). Branch-scoped lists accept
`branch_id`. Named reference IDs and writable status/boolean fields can be used
as equality filters, e.g. `menu-items?category_id=...&is_available=true` or
`menu-addons?menu_item_id=...`. Named resources support `search` where applicable.
JSON writes reject unknown fields. Normal JSON bodies are limited to 64 KB.

Expenses, inventory history, stock receipts, shifts, tips, payroll, reservations,
QR scans, and CTA clicks also accept `from`/`to` date filters.

Reports accept ISO `from` and `to` (inclusive start, exclusive end, at most 366
days). Date grouping uses UTC. Expense dates use the calendar days touched by the
range. Reports include payment-method totals, tax collected, discounts, delivery
fees, expense categories, payroll status totals, and inventory cost totals by
transaction type. These totals and daily sales support the existing accounting,
monthly report, and forecasting screens. `GET /audit` returns paginated accounting
changes, restricted using restaurant and branch identifiers in the row snapshots.
`GET /reports/export` returns a CSV summary. For deeper exports, page
through the applicable resource lists and export the records in the mobile app.

## Deployment and validation

Apply migrations `20261016100000_mobile_staff_api.sql`,
`20261016110000_mobile_api_actions.sql`,
`20261016120000_mobile_price_snapshots.sql`, and
`20261016130000_mobile_order_edit_and_audit.sql`. Deploy `mobile-api` and the updated
`create-staff` function; `mobile-api` JWT verification is disabled at the gateway
because login/refresh are public, while the function verifies every protected
request itself. The service role key stays in the Edge runtime.

Set `PUBLIC_SITE_URL` to the real restaurant website base for generated table QR
URLs. Existing DNS/Cloudflare settings are required for hosted custom-domain
verification. Existing Gemini/worker configuration powers platform support.

Local checks:

```sh
node scripts/test-mobile-api.mjs
npm test
docker exec -i supabase_db_mzwrasiyigxsbyomdazk psql -U postgres -d postgres -v ON_ERROR_STOP=1 < tests/database/mobile-api-billing.sql
```

The integration script refuses non-local databases, creates disposable
restaurants/accounts, tests isolation and workflow behavior, and removes only its
own fixtures. Generate docs with:

```sh
node --experimental-transform-types scripts/generate-mobile-api-docs.mjs
```
