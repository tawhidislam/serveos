
CREATE TABLE public.menu_item_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  caption TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_item_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Menu item images viewable by all"
  ON public.menu_item_images FOR SELECT
  TO public USING (true);

CREATE POLICY "Admin can manage menu item images"
  ON public.menu_item_images FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Manager can manage menu item images"
  ON public.menu_item_images FOR ALL
  TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
