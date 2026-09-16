# Authentication

Supabase Auth owns identities and sessions. `apps/web/lib/supabase/server.ts` creates a cookie-aware server client. The browser client uses the public anon key. `apps/web/lib/supabase/admin.ts` is server-only and is the only service-role client.

Set public values in `.cal` from `.env.example`. Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code or `NEXT_PUBLIC_*` variables.

## Flows

Customer registration is handled by `POST /api/auth/register`. The server validates input, creates the Supabase Auth user, creates the customer record, and assigns the CUSTOMER role. Staff accounts are not publicly registered; they must be created by an authorized administrator through an invitation workflow.

Login and password recovery use the browser Supabase client. Session cookies are refreshed by `apps/web/proxy.ts`, and logout calls the server-side sign-out route. Tokens are not stored manually in localStorage.

## Protection Model

Middleware blocks unauthenticated access to `/account`, `/staff`, and `/admin`. Server pages then load the user&apos;s roles and permissions and call `requireAuthenticated`, `requireAuthorizedRole`, or `requireAuthorizedPermission` before rendering private content. Database RLS remains the final data boundary.

The service-role client is never imported by client components. Protected API routes must validate the request with Zod and perform an authorization check before writing data.

## Staff Invitations

`POST /api/admin/team/invite` requires `users.create`. The request validates email, name, and a centralized role value. CEO assignment additionally requires the caller to have the CEO role. Successful invitations create an audit record with `STAFF_INVITED`; public registration can never create staff roles.
