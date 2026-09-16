# Dantown Electrical Ecosystem

Stage 1 through Stage 4 foundation for a unified electrical commerce operating system serving customers, staff and management from one Supabase backend.

## Created in Stage 1

- npm workspace monorepo preserving the `apps`, `packages`, `supabase`, `automation` and `docs` architecture.
- Next.js App Router web application with TypeScript, Tailwind CSS, Framer Motion and Lucide React.
- Responsive Dantown Electrical storefront shell with announcement bar, navigation, hero, category browsing, product presentation, project quote CTA and footer.
- Shared packages for UI naming, application constants and role types.
- Supabase browser client foundations for database and authentication packages.
- Zod-based public environment parsing and `.env.example` placeholders.
- ESLint flat configuration, production scripts and `.gitignore`.
- Product intelligence and n8n architecture for supplier ingestion, document extraction, conservative product matching, landed cost, AI pricing recommendations, approval, inventory receiving, synchronization, retries and human review.

## Structure

```text
apps/web        Next.js web application
apps/mobile     Reserved Expo/React Native application
packages/ui     Shared UI foundations
packages/shared Shared constants and types
packages/database Supabase database client foundations
packages/auth   Supabase authentication client foundations
supabase/       Reserved migrations, seed data and functions
automation/n8n  Reserved n8n workflows
docs/           Project documentation
```

## Installation

```bash
npm install
```

Copy `.env.example` to `.env.local` and provide public Supabase values when connecting the app to a project. Secrets remain server-side and are intentionally not included in this foundation.

## Development Commands

```bash
npm run dev
npm run lint
npm run build
npm run start
npm run test
npm run test:e2e
```

## Validation

Stage 1 was validated with `npm run lint` and `npm run build` on August 26, 2026. Both completed successfully. The production build currently exposes the `/` route only; business routes and data access belong to later stages.

## Next Stage

Stage 2 adds the PostgreSQL data foundation, RLS policies, development seed data, typed database contracts, secure Supabase clients, shared pricing/stock rules, and reusable product, inventory, order, payment and quotation services. Stage 3 adds Supabase Auth flows, cookie session refresh, centralized RBAC, protected route shells, server-side authorization helpers, customer registration, and security tests. Seed records are explicitly development/demo data.

### Supabase Setup

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

For local development, use `supabase start` and `supabase db reset`. Seed files in `supabase/seed/` run after migrations and must never be treated as live stock.

### Stage 2 Environment

Required public values are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Server-only operations may use `SUPABASE_SERVICE_ROLE_KEY`. Payment, email and AI variables remain placeholders in `.env.example` and are not implemented in this stage.

### Stage 2 Scope Boundary

The complete storefront, POS interface, mobile UI, real Daraja integration, AI provider connection, and production payment processing are intentionally deferred. Stage 4 contains an AI pricing boundary and mock workflow contracts, not a live AI integration. The next recommended stage is product/catalog and inventory UI integration against the authenticated database foundation.

## Stage 4 Automation

The automation architecture lives in `automation/n8n/`. Fifteen workflow specifications and a sample supplier invoice describe the supplier-to-platform flow. n8n orchestrates external inputs and retries; Supabase remains authoritative for products, prices, inventory, approvals and audit records.

Stage 4 adds automation job tracking, supplier documents, extraction runs, product matches, product drafts, landed-cost calculations, configurable pricing rules, pricing recommendations/approvals and price history. Use `/admin/automation` for the protected review shell. No provider credentials are stored in source control.

### Additional live channels

The automation layer now accepts direct n8n webhooks for the operational communication channels that matter to Dantown: WhatsApp, email, customer CRM updates and AI assistant interactions. Those requests are persisted to the shared `automation_jobs` table in Supabase and appear in the `/admin/automation` dashboard automatically.

Available webhook routes:

- `/api/automation/ingest` for generic automation events
- `/api/automation/whatsapp` for WhatsApp conversations and lead follow-ups
- `/api/automation/email` for transactional or marketing emails
- `/api/automation/crm` for lead, customer and pipeline events
- `/api/automation/ai-assistant` for chat and support conversations

Each route expects the `x-dantown-automation-secret` header and a valid `N8N_WEBHOOK_SECRET` environment value.
