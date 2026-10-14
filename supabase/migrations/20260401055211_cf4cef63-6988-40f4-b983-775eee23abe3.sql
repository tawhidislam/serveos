
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  email text NOT NULL,
  phone text,
  reservation_date date NOT NULL,
  reservation_time text NOT NULL,
  party_size integer NOT NULL DEFAULT 2,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create reservations" ON public.reservations
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Admin can manage reservations" ON public.reservations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Manager can manage reservations" ON public.reservations
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'manager'::public.app_role));
