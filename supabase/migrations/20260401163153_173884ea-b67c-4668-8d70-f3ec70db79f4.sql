
-- Audit logs table
CREATE TABLE public.audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  changed_by UUID,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);
CREATE INDEX idx_audit_logs_record_id ON public.audit_logs(record_id);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies - only admin/manager can view
CREATE POLICY "Admin can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
-- Allow inserts from triggers (service role / trigger context)
CREATE POLICY "System can insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anon can insert audit logs" ON public.audit_logs FOR INSERT TO anon WITH CHECK (true);

-- Audit trigger function
CREATE OR REPLACE FUNCTION public.log_audit_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'INSERT', to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id::TEXT, 'UPDATE', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (table_name, record_id, action, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id::TEXT, 'DELETE', to_jsonb(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Attach triggers to financial tables
CREATE TRIGGER audit_orders AFTER INSERT OR UPDATE OR DELETE ON public.orders FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_expenses AFTER INSERT OR UPDATE OR DELETE ON public.expenses FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_inventory_items AFTER INSERT OR UPDATE OR DELETE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_inventory_transactions AFTER INSERT OR UPDATE OR DELETE ON public.inventory_transactions FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_employee_shifts AFTER INSERT OR UPDATE OR DELETE ON public.employee_shifts FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_employee_tips AFTER INSERT OR UPDATE OR DELETE ON public.employee_tips FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_payroll_records AFTER INSERT OR UPDATE OR DELETE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION log_audit_change();
CREATE TRIGGER audit_cash_drawer_sessions AFTER INSERT OR UPDATE OR DELETE ON public.cash_drawer_sessions FOR EACH ROW EXECUTE FUNCTION log_audit_change();
