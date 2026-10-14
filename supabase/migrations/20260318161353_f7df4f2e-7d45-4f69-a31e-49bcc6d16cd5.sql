
-- Addon groups (e.g., "Size", "Extras", "Toppings")
CREATE TABLE public.menu_item_addons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'single' CHECK (type IN ('single', 'multi')),
  required BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Individual options within an addon group
CREATE TABLE public.menu_item_addon_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  addon_id UUID NOT NULL REFERENCES public.menu_item_addons(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_modifier NUMERIC NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.menu_item_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_addon_options ENABLE ROW LEVEL SECURITY;

-- Viewable by all (public menu)
CREATE POLICY "Addons viewable by all" ON public.menu_item_addons FOR SELECT TO public USING (true);
CREATE POLICY "Addon options viewable by all" ON public.menu_item_addon_options FOR SELECT TO public USING (true);

-- Admin can manage
CREATE POLICY "Admin can manage addons" ON public.menu_item_addons FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admin can manage addon options" ON public.menu_item_addon_options FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- Manager can manage
CREATE POLICY "Manager can manage addons" ON public.menu_item_addons FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Manager can manage addon options" ON public.menu_item_addon_options FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
