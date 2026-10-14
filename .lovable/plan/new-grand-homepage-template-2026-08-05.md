# New "Grand" homepage template

Adds an 8th homepage template to the restaurant site, fully wired into the Homepage Editor, plus a new editable Gallery section.

## Look and feel

Dark and gold fine-dining aesthetic:

- Background `#0a0a0a`, deep warm panel `#1a1508`, gold accent `#c9a227`, cream text `#f5f0e6`
- Large serif headings with letter-spaced gold overlines, thin gold hairline rules between sections
- Slow fade/parallax reveals, generous whitespace, full-bleed imagery

## Page structure

```text
Full-bleed hero (image + gradient scrim, overline, serif title, 2 CTAs)
Gold-rule stats strip
Featured menu — editorial two-column list with gold price leaders
Story — image left, text right, gold badge
Gallery — photo strip / mosaic (new section)
Contact strip (hours, address, phone)
Closing CTA band on gold
```

## Editor changes

- New template card "Grand" in the Template tab (with preview thumbnail), selectable like the others
- Supports every existing section: Hero, Stats, Featured Menu, Story, CTA, Contact, Colors, SEO
- New **Gallery** tab: title, subtitle, and a list of images (upload or URL, reorder, remove). The tab is shown only for templates that render a gallery — Grand for now — and is disabled for the rest
- Colors tab gets a Grand palette config (background, secondary background, accent, accent light, text) so owners can retint it

## Technical notes

- `src/components/website/templates/GrandHome.tsx` + section components under `src/components/website/home/grand/`, lazy-loaded from `HomePage.tsx` template map
- Register `grand` in `HomepageEditor.tsx`: `templates` array, `templateSections` map (adds `gallery`), `templateColorConfigs`, and `defaultBgMap` in `WebsiteLayout.tsx`
- Gallery content is stored in the existing `homepage_content` table under section key `gallery` (JSONB) — no schema change needed; images upload to the existing gallery/branding storage bucket using the current compression + size-limit helpers
- Template thumbnail generated as `src/assets/template-grand.jpg`
- All template colors read from `useThemeColors` with the palette above as defaults
