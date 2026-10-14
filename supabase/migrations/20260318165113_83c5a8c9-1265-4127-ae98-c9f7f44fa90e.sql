
-- Cash drawer sessions for tracking cash in/out
CREATE TABLE public.cash_drawer_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_by uuid NOT NULL,
  closed_by uuid,
  opening_balance numeric NOT NULL DEFAULT 0,
  closing_balance numeric,
  cash_in numeric NOT NULL DEFAULT 0,
  cash_out numeric NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  branch_id uuid REFERENCES public.branches(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_drawer_sessions ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view drawer sessions" ON public.cash_drawer_sessions
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'waiter') OR 
    opened_by = auth.uid()
  );

CREATE POLICY "Staff can create drawer sessions" ON public.cash_drawer_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    has_role(auth.uid(), 'waiter')
  );

CREATE POLICY "Staff can update drawer sessions" ON public.cash_drawer_sessions
  FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager') OR 
    opened_by = auth.uid()
  );
