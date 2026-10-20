# Customer notifications

Customer notifications use dedicated `customer_notification_*` tables and APIs. They do not share the staff `notifications` audience. Customers are derived from their authenticated session; database ownership policies and server-side checks scope inbox entries, preferences, push subscriptions, and stock-alert requests to that user.

## Database migration

Review `supabase/migrations/20261020135025_customer_notification_system.sql` and apply it to the intended Supabase project through the approved database deployment process. This feature does not apply migrations automatically. For local validation, run the migration against a local Supabase/Postgres environment before deploying it remotely.

The migration adds customer preferences, inbox entries, push subscriptions, channel delivery records, back-in-stock requests, RLS policies, event triggers, and worker claim/enqueue functions. Existing staff notification tables and customer identity records are unchanged.

## Browser push

Generate VAPID keys with `npx web-push generate-vapid-keys`. Generate a separate AES-256 key for encrypting push subscription endpoints and keys at rest:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Configure these deployment variables:

- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`: public VAPID key; exposed to browsers.
- `VAPID_PRIVATE_KEY`: private VAPID key; server-side only.
- `VAPID_SUBJECT`: a valid `mailto:` or HTTPS contact URI.
- `CUSTOMER_PUSH_ENCRYPTION_KEY`: base64-encoded 32-byte encryption key; server-side only.

Customers grant browser permission only after selecting **Enable push on this device**. Push payloads contain a generic title/body and a same-origin path, not order or quote details. The account inbox remains usable if push is unsupported or denied.

## Optional email

The application can send customer email through Resend when both `RESEND_API_KEY` and `CUSTOMER_EMAIL_FROM` are configured. No email is sent until those values are provided. Delivery records retain per-channel outcomes; provider requests use the delivery idempotency key to avoid duplicates on retries. Marketing email is sent only when both the relevant category consent and the marketing-email channel are enabled. Customers can withdraw those opt-ins in **Account settings → Notification preferences**.

## Worker and scheduling

The Vercel cron invokes `/api/internal/customer-notifications/dispatch` every minute. Vercel must support the configured cron frequency. The handler requires the existing server-only `CRON_SECRET`; Vercel sends it as a bearer token. The worker enqueues promotion and quotation-expiry reminders, claims deliveries safely, honors channel opt-outs and quiet hours for nonessential push, and retries transient failures.

To invoke the worker manually, send an authenticated `POST` using a bearer token read from `CRON_SECRET`, with an optional JSON body such as `{"limit":50}`. Never expose `CRON_SECRET`, VAPID private keys, Resend credentials, or the subscription encryption key in client code or public environment variables.

## Known integration boundaries

- Guest checkout orders do not receive account notifications. Guest order access remains governed by the existing verified-order mechanism.
- Support escalations generate receipt/status updates. The current schema has no customer-visible staff-reply message model, so staff reply notifications require that workflow to be added first.
- No customer-facing authentication/security event hook exists in the current application; account-security notices will be emitted only after that event source is implemented.
- The local database migration and live push/email providers must be validated in the deployment environment; no production migration or provider call is performed by this implementation.
