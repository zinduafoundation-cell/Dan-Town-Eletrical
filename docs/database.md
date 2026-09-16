# Database

Supabase PostgreSQL is the authoritative data store. Apply numbered migrations in `supabase/migrations/` with the Supabase CLI:

```bash
supabase db start
supabase db reset
supabase db push
```

Migrations are separated by domain: identity/RBAC, catalog, inventory, procurement, customers, cart, orders, payments, POS, quotations, delivery, reviews/warranties, notifications/audit/analytics, integrity, security, and reporting.

Money uses `numeric(12,2)`. Product catalog data, order snapshots, and inventory movements are separate concerns. Inventory changes should go through the `adjust_inventory` database function so each change is traceable.

The generated-style contract is maintained at `packages/database/src/types.ts` until Supabase CLI type generation is connected to a project.
