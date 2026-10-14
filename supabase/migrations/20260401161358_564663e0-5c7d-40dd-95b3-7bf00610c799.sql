
-- Expense categories
CREATE TABLE public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'receipt',
  color text DEFAULT '#6366f1',
  is_active boolean NOT NULL DEFAULT true,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expense categories viewable by staff" ON public.expense_categories
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can manage expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage expense categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Expenses table
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  description text,
  vendor text,
  reference_number text,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  recorded_by uuid,
  receipt_url text,
  is_recurring boolean NOT NULL DEFAULT false,
  recurring_interval text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Expenses viewable by staff" ON public.expenses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage expenses" ON public.expenses
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Budget alerts table
CREATE TABLE public.budget_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id) ON DELETE CASCADE,
  monthly_budget numeric NOT NULL DEFAULT 0,
  alert_threshold_pct numeric NOT NULL DEFAULT 80,
  branch_id uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Budget alerts viewable by staff" ON public.budget_alerts
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

CREATE POLICY "Admin can manage budget alerts" ON public.budget_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage budget alerts" ON public.budget_alerts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));

-- Insert default expense categories
INSERT INTO public.expense_categories (name, description, icon, color) VALUES
  ('Food & Ingredients', 'Raw materials, produce, meats, etc.', 'shopping-cart', '#ef4444'),
  ('Beverages', 'Drinks, alcohol, soft drinks', 'coffee', '#f97316'),
  ('Labor', 'Employee wages, overtime, benefits', 'users', '#3b82f6'),
  ('Utilities', 'Electricity, water, gas, internet', 'zap', '#eab308'),
  ('Rent & Lease', 'Monthly rent and lease payments', 'building', '#8b5cf6'),
  ('Equipment', 'Kitchen equipment, repairs, maintenance', 'wrench', '#06b6d4'),
  ('Marketing', 'Advertising, promotions, social media', 'megaphone', '#ec4899'),
  ('Supplies', 'Cleaning, packaging, disposables', 'package', '#14b8a6'),
  ('Insurance', 'Business insurance premiums', 'shield', '#6366f1'),
  ('Miscellaneous', 'Other uncategorized expenses', 'more-horizontal', '#64748b');
