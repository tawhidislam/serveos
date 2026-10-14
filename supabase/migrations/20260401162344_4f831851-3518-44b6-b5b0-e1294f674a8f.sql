
-- Employee shifts table
CREATE TABLE public.employee_shifts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TEXT NOT NULL DEFAULT '09:00',
  end_time TEXT NOT NULL DEFAULT '17:00',
  hours_worked NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Employee tips table
CREATE TABLE public.employee_tips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tip_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'cash',
  order_id UUID REFERENCES public.orders(id),
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Payroll records table
CREATE TABLE public.payroll_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  base_pay NUMERIC NOT NULL DEFAULT 0,
  tips_total NUMERIC NOT NULL DEFAULT 0,
  bonuses NUMERIC NOT NULL DEFAULT 0,
  deductions NUMERIC NOT NULL DEFAULT 0,
  net_pay NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  paid_at TIMESTAMP WITH TIME ZONE,
  branch_id UUID REFERENCES public.branches(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_tips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- RLS for employee_shifts
CREATE POLICY "Admin can manage shifts" ON public.employee_shifts FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage shifts" ON public.employee_shifts FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff can view own shifts" ON public.employee_shifts FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS for employee_tips
CREATE POLICY "Admin can manage tips" ON public.employee_tips FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage tips" ON public.employee_tips FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff can view own tips" ON public.employee_tips FOR SELECT TO authenticated USING (user_id = auth.uid());

-- RLS for payroll_records
CREATE POLICY "Admin can manage payroll" ON public.payroll_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager can manage payroll" ON public.payroll_records FOR ALL TO authenticated USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "Staff can view own payroll" ON public.payroll_records FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Updated_at triggers
CREATE TRIGGER update_employee_shifts_updated_at BEFORE UPDATE ON public.employee_shifts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payroll_records_updated_at BEFORE UPDATE ON public.payroll_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
