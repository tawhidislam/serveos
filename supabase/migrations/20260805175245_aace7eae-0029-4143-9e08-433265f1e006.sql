-- ── Short links ────────────────────────────────────────────────
CREATE TABLE public.qr_short_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX qr_short_links_code_key ON public.qr_short_links (upper(code));
CREATE INDEX qr_short_links_restaurant_idx ON public.qr_short_links (restaurant_id);
CREATE INDEX qr_short_links_table_idx ON public.qr_short_links (table_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qr_short_links TO authenticated;
GRANT ALL ON public.qr_short_links TO service_role;

ALTER TABLE public.qr_short_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own restaurant short links"
ON public.qr_short_links FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id() OR public.is_platform_admin());

CREATE POLICY "Staff create short links"
ON public.qr_short_links FOR INSERT TO authenticated
WITH CHECK (
  restaurant_id = public.current_restaurant_id()
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Staff update short links"
ON public.qr_short_links FOR UPDATE TO authenticated
USING (
  restaurant_id = public.current_restaurant_id()
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'manager')
  )
)
WITH CHECK (restaurant_id = public.current_restaurant_id());

CREATE POLICY "Staff delete short links"
ON public.qr_short_links FOR DELETE TO authenticated
USING (
  restaurant_id = public.current_restaurant_id()
  AND (
    public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'admin')
  )
);

CREATE TRIGGER update_qr_short_links_updated_at
BEFORE UPDATE ON public.qr_short_links
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Scan events ────────────────────────────────────────────────
CREATE TABLE public.qr_scans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  short_link_id UUID NOT NULL REFERENCES public.qr_short_links(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID,
  device_hash TEXT,
  referrer TEXT,
  user_agent TEXT,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX qr_scans_link_time_idx ON public.qr_scans (short_link_id, scanned_at DESC);
CREATE INDEX qr_scans_restaurant_time_idx ON public.qr_scans (restaurant_id, scanned_at DESC);

GRANT SELECT ON public.qr_scans TO authenticated;
GRANT ALL ON public.qr_scans TO service_role;

ALTER TABLE public.qr_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own restaurant scans"
ON public.qr_scans FOR SELECT TO authenticated
USING (restaurant_id = public.current_restaurant_id() OR public.is_platform_admin());

-- ── Public resolver (also logs the scan) ───────────────────────
CREATE OR REPLACE FUNCTION public.resolve_qr_short_link(
  _code TEXT,
  _device_hash TEXT DEFAULT NULL,
  _referrer TEXT DEFAULT NULL,
  _user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(table_id UUID, restaurant_id UUID, code TEXT, label TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _link public.qr_short_links%ROWTYPE;
BEGIN
  SELECT * INTO _link
  FROM public.qr_short_links l
  WHERE upper(l.code) = upper(btrim(_code))
    AND l.is_active
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  INSERT INTO public.qr_scans (short_link_id, restaurant_id, table_id, device_hash, referrer, user_agent)
  VALUES (_link.id, _link.restaurant_id, _link.table_id, left(_device_hash, 64), left(_referrer, 500), left(_user_agent, 500));

  RETURN QUERY SELECT _link.table_id, _link.restaurant_id, _link.code, _link.label;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_qr_short_link(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_qr_short_link(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;