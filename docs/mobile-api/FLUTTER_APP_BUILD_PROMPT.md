You are a senior Flutter engineer. Build a complete Android and iOS application called "ServeOS Restaurant" using the existing ServeOS mobile REST API. Implement working code and verify it; continue through all supported restaurant admin and staff workflows.

1. Read the backend contract first

Read these supplied files before implementing screens or requests:
- docs/mobile-api/README.md
- docs/mobile-api/openapi.json
- docs/mobile-api/ServeOS-Mobile-API.postman_collection.json
- sdk/serveos-mobile-api.ts as a reference for session handling and request behavior.

Treat OpenAPI and the guide as the source of truth. Inspect the existing backend when available to resolve differences. Use the REST gateway for app data. Keep endpoint names, writable fields, read-only resources, and server permissions consistent with the contract. Report unsupported features or contract gaps clearly instead of inventing endpoints or silently changing the backend.

Create the Flutter app in serveos_mobile/ when working inside the existing repository. Preserve the website and backend. If working in a separate workspace, copy the API documentation into the app's docs/ directory.

2. Flutter implementation

Use the installed stable Flutter SDK, Dart null safety, Material 3, Riverpod for state, Dio for HTTP, go_router for navigation, and flutter_secure_storage for sessions. Resolve compatible maintained package versions and commit the application lockfile. Separate widgets, controllers, repositories, DTOs, and API services by feature. Model API responses with typed Dart classes, including nullable fields and tolerant parsing of numeric values. Keep secrets and personal data out of logs.

Configure API_BASE_URL through --dart-define:
- Android emulator: http://10.0.2.2:54321/functions/v1/mobile-api/v1
- iOS simulator on the backend Mac: http://127.0.0.1:54321/functions/v1/mobile-api/v1
- Physical phone: http://<development-machine-LAN-IP>:54321/functions/v1/mobile-api/v1
- Hosted release: https://<project-ref>.supabase.co/functions/v1/mobile-api/v1

The hosted address is a template, not an already deployed endpoint. Limit development HTTP exceptions to debug builds. Use HTTPS for releases. Never bundle a Supabase service-role key or Gemini credentials.

3. Authentication and restaurant access

Implement login, secure session restoration, password change, and logout using /auth/login, /auth/refresh, /auth/password, and /auth/logout. Preserve password whitespace. Store access_token, refresh_token, and expires_at securely; expires_at is in seconds. Refresh before expiry, serialize concurrent refreshes, and save rotated refresh tokens atomically. Retry a protected request once after an expired-access-token 401. Do not refresh-loop invalid login/current-password errors or 403 permission errors. Clear local session and tenant caches on logout or invalid refresh credentials.

After login, GET /restaurants. Auto-select one restaurant; show a selector when multiple are available. Load GET /restaurants/{restaurant_id} and /capabilities. Derive navigation, branch choices, feature availability, and write permissions from these responses. An empty branch_ids assignment list means restaurant-wide access, not zero access. Partition caches by user, restaurant, and branch. Refresh context after a role, branch, or subscription change and handle revoked membership.

Roles are owner, admin, manager, kitchen, waiter, and server. Owners/admins manage staff; only owners grant restaurant admin roles. Managers cannot manage staff accounts or branch assignments. Kitchen staff prepare tickets/items and mark them ready. Waiters/servers create/edit tickets, confirm/serve/complete them, move tables, resolve calls, and manage reservations. Payment recording, discounts, accounting, and reports require owner/admin/manager permissions. Server permission checks remain authoritative.

4. Implement all supported modules

- Dashboard: totals, daily sales, branch selection, and shortcuts appropriate to the user's role.
- Orders/POS: searchable menu with images, customizations and required add-on choices, cart, dine-in/pickup/delivery details, ticket history, editing, allowed status transitions, discounts, payment recording, and structured receipts.
- Kitchen: active queue, large preparation cards, item notes/customizations, elapsed time, per-item and ticket actions. Render kitchen responses without assuming financial/contact fields exist.
- Waiter: tables, new/edit orders, ready orders, service calls, served/history views, and reservations.
- Menu: categories, items, availability, add-on groups/options, images, customization tags, and menu-tag relationships.
- Seating: tables, floor plans, positions, table status, QR URLs, QR short links, and scan analytics.
- Staff/branches: create accounts, change roles, remove memberships, assign branches, and manage permitted restaurant locations.
- Accounting: expenses/categories, budgets, inventory, suppliers, receiving stock, stock adjustments/history, menu ingredients, shifts, tips, payroll, and cash drawers.
- Customers/loyalty: contacts, loyalty configuration, transaction history, and authorized point adjustments. Respect customer/ledger read-only restrictions.
- Restaurant website: branding, settings, homepage sections, theme selection/overrides, custom domains and verification, domain requests, and CTA analytics.
- Subscription: live package/add-on catalogs, current entitlement/capacity display, enabled payment methods, coupon fields, package payment submissions, add-on requests, approval status, and active add-ons. Display API prices and package durations, including the seven-day trial when returned. Package prices represent their full term. Package payments require sender_number and transaction_id. Review/activation belongs to the platform administrators.
- Reports: sales, tax totals, expenses, payroll/inventory breakdowns, accounting audit history, CSV export, and app-rendered charts. Use supported daily data and ledger lists for additional accounting views; label any derived forecast as an estimate and document its calculation.
- Support: own conversations and permitted owner/admin restaurant threads, message history/composer, ServeOS AI and human messages, typing status, and conversation rating. AI replies come from the backend; display them in their returned language.

Use explicit forms and actions for each module, with pagination, useful filtering, validation, loading, empty, error, and success states. Use documented action routes for financial/stock/loyalty ledgers instead of generic CRUD writes.

5. Critical order and payment rules

All restaurant endpoints start with /restaurants/{restaurant_id}.

POST /orders requires an Idempotency-Key of 8-128 characters. Generate one per checkout attempt, persist it with the draft, and reuse it only for retries of the identical payload. Submit menu IDs, quantity, selected tag IDs, and addon_option_ids; accept totals from the server. Do not send client prices, totals, role assignments, or approval status fields.

PATCH /orders/{id} requires the exact expected_updated_at string from the last response. If items is supplied, send the complete desired item set. Existing lines use id and quantity; new lines use menu_item_id, quantity, and customization fields. Omitted existing lines or quantity zero remove them while preserving cancellation history. Refresh and explain a 409 conflict without overwriting another device's changes.

POST /orders/{id}/status and /order-items/{id}/status require status and expected_status. Follow allowed transitions from the API guide. Account for edited ready/served tickets returning to preparing. Disable editing/discounting paid or closed orders. Render line prices from unit_price, which includes add-ons; use the documented legacy fallback only when the snapshot is null. Do not add customization prices twice.

POST /orders/{id}/payment records payment once; it does not charge a payment gateway. Label it "Record payment" and show server confirmation. Prevent double taps. Do not automatically replay payment/stock/other mutations after timeouts or ambiguous 5xx failures. Reconcile the resulting records before letting the user retry. There is no supplied automatic refund or gateway-charge API.

6. Networking and live updates

Send Authorization: Bearer <access_token> for protected routes. Decode success {data, meta} and failure {error: {code, message, request_id}} envelopes. Handle CSV separately from JSON. List pagination uses limit 1-100 and offset. Use supported filters only. Normal JSON requests are limited to 64 KB.

Use multipart POST /uploads with kind=menu|website|floor-plan and file. Accept PNG/JPEG/WebP up to 5 MB; show progress and attach the returned URL to the relevant record.

Fetch initial queues, then synchronize visible operational screens using GET /events?since=...&after_id=.... Preserve server cursor strings, consume pages while has_more is true, deduplicate updates by order ID, and refetch affected details. Poll at a configurable modest interval while foregrounded, stop in the background, resynchronize on resume, and back off on 429/network failures. Poll support messages/typing only for open relevant screens. Background APNs/FCM delivery is not configured by this API; do not present it as working.

Allow local carts and clearly marked stale read caches while disconnected. Require connectivity for authoritative submissions. Never show an offline draft as a successfully submitted order/payment.

7. UI and localization

Design a polished restaurant operations app with English and Bangla localization, light/dark themes, restaurant branding, readable typography, accessible tap targets, and clear status colors. Use bottom navigation on phones and wider navigation/list-detail layouts on tablets. Keep owner/admin, kitchen, and waiter screens focused on their daily tasks. Include pagination, debounced search, pull-to-refresh, image placeholders, keyboard-safe forms, and confirmation for destructive actions. Use server currency; keep report boundaries in UTC and localize displayed times.

8. Completion and verification

Implement working API integrations throughout the app. Keep fixtures in tests; avoid mocked production dashboards, dead navigation, placeholder actions, or missing-screen TODOs.

Test session rotation/concurrent refresh, permissions and branch isolation, restaurant switching/cache isolation, idempotent checkout, stale-ticket conflicts, price snapshots, kitchen/waiter transitions, payment double taps, stock actions, support typing, uploads, CSV downloads, and denied/expired-plan states. Use disposable integration fixtures; preserve real restaurant data and accounts.

Run dart format, flutter analyze, flutter test, and an Android debug build. Produce an iOS simulator build when the toolchain is available. State anything that could not be executed. Provide setup/run commands, environment examples, a screen-to-endpoint map, test results, and artifact paths. Document release dependencies: the hosted backend needs deployment, existing legacy direct-database permissions need tightening, and optional push/refund/payment-gateway features need separate backend capabilities.

Start by inspecting the supplied contract, then implement and verify the application. Deliver the app source and build instructions, not just a plan or initial scaffold.
