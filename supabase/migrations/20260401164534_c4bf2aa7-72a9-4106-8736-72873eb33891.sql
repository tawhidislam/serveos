
DO $$ 
DECLARE
  tbl TEXT;
  trg TEXT;
BEGIN
  FOR tbl, trg IN VALUES
    ('expense_categories', 'audit_expense_categories'),
    ('orders', 'audit_orders'),
    ('order_items', 'audit_order_items'),
    ('payroll_records', 'audit_payroll_records'),
    ('inventory_items', 'audit_inventory_items'),
    ('inventory_transactions', 'audit_inventory_transactions'),
    ('budget_alerts', 'audit_budget_alerts'),
    ('cash_drawer_sessions', 'audit_cash_drawer_sessions'),
    ('employee_tips', 'audit_employee_tips'),
    ('employee_shifts', 'audit_employee_shifts'),
    ('restaurant_settings', 'audit_restaurant_settings'),
    ('menu_items', 'audit_menu_items')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.triggers 
      WHERE trigger_name = trg AND event_object_table = tbl AND trigger_schema = 'public'
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.log_audit_change()',
        trg, tbl
      );
    END IF;
  END LOOP;
END $$;
