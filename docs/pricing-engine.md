# Pricing Engine

Landed cost is persisted as auditable inputs: unit cost, allocated transport, other costs, supplier discount, tax configuration, and result. Pricing rules configure minimum margin, maximum discount, VAT, customer segment, rounding and promotional limits.

The deterministic pricing service in `packages/shared/src/pricing-engine.ts` produces tier recommendations and enforces minimum allowed prices. An AI agent may provide a recommendation/reasoning/confidence, but validation remains deterministic. High-confidence in-rule results can be auto-approved; low-confidence or out-of-rule results require an authorized reviewer.

Every published change writes `price_history` with old/new values, source, reason, recommendation and approver. No browser or n8n payload is trusted for final prices.
