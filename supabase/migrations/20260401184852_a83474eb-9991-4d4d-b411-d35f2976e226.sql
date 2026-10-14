
CREATE TABLE public.menu_item_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customization_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(menu_item_id, tag_id)
);

ALTER TABLE public.menu_item_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu item tags viewable by all" ON public.menu_item_tags FOR SELECT TO public USING (true);
CREATE POLICY "Admin can manage menu item tags" ON public.menu_item_tags FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage menu item tags" ON public.menu_item_tags FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
