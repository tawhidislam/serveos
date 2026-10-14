-- ============================================================
-- PHASE 1: Multi-tenant foundation
-- ============================================================

-- 1. Add 'owner' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'owner';

-- 2. Create restaurants (tenant root) table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID,
  logo_url TEXT,
  tagline TEXT,
  primary_color TEXT NOT NULL DEFAULT '#e87c1e',
  accent_color TEXT NOT NULL DEFAULT '#c8a855',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_restaurants_slug ON public.restaurants(slug);
CREATE INDEX idx_restaurants_owner ON public.restaurants(owner_id);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- 3. Create restaurant_members table (links users to a tenant)
CREATE TABLE public.restaurant_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE INDEX idx_restaurant_members_user ON public.restaurant_members(user_id);
CREATE INDEX idx_restaurant_members_restaurant ON public.restaurant_members(restaurant_id);

ALTER TABLE public.restaurant_members ENABLE ROW LEVEL SECURITY;

-- 4. Helper function: current user's restaurant_id (security definer to avoid recursion)
CREATE OR REPLACE FUNCTION public.current_restaurant_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.restaurant_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- 5. Helper: is user the owner of given restaurant?
CREATE OR REPLACE FUNCTION public.is_restaurant_owner(_restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants WHERE id = _restaurant_id AND owner_id = auth.uid()
  )
$$;

-- 6. Create default restaurant for existing data (backfill)
INSERT INTO public.restaurants (id, name, slug, primary_color, accent_color)
SELECT 
  '00000000-0000-0000-0000-000000000001'::uuid,
  COALESCE((SELECT restaurant_name FROM public.restaurant_settings LIMIT 1), 'My Restaurant'),
  'default',
  COALESCE((SELECT primary_color FROM public.restaurant_settings LIMIT 1), '#e87c1e'),
  COALESCE((SELECT accent_color FROM public.restaurant_settings LIMIT 1), '#c8a855')
WHERE NOT EXISTS (SELECT 1 FROM public.restaurants WHERE id = '00000000-0000-0000-0000-000000000001');

-- 7. Add restaurant_id to all tenant-scoped tables
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_tables ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.floor_plans ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.promotions ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.customization_tags ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.expense_categories ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.employee_shifts ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.employee_tips ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.budget_alerts ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.cash_drawer_sessions ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.homepage_content ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.restaurant_settings ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_settings ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.waiter_calls ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.staff_branches ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_addons ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_addon_options ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_images ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.menu_item_tags ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.loyalty_transactions ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;
ALTER TABLE public.promotion_uses ADD COLUMN IF NOT EXISTS restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- 8. Backfill all existing rows into the default restaurant
UPDATE public.branches SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.categories SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.menu_items SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.orders SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.restaurant_tables SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.floor_plans SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.promotions SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.customization_tags SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.expense_categories SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.expenses SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.inventory_items SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.inventory_transactions SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.employee_shifts SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.employee_tips SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.payroll_records SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.budget_alerts SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.cash_drawer_sessions SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.reservations SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.homepage_content SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.restaurant_settings SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.loyalty_settings SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.waiter_calls SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.staff_branches SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.menu_item_addons SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.menu_item_addon_options SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.menu_item_images SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.menu_item_tags SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.order_items SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.loyalty_transactions SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;
UPDATE public.promotion_uses SET restaurant_id = '00000000-0000-0000-0000-000000000001' WHERE restaurant_id IS NULL;

-- 9. Backfill: assign all existing users to the default restaurant
INSERT INTO public.restaurant_members (user_id, restaurant_id)
SELECT DISTINCT user_id, '00000000-0000-0000-0000-000000000001'::uuid
FROM public.user_roles
ON CONFLICT (user_id) DO NOTHING;

-- 10. Set the first existing admin as owner of the default restaurant
UPDATE public.restaurants
SET owner_id = (SELECT user_id FROM public.user_roles WHERE role = 'admin' LIMIT 1)
WHERE id = '00000000-0000-0000-0000-000000000001' AND owner_id IS NULL;

-- 11. Trigger: auto-update updated_at on restaurants
CREATE TRIGGER update_restaurants_updated_at
  BEFORE UPDATE ON public.restaurants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- restaurants
CREATE POLICY "Restaurants viewable by all (public ordering)"
  ON public.restaurants FOR SELECT
  USING (true);

CREATE POLICY "Owners can update own restaurant"
  ON public.restaurants FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Authenticated can create restaurant (signup)"
  ON public.restaurants FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- restaurant_members
CREATE POLICY "Users see own membership"
  ON public.restaurant_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners see all members of their restaurant"
  ON public.restaurant_members FOR SELECT
  TO authenticated
  USING (public.is_restaurant_owner(restaurant_id));

CREATE POLICY "Owners can add members to their restaurant"
  ON public.restaurant_members FOR INSERT
  TO authenticated
  WITH CHECK (public.is_restaurant_owner(restaurant_id));

CREATE POLICY "Self-insert membership on signup"
  ON public.restaurant_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can remove members"
  ON public.restaurant_members FOR DELETE
  TO authenticated
  USING (public.is_restaurant_owner(restaurant_id) AND user_id != auth.uid());

-- ============================================================
-- Add tenant-scoped policies (additive, alongside existing role policies)
-- These ensure users in restaurant A cannot see data of restaurant B
-- ============================================================

-- Generic tenant-scope policy on each table (writes restricted to own tenant)
CREATE POLICY "Tenant members manage own branches"
  ON public.branches FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own categories"
  ON public.categories FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own menu_items"
  ON public.menu_items FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own orders"
  ON public.orders FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own tables"
  ON public.restaurant_tables FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own floor_plans"
  ON public.floor_plans FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own promotions"
  ON public.promotions FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own customization_tags"
  ON public.customization_tags FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own expense_categories"
  ON public.expense_categories FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own expenses"
  ON public.expenses FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own inventory_items"
  ON public.inventory_items FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own inventory_transactions"
  ON public.inventory_transactions FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own employee_shifts"
  ON public.employee_shifts FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own employee_tips"
  ON public.employee_tips FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own payroll_records"
  ON public.payroll_records FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own budget_alerts"
  ON public.budget_alerts FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own cash_drawer_sessions"
  ON public.cash_drawer_sessions FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own reservations"
  ON public.reservations FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own homepage_content"
  ON public.homepage_content FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own restaurant_settings"
  ON public.restaurant_settings FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own loyalty_settings"
  ON public.loyalty_settings FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own waiter_calls"
  ON public.waiter_calls FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own staff_branches"
  ON public.staff_branches FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own menu_item_addons"
  ON public.menu_item_addons FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own menu_item_addon_options"
  ON public.menu_item_addon_options FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own menu_item_images"
  ON public.menu_item_images FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own menu_item_tags"
  ON public.menu_item_tags FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own order_items"
  ON public.order_items FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own loyalty_transactions"
  ON public.loyalty_transactions FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Tenant members manage own promotion_uses"
  ON public.promotion_uses FOR ALL TO authenticated
  USING (restaurant_id = public.current_restaurant_id())
  WITH CHECK (restaurant_id = public.current_restaurant_id());

-- ============================================================
-- Update handle_new_user trigger: do NOT auto-assign tenant
-- (signup flow will create restaurant + membership explicitly;
-- staff invites by owner will create membership separately)
-- ============================================================
-- (existing trigger still creates profile + customer role; that's fine)
