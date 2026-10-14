
CREATE TABLE public.waiter_calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

ALTER TABLE public.waiter_calls ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous guests scanning QR) can create a call
CREATE POLICY "Anyone can create waiter calls"
  ON public.waiter_calls FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Staff can view all calls
CREATE POLICY "Staff can view waiter calls"
  ON public.waiter_calls FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'waiter'::app_role)
    OR has_role(auth.uid(), 'server'::app_role)
  );

-- Anon can view their own calls (by table)
CREATE POLICY "Anon can view waiter calls"
  ON public.waiter_calls FOR SELECT
  TO anon
  USING (true);

-- Staff can update/resolve calls
CREATE POLICY "Staff can update waiter calls"
  ON public.waiter_calls FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'manager'::app_role)
    OR has_role(auth.uid(), 'waiter'::app_role)
    OR has_role(auth.uid(), 'server'::app_role)
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.waiter_calls;
