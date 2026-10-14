UPDATE public.marketing_footer_settings
SET columns = jsonb_set(
  columns,
  '{3,links}',
  '[{"label":"Terms & Conditions","to":"/terms"},{"label":"Privacy Policy","to":"/privacy"},{"label":"Refund Policy","to":"/refund-policy"}]'::jsonb
)
WHERE columns->3->>'title' = 'Legal';