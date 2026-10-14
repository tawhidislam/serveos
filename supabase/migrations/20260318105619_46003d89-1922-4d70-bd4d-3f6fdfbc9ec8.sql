
-- Branches table
CREATE TABLE public.branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text,
  phone text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Branches viewable by all" ON public.branches
  FOR SELECT TO public USING (true);

CREATE POLICY "Admin can manage branches" ON public.branches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage branches" ON public.branches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

CREATE TRIGGER update_branches_updated_at
  BEFORE UPDATE ON public.branches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert a default branch
INSERT INTO public.branches (name, address) VALUES ('Main Branch', 'Default location');

-- Add branch_id to existing tables
ALTER TABLE public.categories ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.menu_items ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.restaurant_tables ADD COLUMN branch_id uuid REFERENCES public.branches(id);
ALTER TABLE public.orders ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- Staff-branch assignment
CREATE TABLE public.staff_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, branch_id)
);

ALTER TABLE public.staff_branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can read own assignments" ON public.staff_branches
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admin can manage staff branches" ON public.staff_branches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage staff branches" ON public.staff_branches
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Set existing data to the default branch
UPDATE public.categories SET branch_id = (SELECT id FROM public.branches LIMIT 1) WHERE branch_id IS NULL;
UPDATE public.menu_items SET branch_id = (SELECT id FROM public.branches LIMIT 1) WHERE branch_id IS NULL;
UPDATE public.restaurant_tables SET branch_id = (SELECT id FROM public.branches LIMIT 1) WHERE branch_id IS NULL;
UPDATE public.orders SET branch_id = (SELECT id FROM public.branches LIMIT 1) WHERE branch_id IS NULL;
