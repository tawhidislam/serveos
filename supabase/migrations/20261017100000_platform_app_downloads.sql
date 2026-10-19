BEGIN;
CREATE TABLE public.platform_app_downloads (
  id boolean PRIMARY KEY DEFAULT true CHECK(id),
  content jsonb NOT NULL CHECK(jsonb_typeof(content)='object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.platform_app_downloads ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.platform_app_downloads TO anon,authenticated;
GRANT UPDATE(content) ON public.platform_app_downloads TO authenticated;
GRANT SELECT,UPDATE ON public.platform_app_downloads TO service_role;
CREATE POLICY "Public app download information" ON public.platform_app_downloads FOR SELECT TO anon,authenticated USING(true);
CREATE POLICY "Platform admins publish app downloads" ON public.platform_app_downloads FOR UPDATE TO authenticated USING(public.is_platform_admin()) WITH CHECK(public.is_platform_admin());
CREATE TRIGGER platform_app_downloads_updated_at BEFORE UPDATE ON public.platform_app_downloads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.platform_app_downloads(content) VALUES('{
  "app_name":"ServeOS Restaurant",
  "title":"Your restaurant. In your pocket.",
  "description":"One app for the people behind every great service. Manage your restaurant, keep the kitchen moving, and give your team the tools to serve with confidence.",
  "support_note":"Use your existing restaurant account. Your role, branch access, and subscription carry over to the app.",
  "android":{"enabled":true,"status":"coming_soon","store_url":"","version":"","min_os":"","released_at":"","release_notes":"","apk_url":"","file_size_bytes":null},
  "ios":{"enabled":true,"status":"coming_soon","store_url":"","version":"","min_os":"","released_at":"","release_notes":""}
}');

INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('platform-apps','platform-apps',true,52428800,ARRAY['application/vnd.android.package-archive','application/octet-stream','application/zip']);
CREATE POLICY "Public app installers" ON storage.objects FOR SELECT TO anon,authenticated USING(bucket_id='platform-apps');
CREATE POLICY "Platform admins upload installers" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='platform-apps' AND public.is_platform_admin());
CREATE POLICY "Platform admins update installers" ON storage.objects FOR UPDATE TO authenticated USING(bucket_id='platform-apps' AND public.is_platform_admin()) WITH CHECK(bucket_id='platform-apps' AND public.is_platform_admin());
CREATE POLICY "Platform admins delete installers" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='platform-apps' AND public.is_platform_admin());

-- Existing storage policies queried an ungranted table even for other buckets.
-- Keep their ownership checks inside a narrowly scoped helper instead of giving
-- every authenticated installer uploader direct access to floor-plan records.
CREATE FUNCTION public.can_access_floor_plan_storage(_object_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.floor_plans fp WHERE fp.id::text=split_part(_object_name,'.',1) AND fp.restaurant_id=public.current_restaurant_id());
$$;
REVOKE ALL ON FUNCTION public.can_access_floor_plan_storage(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_access_floor_plan_storage(text) TO authenticated;
ALTER POLICY "Admin/manager can upload floor plans" ON storage.objects WITH CHECK(bucket_id='floor-plans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND public.can_access_floor_plan_storage(name));
ALTER POLICY "Admin/manager can update floor plans" ON storage.objects USING(bucket_id='floor-plans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND public.can_access_floor_plan_storage(name)) WITH CHECK(bucket_id='floor-plans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND public.can_access_floor_plan_storage(name));
ALTER POLICY "Admin/manager can delete floor plans" ON storage.objects USING(bucket_id='floor-plans' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager')) AND public.can_access_floor_plan_storage(name));
ALTER POLICY "Members can read own restaurant floor plans" ON storage.objects USING(bucket_id='floor-plans' AND (public.is_platform_admin() OR public.can_access_floor_plan_storage(name)));

-- Preserve existing footer customizations while adding the new destination once.
UPDATE public.marketing_footer_settings AS f SET columns=CASE
  WHEN jsonb_array_length(f.columns)>0 THEN jsonb_set(f.columns,'{0,links}',COALESCE(f.columns->0->'links','[]'::jsonb)||'[{"label":"Download app","to":"/download"}]'::jsonb)
  ELSE '[{"title":"Product","links":[{"label":"Download app","to":"/download"}]}]'::jsonb END
WHERE jsonb_typeof(f.columns)='array' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(f.columns) c CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c->'links','[]'::jsonb)) l WHERE l->>'to'='/download');
COMMIT;
