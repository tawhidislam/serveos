-- =============================================================================
-- TENANT ISOLATION HARDENING
-- Re-scope all role-based policies so that admin/manager/waiter/kitchen/server
-- actions are constrained to the caller's own restaurant.
-- =============================================================================

-- Helper: a single source-of-truth check used in many policies
-- (current_restaurant_id() already exists)

-- Generic pattern: drop overly-broad role policies and recreate them
-- combined with restaurant_id = current_restaurant_id().

-- ============== MENU_ITEMS ==============
DROP POLICY IF EXISTS "Admin can manage menu items" ON public.menu_items;
DROP POLICY IF EXISTS "Manager can manage menu items" ON public.menu_items;
CREATE POLICY "Admin can manage menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage menu items" ON public.menu_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== CATEGORIES ==============
DROP POLICY IF EXISTS "Admin can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Manager can manage categories" ON public.categories;
CREATE POLICY "Admin can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== BRANCHES ==============
DROP POLICY IF EXISTS "Admin can manage branches" ON public.branches;
DROP POLICY IF EXISTS "Manager can manage branches" ON public.branches;
CREATE POLICY "Admin can manage branches" ON public.branches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage branches" ON public.branches
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== ORDERS ==============
DROP POLICY IF EXISTS "Admin can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Manager can delete orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can update orders" ON public.orders;
DROP POLICY IF EXISTS "Managers can view all orders" ON public.orders;
DROP POLICY IF EXISTS "Staff can update orders" ON public.orders;
DROP POLICY IF EXISTS "Users can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Waiters can update orders" ON public.orders;
DROP POLICY IF EXISTS "Waiters can view all orders" ON public.orders;

CREATE POLICY "Admin can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can delete orders" ON public.orders
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Managers can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Managers can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Staff can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'server'::app_role))
        AND restaurant_id = current_restaurant_id())
  );
CREATE POLICY "Users can view own orders" ON public.orders
  FOR SELECT TO authenticated
  USING (
    (auth.uid() = user_id)
    OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'server'::app_role))
        AND restaurant_id = current_restaurant_id())
  );
CREATE POLICY "Waiters can update orders" ON public.orders
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Waiters can view all orders" ON public.orders
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== ORDER_ITEMS ==============
DROP POLICY IF EXISTS "Admin can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Manager can delete order items" ON public.order_items;
DROP POLICY IF EXISTS "Managers can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Managers can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Managers can view order items" ON public.order_items;
DROP POLICY IF EXISTS "Staff can update order items" ON public.order_items;
DROP POLICY IF EXISTS "View order items" ON public.order_items;
DROP POLICY IF EXISTS "Waiters can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Waiters can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Waiters can view order items" ON public.order_items;

CREATE POLICY "Admin can delete order items" ON public.order_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Admins can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can delete order items" ON public.order_items
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Managers can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Managers can update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Managers can view order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Staff can update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'server'::app_role))
         AND restaurant_id = current_restaurant_id());
CREATE POLICY "View order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
        AND (
          orders.user_id = auth.uid()
          OR ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'kitchen'::app_role) OR has_role(auth.uid(), 'server'::app_role))
              AND orders.restaurant_id = current_restaurant_id())
        )
    )
  );
CREATE POLICY "Waiters can insert order items" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Waiters can update order items" ON public.order_items
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Waiters can view order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== RESTAURANT_TABLES ==============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='Admin can manage tables') THEN
    DROP POLICY "Admin can manage tables" ON public.restaurant_tables;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='Manager can manage tables') THEN
    DROP POLICY "Manager can manage tables" ON public.restaurant_tables;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='Staff can update tables') THEN
    DROP POLICY "Staff can update tables" ON public.restaurant_tables;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_tables' AND policyname='Waiters can update tables') THEN
    DROP POLICY "Waiters can update tables" ON public.restaurant_tables;
  END IF;
END $$;
CREATE POLICY "Admin can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage tables" ON public.restaurant_tables
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Waiters can update tables" ON public.restaurant_tables
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'waiter'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== RESTAURANT_SETTINGS ==============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_settings' AND policyname='Admin can manage settings') THEN
    DROP POLICY "Admin can manage settings" ON public.restaurant_settings;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='restaurant_settings' AND policyname='Manager can manage settings') THEN
    DROP POLICY "Manager can manage settings" ON public.restaurant_settings;
  END IF;
END $$;
CREATE POLICY "Admin can manage settings" ON public.restaurant_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage settings" ON public.restaurant_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== PROMOTIONS ==============
DROP POLICY IF EXISTS "Admin can manage promotions" ON public.promotions;
DROP POLICY IF EXISTS "Manager can manage promotions" ON public.promotions;
CREATE POLICY "Admin can manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage promotions" ON public.promotions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== PROMOTION_USES ==============
DROP POLICY IF EXISTS "Staff can view promotion uses" ON public.promotion_uses;
CREATE POLICY "Staff can view promotion uses" ON public.promotion_uses
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

-- ============== CUSTOMIZATION_TAGS ==============
DROP POLICY IF EXISTS "Admin can manage tags" ON public.customization_tags;
DROP POLICY IF EXISTS "Manager can manage tags" ON public.customization_tags;
CREATE POLICY "Admin can manage tags" ON public.customization_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage tags" ON public.customization_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== MENU_ITEM_ADDONS ==============
DROP POLICY IF EXISTS "Admin can manage addons" ON public.menu_item_addons;
DROP POLICY IF EXISTS "Manager can manage addons" ON public.menu_item_addons;
CREATE POLICY "Admin can manage addons" ON public.menu_item_addons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage addons" ON public.menu_item_addons
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== MENU_ITEM_ADDON_OPTIONS ==============
DROP POLICY IF EXISTS "Admin can manage addon options" ON public.menu_item_addon_options;
DROP POLICY IF EXISTS "Manager can manage addon options" ON public.menu_item_addon_options;
CREATE POLICY "Admin can manage addon options" ON public.menu_item_addon_options
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage addon options" ON public.menu_item_addon_options
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== MENU_ITEM_IMAGES ==============
DROP POLICY IF EXISTS "Admin can manage menu item images" ON public.menu_item_images;
DROP POLICY IF EXISTS "Manager can manage menu item images" ON public.menu_item_images;
CREATE POLICY "Admin can manage menu item images" ON public.menu_item_images
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage menu item images" ON public.menu_item_images
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== MENU_ITEM_TAGS ==============
DROP POLICY IF EXISTS "Admin can manage menu item tags" ON public.menu_item_tags;
DROP POLICY IF EXISTS "Manager can manage menu item tags" ON public.menu_item_tags;
CREATE POLICY "Admin can manage menu item tags" ON public.menu_item_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage menu item tags" ON public.menu_item_tags
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== FLOOR_PLANS ==============
DROP POLICY IF EXISTS "Admin can manage floor plans" ON public.floor_plans;
DROP POLICY IF EXISTS "Manager can manage floor plans" ON public.floor_plans;
CREATE POLICY "Admin can manage floor plans" ON public.floor_plans
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage floor plans" ON public.floor_plans
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== HOMEPAGE_CONTENT ==============
DROP POLICY IF EXISTS "Admin can manage homepage content" ON public.homepage_content;
DROP POLICY IF EXISTS "Manager can manage homepage content" ON public.homepage_content;
CREATE POLICY "Admin can manage homepage content" ON public.homepage_content
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage homepage content" ON public.homepage_content
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== LOYALTY_SETTINGS ==============
DROP POLICY IF EXISTS "Admin can manage loyalty settings" ON public.loyalty_settings;
DROP POLICY IF EXISTS "Manager can manage loyalty settings" ON public.loyalty_settings;
CREATE POLICY "Admin can manage loyalty settings" ON public.loyalty_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage loyalty settings" ON public.loyalty_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== LOYALTY_TRANSACTIONS ==============
DROP POLICY IF EXISTS "Admin can manage transactions" ON public.loyalty_transactions;
DROP POLICY IF EXISTS "Staff can view all transactions" ON public.loyalty_transactions;
CREATE POLICY "Admin can manage transactions" ON public.loyalty_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Staff can view all transactions" ON public.loyalty_transactions
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

-- ============== EXPENSES & EXPENSE_CATEGORIES ==============
DROP POLICY IF EXISTS "Admin can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Manager can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Expenses viewable by staff" ON public.expenses;
CREATE POLICY "Admin can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Expenses viewable by staff" ON public.expenses
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

DROP POLICY IF EXISTS "Admin can manage expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Manager can manage expense categories" ON public.expense_categories;
DROP POLICY IF EXISTS "Expense categories viewable by staff" ON public.expense_categories;
CREATE POLICY "Admin can manage expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Expense categories viewable by staff" ON public.expense_categories
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

-- ============== INVENTORY_ITEMS & INVENTORY_TRANSACTIONS ==============
DROP POLICY IF EXISTS "Admin can manage inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Manager can manage inventory items" ON public.inventory_items;
DROP POLICY IF EXISTS "Inventory items viewable by staff" ON public.inventory_items;
CREATE POLICY "Admin can manage inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage inventory items" ON public.inventory_items
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Inventory items viewable by staff" ON public.inventory_items
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

DROP POLICY IF EXISTS "Admin can manage inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Manager can manage inventory transactions" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Inventory transactions viewable by staff" ON public.inventory_transactions;
CREATE POLICY "Admin can manage inventory transactions" ON public.inventory_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage inventory transactions" ON public.inventory_transactions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Inventory transactions viewable by staff" ON public.inventory_transactions
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

-- ============== EMPLOYEE_SHIFTS / TIPS / PAYROLL ==============
DROP POLICY IF EXISTS "Admin can manage shifts" ON public.employee_shifts;
DROP POLICY IF EXISTS "Manager can manage shifts" ON public.employee_shifts;
CREATE POLICY "Admin can manage shifts" ON public.employee_shifts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage shifts" ON public.employee_shifts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

DROP POLICY IF EXISTS "Admin can manage tips" ON public.employee_tips;
DROP POLICY IF EXISTS "Manager can manage tips" ON public.employee_tips;
CREATE POLICY "Admin can manage tips" ON public.employee_tips
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage tips" ON public.employee_tips
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

DROP POLICY IF EXISTS "Admin can manage payroll" ON public.payroll_records;
DROP POLICY IF EXISTS "Manager can manage payroll" ON public.payroll_records;
CREATE POLICY "Admin can manage payroll" ON public.payroll_records
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage payroll" ON public.payroll_records
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());

-- ============== CASH_DRAWER_SESSIONS ==============
DROP POLICY IF EXISTS "Staff can create drawer sessions" ON public.cash_drawer_sessions;
DROP POLICY IF EXISTS "Staff can update drawer sessions" ON public.cash_drawer_sessions;
DROP POLICY IF EXISTS "Staff can view drawer sessions" ON public.cash_drawer_sessions;
CREATE POLICY "Staff can create drawer sessions" ON public.cash_drawer_sessions
  FOR INSERT TO authenticated
  WITH CHECK ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'waiter'::app_role))
              AND restaurant_id = current_restaurant_id());
CREATE POLICY "Staff can update drawer sessions" ON public.cash_drawer_sessions
  FOR UPDATE TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR (opened_by = auth.uid()))
         AND restaurant_id = current_restaurant_id());
CREATE POLICY "Staff can view drawer sessions" ON public.cash_drawer_sessions
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'waiter'::app_role) OR (opened_by = auth.uid()))
         AND restaurant_id = current_restaurant_id());

-- ============== BUDGET_ALERTS ==============
DROP POLICY IF EXISTS "Admin can manage budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Manager can manage budget alerts" ON public.budget_alerts;
DROP POLICY IF EXISTS "Budget alerts viewable by staff" ON public.budget_alerts;
CREATE POLICY "Admin can manage budget alerts" ON public.budget_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage budget alerts" ON public.budget_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Budget alerts viewable by staff" ON public.budget_alerts
  FOR SELECT TO authenticated
  USING ((has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
         AND restaurant_id = current_restaurant_id());

-- ============== RESERVATIONS ==============
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Admin can manage reservations') THEN
    DROP POLICY "Admin can manage reservations" ON public.reservations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Manager can manage reservations') THEN
    DROP POLICY "Manager can manage reservations" ON public.reservations;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='reservations' AND policyname='Staff can view reservations') THEN
    DROP POLICY "Staff can view reservations" ON public.reservations;
  END IF;
END $$;
CREATE POLICY "Admin can manage reservations" ON public.reservations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND restaurant_id = current_restaurant_id());
CREATE POLICY "Manager can manage reservations" ON public.reservations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id())
  WITH CHECK (has_role(auth.uid(), 'manager'::app_role) AND restaurant_id = current_restaurant_id());