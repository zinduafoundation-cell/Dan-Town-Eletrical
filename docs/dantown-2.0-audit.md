# Dantown 2.0 Phase 1 Audit

## Executive summary
The Dantown app already has a strong commerce and operations foundation: storefront, account hub, admin portal, POS routes, Supabase-backed data access, and role-based authorization. The main issue in the current experience is not a missing platform, but a fragmented user experience: key customer flows are hidden from the mobile navigation, the account menu is too thin for signed-in users, and the order path is not surfaced consistently.

## Repository findings
- Storefront pages are live under `apps/web/app` and mostly share a common shell in `apps/web/components/storefront.tsx`.
- The customer account area is implemented under `apps/web/app/account` with order detail and order list pages already present.
- The business workspace is under `apps/web/app/business-center/page.tsx` and the shared portal shell is `apps/web/app/portal-shell.tsx`.
- Auth and permission logic exists in `apps/web/lib/auth/server.ts` and `apps/web/lib/auth/post-login.ts`.
- The app already has a role/permission model and Dantown Centre dashboards, but the UX layer was not exposing every relevant path consistently on mobile.
- The current customer account menu was effectively reduced to a single Account link for signed-in users, causing the order page and Centre access to disappear from the main navigation.

## Risk assessment
- Mobile navigation gaps reduce discoverability and create a perception that the system is incomplete.
- Order tracking is not exposed as a first-class action for customer users.
- Multiple access surfaces (storefront, account area, business center) are not yet unified into a single operating-system experience described in the master prompt.
- The app is strong on functional groundwork, but the experience needs consolidation before the larger D2.0 transformation can be considered complete.

## Current fix result
- Reintroduced full signed-in storefront links, including order tracking and Dantown Centre access.
- Updated the mobile menu to present the same primary account actions.
- Kept the core order view and navigation intact without removing existing working routes or APIs.

## Planned phases
1. Foundation hardening and navigation consistency
2. Order lifecycle and activity timeline cleanup
3. Customer tax profile and Customer 360
4. Document engine and receipt/invoice consistency
5. Inventory, supplier, quote, and project workflow alignment
6. Delivery and proof-of-delivery module upgrades
7. POS speed, offline sync, and shift reporting
8. Communication centre and messaging templates
9. Command Centre and AI briefing layer
10. Reports, analytics, and role-based security review
11. Performance, testing, and deployment validation

## Immediate next step
Continue by consolidating the order lifecycle and delivery state model before moving into the larger AI/CRM/document engine work.
