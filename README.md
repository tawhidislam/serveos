# ServeOS

A restaurant management platform with restaurant websites, ordering, kitchen,
billing, staff tools, and a platform administration panel.

Tech stack:

- Frontend: React (mobile-first, modern UI with Tailwind)

- Backend: Supabase (Auth, PostgreSQL, Realtime, Storage)

System modules:

- Authentication & roles

- Table & QR management

- Menu & category system

- Order management (dine-in via QR)

- Kitchen dashboard (KDS)

- Billing & payments

- Admin analytics dashboard

Architecture:

- Clean component structure

- API service layer

- Realtime subscriptions for orders

## Development

You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone https://github.com/tawhidislam/serveos.git
cd serveos
npm i
cp .env.example .env
npm run dev
```

The app runs on http://localhost:8080.

## Local Supabase

This project uses a local Supabase stack for development (Auth, PostgreSQL,
Realtime, Storage). You need [Docker](https://docs.docker.com/get-docker/) and
the [Supabase CLI](https://supabase.com/docs/guides/cli).

```sh
# Start the local stack (Postgres, Auth, REST, Realtime, Storage, Studio)
supabase start

# Stop it
supabase stop
```

Local endpoints:

- API: http://127.0.0.1:54321
- DB: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`
- Studio: http://127.0.0.1:54323
- Mail (Inbucket): http://127.0.0.1:54324

The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from
`.env`. Replace the example values with the local stack values printed by
`supabase status`, then start or restart the development server.

Local environment files, database backups, generated build output, and dependency
directories are excluded from Git. Copy `supabase/functions/.env.example` to
`supabase/functions/.env.local` for server-only settings. Never commit service-role
keys or Gemini credentials.

## Restaurant mobile API

The versioned API supports restaurant owners, admins, managers, kitchen staff,
waiters, and servers. It runs locally at
`http://127.0.0.1:54321/functions/v1/mobile-api/v1` when Edge Functions are served.

- [API setup and workflow guide](docs/mobile-api/README.md)
- [OpenAPI specification](docs/mobile-api/openapi.json)
- [Postman collection](docs/mobile-api/ServeOS-Mobile-API.postman_collection.json)
- [TypeScript API client](sdk/serveos-mobile-api.ts)
- [Flutter app build prompt](docs/mobile-api/FLUTTER_APP_BUILD_PROMPT.md)

Hosted deployment and tightening the existing legacy direct-database permissions
remain necessary before a production release. The mobile gateway's permission
checks do not replace the separate legacy PostgREST/web SDK access surface.

## Restaurant creation regression tests

With local Supabase and the development server running:

```sh
npm test
npx playwright test tests/restaurant-creation.spec.ts --workers=1
```

The browser suite tests signup, owner login, onboarding, duplicate and reserved
URLs, transaction rollback, concurrent setup, tenant isolation, platform
creation, and selected-plan redirects. It uses disposable local accounts and
cleans them up afterward. It refuses to run against a remote Supabase URL.

For an existing Chrome installation, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`
to its executable path before running Playwright.

### AI support reply drafts

Platform administrators can generate a suggestion from an open support conversation,
review it, and choose **Use draft** before manually sending. Existing composer text is
preserved when a suggestion is added. No generated text is automatically sent or
stored as a customer message. Private notes and attachments are excluded from AI
context; the last 30 public messages and current public packages are included.

1. Copy `supabase/functions/.env.example` to `supabase/functions/.env.local` and set
   `GEMINI_API_KEY` there. Keep the key server-side. `GEMINI_SUPPORT_MODEL` is optional.
2. For local development, run:
   `supabase functions serve --env-file supabase/functions/.env.local`.
3. Apply the database migration `20261015110000_support_ai_drafts.sql` if it has not
   been applied, and enable **AI reply drafts** under `/platform/support?tab=settings`.
4. Open a chat conversation and select **AI draft reply**, review the suggestion,
   select **Use draft**, edit the text, and then select **Send reply**.

For hosted Supabase, configure `GEMINI_API_KEY` using Supabase server secrets,
apply the migration, and deploy `support-ai-draft`. Create a Gemini API key in Google AI Studio. The function checks platform-admin access, uses an
atomic limit of 10 generation requests per administrator per minute, times out
provider requests after 45 seconds, and calls the Gemini generateContent API with a server-side key.
Missing credentials, disabled settings, and provider failures show actionable errors.

### Automatic AI support replies

Enable **Automatic AI replies** in `/platform/support?tab=settings`. This is
separate from reviewed drafts and applies to new chat conversations. The database
queues incoming customer messages and dispatches a secret-protected Edge worker;
pg_cron retries pending work every minute. Replies are labelled as AI messages.
Customer requests for a human, attachment review, unsupported account actions,
and provider failures hand the conversation to the human inbox. Assigning an
admin, sending a human reply, or selecting **Take over from AI** stops automation.
The worker checks the conversation again before publishing, so a late AI response
cannot interrupt a human takeover or post twice for the same queued job.

Local setup:

```sh
node scripts/configure-local-support-ai.mjs
# Set GEMINI_API_KEY in supabase/functions/.env.local.
supabase functions serve --env-file supabase/functions/.env.local
```

The setup script creates a dedicated worker token without printing it and stores
its matching value and the local worker URL in database Vault. It preserves an
existing API key. The migration `20261015120000_automatic_support_assistant.sql`
must be applied first. For hosted Supabase, deploy `support-ai-auto` with JWT
verification disabled (it validates its dedicated secret instead), configure
`SUPPORT_AI_WORKER_SECRET` and `GEMINI_API_KEY` as server secrets, and create Vault
secrets named `support_ai_worker_token` and `support_ai_worker_url` (the latter is
`https://<project-ref>.supabase.co/functions/v1/support-ai-auto`). Ensure pg_net,
pg_cron, and Vault are enabled before applying the migration. No secrets belong in
frontend environment variables or public support settings.

### Manage Gemini credentials from the platform panel

Open `/platform/support?tab=settings` and use **Gemini API connection**. Paste a
new key, choose a model, and select **Save Gemini connection**. **Test saved
connection** checks the saved key/model with a short Gemini request. Leave the key
field blank to keep the existing key when changing the model. Changes are read
for each new AI request and do not require restarting functions.

The `20261015130000_panel_gemini_credentials.sql` migration stores keys in database
Vault. Deploy `support-ai-config` alongside both reply functions for hosted use.
Only platform administrators can save or test via that function; the underlying
secret-reading and secret-writing RPCs accept only the backend service role.
The panel receives configured status and the model, never the saved key. A panel
key takes priority over `GEMINI_API_KEY` in the server environment; existing env
configuration remains a fallback. Keys are never stored in public settings.

### Teach the support assistant about the platform

Manage approved guides at `/platform/support?tab=knowledge`. Fifteen starter
articles describe the actual platform workflows: restaurant signup and trial,
login and staff roles, menus and photos, QR tables, orders, subscriptions,
payments, add-ons, themes, domains, business tools, and human handoff.
Create or edit guides and enable **Use this guide in AI replies** to publish them.
Unpublished drafts are excluded. Only platform administrators can manage these
articles; visitors cannot read or change the knowledge table directly.

Both automatic replies and reviewed drafts retrieve published reference articles
for each new generation. Relevant articles are ranked first with a bounded text
budget; current public packages/add-ons and the selected restaurant's subscription
supply live details and take priority over stale article prices or entitlement
claims. This is an editable reference knowledge base, not model fine-tuning.
Never put passwords, API keys, or private customer information in articles.
Apply `20261015140000_support_platform_knowledge.sql` and deploy the updated
reply functions for hosted installations. Gemini availability is still required
for live answers; the reference library does not fix provider overloads.
