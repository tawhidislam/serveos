
-- Create a sequence for daily ticket numbers
CREATE SEQUENCE IF NOT EXISTS public.kitchen_ticket_seq START 1;

-- Add ticket_number column to orders
ALTER TABLE public.orders ADD COLUMN ticket_number integer;

-- Function to assign ticket number on new order
CREATE OR REPLACE FUNCTION public.assign_ticket_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.ticket_number := nextval('public.kitchen_ticket_seq');
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign ticket number
CREATE TRIGGER trg_assign_ticket_number
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.assign_ticket_number();
