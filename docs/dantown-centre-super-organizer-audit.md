# Dantown Centre Super Organizer: architecture audit and delivery roadmap

Status: Bundled phases 2–4 are drafted locally: durable event delivery, scalable Centre metrics, and governed AI tool access. This audit is based on the current workspace source, migrations, and local verification. It does not claim a live production-database or deployment audit.

## Confirmed foundation

| Area | Existing implementation | Direction |
| --- | --- | --- |
| Identity and permissions | Supabase Auth, database-backed roles, role permissions, server-side guards, and RLS policies | Retain. AI and new Centre services must call the same guard layer. |
| Private workspace | `/business-center`, `/admin`, and `/pos` have server-side access checks | Retain route/API enforcement; never rely on navigation visibility. |
| Orders, payments, POS | Central `orders`, `order_items`, payments, status history, POS checkout RPCs, offline-sync records | Extend the existing order lifecycle; do not duplicate order or payment records. |
| Inventory and procurement | Warehouses, inventory ledger, movements, transfers, purchase orders, receiving RPCs, `inventory_health` view | Reuse this ledger for demand, alerts, and procurement recommendations. |
| Automation and audit | Automation jobs, idempotency, audit logs, notifications, product-intelligence records | Evolve into a durable event/outbox architecture. |
| DAN T AI | Per-surface access checks, approved read tools, knowledge records, escalation records | Replace single intent routing with governed tool registry and action-approval workflow. |

## Current constraints to address

1. `lib/core/events.ts` is an in-process listener map. It is useful for browser/UI events but is not durable across serverless requests, retries, or deployments.
2. Several dashboard pages currently retrieve complete product or inventory result sets to calculate metrics. That is acceptable for small catalogues but should move to indexed aggregate queries or controlled reporting views before scale.
3. The Centre and admin workspaces overlap. The Centre should become the staff-facing command plane, while the most sensitive administration remains permission-gated.
4. Existing AI uses approved context, but current intent coverage is intentionally narrow and its provider uses a legacy chat-completions shape. New controlled tools should use a strict tool schema and must not generate SQL.

## Target operating loop

```text
Customer or staff action
        -> authoritative service/RPC
        -> audit log + durable domain event
        -> workflow/outbox worker
        -> notification, task, Centre update
        -> permission-filtered DAN T AI insight or approved action proposal
```

The transaction that changes a business record remains authoritative. Events and AI never become the source of truth.

## Delivery phases

### Phase 1: controlled Command Centre

- Add a permission-aware command bar to `/business-center`.
- Support only allowlisted read operations: attention queue, pending/unpaid orders, low-stock inventory, recent orders, and a bounded same-day sales preview.
- Hold every data-changing phrase for a protected workspace; no command-bar mutation is allowed.
- Preserve the existing DAN T AI panel and the working POS, orders, inventory, and payment flows.

### Phase 2: durable operations backbone

- Add a transactional `domain_events`/outbox design, idempotency keys, worker retry state, and audit correlation IDs through a reviewed migration.
- Emit durable events from existing checkout, online-order, payment, receiving, transfer, delivery, quotation, and support workflows.
- The shipped worker endpoint uses a once-daily Vercel schedule so deployments remain valid on every Vercel plan. Configure a Pro-plan cron or external scheduler to call the same protected endpoint at the required operational cadence after the production webhook destination is ready.
- Add alert/notification routing only for configured channels and owners.

### Phase 3: scalable metrics and lifecycle

- Create security-invoker reporting views or audited RPCs for Centre metrics, rather than transferring whole inventory/product tables to application memory.
- Formalize allowed order transitions and record each transition in status history and audit logs.
- Build Centre queues for deliveries, quotations, projects, and procurement from existing records before adding new entities.

### Phase 4: DAN T AI governance

- Move to a server-only Responses API tool loop with strict JSON schemas.
- Register narrowly scoped, permission-checked read tools first. Tool inputs are validated server-side and results are minimized before reaching the model.
- Add an `ai_action_requests` approval queue for draft messages, quotation drafts, reorder recommendations, and staff tasks. No high-risk action runs without required confirmation.
- Store structured business context and approvals in Dantown tables; do not treat unbounded chat history as business memory.

### Phase 5: modular business domains

- Add delivery, project, technician, finance, document, marketing, and customer-360 workspaces only after the corresponding authority, audit, and data model are verified.
- Keep each module behind explicit permissions and surface only working routes in navigation.

## Non-negotiable safety rules

- Service-role access stays server-only; every Centre endpoint also validates the authenticated caller's Dantown permission.
- AI can read only through allowlisted tools and never executes arbitrary SQL.
- Assistive writes are represented as reviewable drafts or approval requests; financial, security, deletion, and pricing changes require the existing protected workflows.
- Database changes use reviewed migrations, RLS, secure views/RPCs, indexes, and verification queries. No production schema is changed directly.
- Every material operational or AI-assisted change is traceable through `audit_logs` and a future durable event correlation ID.
