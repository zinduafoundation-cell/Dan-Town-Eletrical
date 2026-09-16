# Product Intelligence and Automation

The flow is supplier input -> n8n orchestration -> normalized extraction -> deterministic product matching -> existing product or reviewable draft -> landed cost -> AI recommendation -> deterministic validation -> approval -> Supabase -> inventory/platform synchronization.

n8n owns transport, provider adapters, retries and routing. Supabase owns products, inventory, prices, approvals, audit records and transactional truth. AI analyzes and recommends; it never invents stock/prices, merges uncertain products, or publishes changes.

All work is correlated through `automation_jobs`. Parse/provider failures become `PROCESSING_FAILED`, exhausted retries become dead-letter/manual review, and uncertain matches/pricing become `REQUIRES_REVIEW`. Credentials belong in n8n or server environment configuration only.

Use `automation/n8n/README.md` and the numbered workflow specifications as implementation contracts. Realtime should be enabled selectively for inventory, product price, and order changes; the application should revalidate affected paths rather than duplicate data.
