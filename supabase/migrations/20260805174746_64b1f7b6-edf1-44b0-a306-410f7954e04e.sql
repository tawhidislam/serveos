DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='restaurant_settings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurant_settings';
  END IF;
END $$;

ALTER TABLE public.restaurant_settings REPLICA IDENTITY FULL;