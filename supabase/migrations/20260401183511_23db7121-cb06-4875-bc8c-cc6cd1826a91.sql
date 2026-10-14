
CREATE TABLE public.customization_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'General',
  emoji TEXT DEFAULT '🏷️',
  color TEXT DEFAULT '#6366f1',
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customization_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tags viewable by all" ON public.customization_tags FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage tags" ON public.customization_tags FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage tags" ON public.customization_tags FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));

-- Add selected_tags array to order_items
ALTER TABLE public.order_items ADD COLUMN selected_tags TEXT[] DEFAULT '{}';

-- Seed common tags
INSERT INTO public.customization_tags (name, category, emoji, color, sort_order) VALUES
  ('Extra Spicy', 'Spice Level', '🌶️', '#ef4444', 1),
  ('Mild', 'Spice Level', '🫑', '#22c55e', 2),
  ('No Spice', 'Spice Level', '❄️', '#3b82f6', 3),
  ('Gluten-Free', 'Dietary', '🌾', '#f59e0b', 10),
  ('Dairy-Free', 'Dietary', '🥛', '#8b5cf6', 11),
  ('Vegan', 'Dietary', '🌱', '#22c55e', 12),
  ('Vegetarian', 'Dietary', '🥬', '#16a34a', 13),
  ('Nut-Free', 'Dietary', '🥜', '#ef4444', 14),
  ('Extra Cheese', 'Preparation', '🧀', '#f59e0b', 20),
  ('Well Done', 'Preparation', '🔥', '#ef4444', 21),
  ('No Onions', 'Preparation', '🧅', '#a855f7', 22),
  ('No Garlic', 'Preparation', '🧄', '#a855f7', 23);
