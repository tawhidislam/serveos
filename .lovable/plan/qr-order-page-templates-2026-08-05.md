# QR Order Page Templates

Give each restaurant a choice of layout for the page diners land on after scanning a table QR code, selectable from the Table Management page next to the existing QR sticker template picker.

## Templates (layout variants)

1. **Classic list** (current behaviour, default) — category rail + stacked rows with thumbnails.
2. **Gallery grid** — 2-column image-first cards, big photos, price chip overlay.
3. **Compact menu** — text-only dense list grouped by category, no images; fastest for large menus and slow connections.
4. **Showcase** — full-width hero card per category with horizontally scrollable item cards.

All variants keep the same functionality: search, category navigation, add-to-cart with add-on drawer, cart FAB/sheet, active-orders banner, promo banner, and Call Waiter.

## Selection UI

On Table Management, in the QR settings area where the sticker template is chosen, add an "Ordering page layout" section:
- 4 preview cards (thumbnail + name + one-line description), current one highlighted.
- Save writes to restaurant settings alongside the existing QR template save.
- A "Preview" link opens a real table's order page in a new tab so the owner can see it live.

## Technical notes

- Add `order_page_template text not null default 'classic'` to `restaurant_settings` (migration), and expose it in the `RestaurantSettings` type/defaults in `src/hooks/useSettings.ts`.
- Refactor `src/pages/TableOrderPage.tsx`: keep all data fetching, cart, and order-placement logic in the page; extract the menu-rendering portion into layout components under `src/components/table-order/layouts/` (`ClassicLayout`, `GalleryLayout`, `CompactLayout`, `ShowcaseLayout`) sharing one props contract (grouped categories, section refs, add handler, qty getter, currency format).
- The page picks the layout from `settings.order_page_template`, defaulting to classic; settings are read via the table's restaurant so the diner always gets that tenant's choice.
- Support `?_order_template=` query override for preview links only.
- Table Management: add the picker UI and include the new field in its existing settings update; reuse the current template-card styling from the QR sticker picker.
