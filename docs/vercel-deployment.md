# Dantown production deployment

This repository deploys as one Next.js application from the repository root. The root
`vercel.json` deliberately installs from the lockfile, builds the `@dantown/web`
workspace, collects `apps/web/.next`, and schedules the domain-event dispatch route.

## 1. Create the Vercel project

Import the repository with its root directory left at the repository root. Do not set
`apps/web` as Vercel's Root Directory: the root workspace owns the lockfile and the
build command. Vercel reads `vercel.json`, so leave the Install Command, Build Command,
and Output Directory at their repository defaults unless the file changes.

Before deploying, run the same checks locally:

```bash
npm.cmd run verify
npm.cmd run test:e2e
```

`test:e2e` starts a local Next.js server automatically. To point Playwright at an
already-running deployment, set `E2E_BASE_URL` to its URL.

On a new development or CI machine, install the browser used by the test once:

```bash
npx playwright install chromium
```

## 2. Configure Vercel environment variables

Copy names from `.env.example`; do not upload `.env.local`. At a minimum, set these
values for the Production environment:

| Variable | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The publishable/anon key for that Supabase project |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only Supabase service-role key |
| `NEXT_PUBLIC_APP_URL` | The canonical HTTPS Dantown site URL, for example `https://www.example.com` |
| `CRON_SECRET` | A long, unique random secret used by Vercel Cron |

Never prefix `SUPABASE_SERVICE_ROLE_KEY` with `NEXT_PUBLIC_`; it creates customer
records and role assignments and must remain available only to server routes. Add the
payment, automation, maps, delivery, AI, and optional quick-access variables only when
those features are enabled.

The configured daily cron route also needs `DANTOWN_DOMAIN_EVENT_WEBHOOK_URL` and
`DANTOWN_DOMAIN_EVENT_WEBHOOK_SECRET` when domain-event delivery is enabled. Without
them the route intentionally returns `503` rather than dropping events. If event
delivery is not ready, remove the cron entry from `vercel.json` before the first
production deploy to avoid scheduled error logs.

## 3. Connect Supabase Auth to the Dantown website

In Supabase Auth URL Configuration, set the Site URL to the same canonical value as
`NEXT_PUBLIC_APP_URL`. Add exact redirect URLs for the production domain:

```text
https://YOUR-DOMAIN/auth/callback
https://YOUR-DOMAIN/auth/confirm
```

For local work, add `http://127.0.0.1:3001/**`. Add the appropriate Vercel preview
wildcard only if people sign in on preview deployments. For Google login, configure the
Google provider in Supabase and place Supabase's provider callback URL in Google Cloud;
the application then receives the user at `/auth/callback`.

Use a custom SMTP provider before inviting real customers. It provides dependable
confirmation and recovery email delivery and lets the confirmation email use the
requested redirect URL.

## 4. User provisioning and fast routing

The flow is intentionally database-backed:

1. A person signs up with email/password or Google, creating the Supabase Auth user.
2. The email-confirmation or OAuth callback exchanges the session and sends the person
   to `/auth/complete`.
3. That server route creates a `customers` row and the minimal `CUSTOMER` role only if
   they do not already exist. Repeated sign-ins are safe.
4. The application reads roles and permissions from the database, then sends customers
   to `/account`, cashiers to `/pos`, and authorised staff to `/business-center`.

Only customer display fields are copied from provider metadata. Roles and permissions
are assigned server-side, so a user cannot gain staff access by editing their profile.

## 5. Database and release check

Apply the committed `supabase/migrations` to the same Supabase project before enabling
production authentication. The user/role/customer tables and their row-level security
policies must be in place for the provisioning route to work. Then deploy and verify a
new email signup, an email-confirmation return, Google login, a normal repeat login,
and one staff login.

Vercel Cron automatically sends `Authorization: Bearer <CRON_SECRET>` to the configured
route in production. Keep the secret only in Vercel and rotate it if it is exposed.
