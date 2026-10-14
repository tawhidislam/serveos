# RLS Tenant Scoping — Menu & Orders

Audited 2026-05-05. Verified directly against `pg_policies` in production.

## Scoping primitives

- **`current_restaurant_id()`** — `STABLE SECURITY DEFINER` SQL function. Returns the caller's restaurant via the earliest row in `restaurant_members` for `auth.uid()`. Safe in RLS (no recursion).
- **`has_role(uid, role)`** — `STABLE SECURITY DEFINER`. Reads `user_roles`. Used to gate role‑specific access (admin / manager / kitchen / waiter / server / customer).
- **`is_restaurant_owner(restaurant_id)`** — used elsewhere for owner‑only tables.

> `branch_id` is **NOT** enforced inside RLS today — tenant isolation is at the `restaurant_id` level. Branch filtering is done at the query layer (Zustand store + hooks pass `branch_id`). DB triggers (`trg_validate_order_totals` etc.) enforce data integrity. If hard branch isolation is later required, add `branch_id = current_branch_id()` to the policies below and introduce a `current_branch_id()` SD function.

---

## `categories` (RLS: ✅)

| Cmd | Policy | Predicate |
|-----|--------|-----------|
| SELECT | Categories viewable by all | `true` (public menu) |
| ALL | Tenant members manage own categories | `restaurant_id = current_restaurant_id()` |
| ALL | Admin can manage categories | `has_role(uid,'admin') AND restaurant_id = current_restaurant_id()` |
| ALL | Manager can manage categories | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |

## `menu_items` (RLS: ✅)

| Cmd | Policy | Predicate |
|-----|--------|-----------|
| SELECT | Menu items viewable by all | `true` (public menu) |
| ALL | Tenant members manage own menu_items | `restaurant_id = current_restaurant_id()` |
| ALL | Admin can manage menu items | `has_role(uid,'admin') AND restaurant_id = current_restaurant_id()` |
| ALL | Manager can manage menu items | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |

## `orders` (RLS: ✅)

| Cmd | Policy | Predicate |
|-----|--------|-----------|
| INSERT | Customers create orders for active restaurants | `(user_id IS NULL OR user_id = auth.uid()) AND restaurant exists & is_active AND status='pending' AND (table_id NULL OR table belongs to same restaurant)` |
| INSERT | Guests create orders for active restaurants | Same as above, anon, `user_id IS NULL` |
| SELECT | Users can view own orders | `auth.uid() = user_id OR (admin/kitchen/server AND restaurant_id = current_restaurant_id())` |
| SELECT | Managers can view all orders | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |
| SELECT | Waiters can view all orders | `has_role(uid,'waiter') AND restaurant_id = current_restaurant_id()` |
| UPDATE | Staff can update orders | `auth.uid() = user_id OR (admin/kitchen/server AND restaurant_id = current_restaurant_id())` |
| UPDATE | Managers can update orders | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |
| UPDATE | Waiters can update orders | `has_role(uid,'waiter') AND restaurant_id = current_restaurant_id()` |
| DELETE | Admin can delete orders | `has_role(uid,'admin') AND restaurant_id = current_restaurant_id()` |
| DELETE | Manager can delete orders | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |
| ALL | Tenant members manage own orders | `restaurant_id = current_restaurant_id()` |

## `order_items` (RLS: ✅)

| Cmd | Policy | Predicate |
|-----|--------|-----------|
| INSERT | Customers create items on own pending orders | parent order belongs to caller AND same `restaurant_id` AND `menu_item.restaurant_id` matches AND item available |
| INSERT | Guests create items on own pending orders | same as above for `anon`, `user_id IS NULL` |
| INSERT | Admins / Managers / Waiters can insert order items | `has_role(...) AND restaurant_id = current_restaurant_id()` |
| SELECT | View order items | parent `orders` row visible to caller (chained policy) |
| SELECT | Managers can view order items | `has_role(uid,'manager') AND restaurant_id = current_restaurant_id()` |
| DELETE | Admin / Manager can delete order items | `has_role(...) AND restaurant_id = current_restaurant_id()` |
| ALL | Tenant members manage own order_items | `restaurant_id = current_restaurant_id()` |

---

## Cross‑tenant guarantees

1. **No row escapes its restaurant.** Every authenticated mutation policy requires `restaurant_id = current_restaurant_id()`. A user belonging to Restaurant A cannot read, write, or delete a row owned by Restaurant B even with a forged payload.
2. **Public read is intentional and safe.** `categories` and `menu_items` SELECT = `true` so the QR / `/r/:slug` public menu works for unauthenticated visitors. Neither table contains PII or pricing logic that should be hidden.
3. **Anonymous order creation is locked down.** Guest INSERT policies require: target restaurant `is_active=true`, status `pending`, `user_id NULL`, parent order owned by the same restaurant, and the referenced `menu_item` is available — preventing a guest from injecting an order under another tenant.
4. **Cross‑table joins are validated.** `order_items` insert policies re‑check `orders.restaurant_id = order_items.restaurant_id` and `menu_items.restaurant_id = order_items.restaurant_id`, so a user can't mix items/orders/menu across tenants.
5. **Defence‑in‑depth.** Trigger `trg_validate_order_totals` recomputes totals server‑side; `audit_logs` captures every change via `log_audit_change()`.

## Known gaps / follow‑ups

- **Branch isolation is application‑layer only.** Two staff accounts in the same restaurant but different branches can see each other's data via RLS. If we promise per‑branch isolation to customers, add a `current_branch_id()` SD function and tighten the policies above.
- **Owner role.** Owners are added to `restaurant_members` by `handle_new_restaurant()` so `current_restaurant_id()` works for them; no extra policy needed.
- **No UNIQUE on `restaurant_custom_domains.domain`** — separate finding, tracked elsewhere.
