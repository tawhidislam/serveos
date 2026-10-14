
-- Create floor_plans table
CREATE TABLE public.floor_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.floor_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Floor plans viewable by all"
ON public.floor_plans FOR SELECT
USING (true);

CREATE POLICY "Admin can manage floor plans"
ON public.floor_plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Manager can manage floor plans"
ON public.floor_plans FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'manager'))
WITH CHECK (public.has_role(auth.uid(), 'manager'));

CREATE TRIGGER update_floor_plans_updated_at
BEFORE UPDATE ON public.floor_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add position columns to restaurant_tables
ALTER TABLE public.restaurant_tables
ADD COLUMN floor_plan_id UUID REFERENCES public.floor_plans(id) ON DELETE SET NULL,
ADD COLUMN position_x NUMERIC DEFAULT 50,
ADD COLUMN position_y NUMERIC DEFAULT 50;

-- Create storage bucket for floor plan images
INSERT INTO storage.buckets (id, name, public) VALUES ('floor-plans', 'floor-plans', true);

CREATE POLICY "Floor plan images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'floor-plans');

CREATE POLICY "Authenticated users can upload floor plan images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'floor-plans');

CREATE POLICY "Authenticated users can update floor plan images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'floor-plans');

CREATE POLICY "Authenticated users can delete floor plan images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'floor-plans');
