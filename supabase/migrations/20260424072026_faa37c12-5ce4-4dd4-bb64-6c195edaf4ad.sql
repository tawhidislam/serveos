
UPDATE public.marketing_page_sections
SET content = jsonb_set(
  jsonb_set(content, '{pillText}', '"Built for modern restaurants"'),
  '{pillBadge}', '"New"'
)
WHERE id = '26eecee1-4b7a-4ccc-9b20-4ea9232d267d';

UPDATE public.marketing_page_sections
SET content = jsonb_set(
  content,
  '{items}',
  '[
    {"icon": "BarChart3", "title": "Analytics & Reports", "description": "Real-time revenue, top items, server performance, and accounting-grade financial reports."},
    {"icon": "ClipboardList", "title": "Menu Management", "description": "Update menus instantly across every QR code, every device — no reprints, no delays."},
    {"icon": "Users", "title": "Staff & Branches", "description": "Role-based access for kitchen, waiters, managers — plus full multi-branch support."}
  ]'::jsonb
)
WHERE id = 'a9e41ff6-5a3c-46d4-b110-dfec74c0844e';
