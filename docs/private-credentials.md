# Private Integration Credentials

Keep credentials in a password manager and in local `.env.local` files only. Never put secret values in source files, screenshots, chat messages, workflow JSON exports, or `.env.example`.

## Recommended private store

Use a password manager such as 1Password, Bitwarden, or Proton Pass. Create a vault named `Dantown Electrical - Integrations` and add separate entries for:

- Supabase production
- Supabase database password
- n8n production
- Pesapal production
- Deployment provider

Give other users access to the vault only when they need it. Do not build a credential page inside this app: application administrators, database backups, logs, and browser tools could expose those values.

## Local development

Copy `.env.example` to `apps/web/.env.local` and fill it from the password manager. The root `.gitignore` excludes `.env.local` and `.env.*.local` from Git.

Server-only values include `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `N8N_WEBHOOK_SECRET`, `PESAPAL_CONSUMER_KEY`, and `PESAPAL_CONSUMER_SECRET`. Pesapal also requires the server-only `PESAPAL_IPN_ID` registered for the deployed IPN URL and `PESAPAL_ENVIRONMENT` set to `sandbox` or `live`. Only variables prefixed with `NEXT_PUBLIC_` may be exposed to the browser. Never put a service-role key or payment secret behind that prefix.

Register `https://YOUR_DOMAIN/api/payments/pesapal-ipn` with Pesapal, then set its returned IPN ID in the server environment. The customer redirect callback is handled at `/payment/pesapal-callback`.

Set `NEXT_PUBLIC_ALLOW_AUTH_BYPASS=false` outside a disposable local development session.

For the POS RPC repair, open Supabase Dashboard > SQL Editor and run `supabase/repair-pos-checkout.sql`. The local repair command may be blocked when direct PostgreSQL port 5432 access is unavailable.

## Deployment

Add the same values through the deployment provider's encrypted Environment Variables or Secrets settings. Do not upload `.env.local` or commit it to the repository.

## Rotation required

Credentials previously stored in local files or exposed through a workspace scan should be rotated before production use:

1. Change the Supabase database password.
2. Revoke and create a new Supabase service-role key.
3. Replace the n8n webhook secret and update both ends of the integration.
4. Rotate Pesapal consumer credentials if they were shared; store live credentials only in the deployment secret store.
5. Update `.env.local` and deployment secrets, then restart the app.
