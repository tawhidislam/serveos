
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to reset the sequence
CREATE OR REPLACE FUNCTION public.reset_kitchen_ticket_seq()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  ALTER SEQUENCE public.kitchen_ticket_seq RESTART WITH 1;
END;
$$;

-- Schedule daily reset at midnight UTC
SELECT cron.schedule(
  'reset-kitchen-tickets-daily',
  '0 0 * * *',
  $$SELECT public.reset_kitchen_ticket_seq()$$
);
