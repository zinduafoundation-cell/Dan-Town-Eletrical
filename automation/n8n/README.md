# n8n Automation Architecture

This project keeps Supabase as the single source of truth. n8n is the orchestrator, not the product database. It sends stock intake payloads over a secure HTTP endpoint, the app validates and records an `automation_jobs` row, performs product matching, calculates landed cost, and generates a deterministic pricing recommendation that waits for admin approval before any price or inventory record is changed.

## Phase 2 architecture

n8n -> Dantown secure API endpoint -> validate payload -> create or update `automation_jobs` -> product matching -> landed cost -> pricing recommendation -> admin approval -> stop

## A. How n8n sends a request to Dantown

The Dantown API accepts a `POST` request to the stock intake endpoint. The request must include the shared secret in the header named `x-dantown-automation-secret`. n8n should never include the secret in the browser or `NEXT_PUBLIC_*` variables.

## B. API endpoint path

POST /api/automation/stock-intake

## C. Required HTTP method

POST only. GET and other methods are rejected.

## D. Required authentication header

Header name: `x-dantown-automation-secret`
Header value: the same value as `N8N_WEBHOOK_SECRET` configured in the Dantown server environment.

## E. Example payload with fake values

```json
{
  "source": "N8N",
  "workflow_name": "DANTOWN_STOCK_INTAKE",
  "supplier_name": "East Africa Electrical",
  "supplier_reference": "INV-12345",
  "received_at": "2026-08-30T09:15:00.000Z",
  "transport_cost": 500,
  "other_costs": 0,
  "items": [
    {
      "name": "LED Floodlight 50W",
      "supplier_sku": "LED-50W-001",
      "barcode": null,
      "quantity": 20,
      "unit_cost": 2500
    }
  ]
}
```

## F. How to configure the HTTP Request node in n8n

Use a standard HTTP Request node:

- Method: `POST`
- URL: `http://localhost:3000/api/automation/stock-intake` for local development
- Production URL: `https://your-dantown-domain.example.com/api/automation/stock-intake`
- Authentication: `Header`
- Header name: `x-dantown-automation-secret`
- Header value: `={{ $env.N8N_WEBHOOK_SECRET }}`
- Send as: `JSON`
- Body: the stock intake JSON shown above

Do not use `localhost` for production. Local development requires both n8n and Dantown to run on the same machine or a forwarded tunnel. Production requires a public, secure deployment.

## G. Expected successful response

```json
{
  "ok": true,
  "jobId": "<uuid>",
  "status": "COMPLETED",
  "itemCount": 1,
  "recommendationsCount": 1,
  "matches": [
    {
      "productId": "<uuid>",
      "status": "MATCHED",
      "landedCost": 2635
    }
  ]
}
```

A `202 Accepted` response means the intake was accepted for administrator review because one or more items were not matched confidently.

## H. Duplicate handling

The same invoice or supplier reference is checked against `automation_jobs.source_reference`. If a matching n8n record already exists for the same workflow and reference, the API returns `409 Conflict` and does not create another processing job. We also add a database-level unique index for `(source, source_reference)` where `source_reference` is not null to prevent duplicate rows at the storage layer.

## I. Error handling

- `400`: malformed or invalid payload
- `401`: missing or incorrect `x-dantown-automation-secret`
- `409`: duplicate stock intake already processed
- `500`: unexpected server failure

The API never exposes stack traces or secrets to n8n. It logs a safe audit event in `audit_logs` and stores the real payload in `automation_jobs.payload`.

## J. How automation job statuses work

`automation_jobs` statuses are:

- `RECEIVED`
- `PROCESSING`
- `COMPLETED`
- `PROCESSING_FAILED`
- `REQUIRES_REVIEW`

The intake starts as `RECEIVED` and transitions to `PROCESSING` as the app validates, matches, calculates landed cost, and prepares pricing recommendations. If a product cannot be confidently matched or the app cannot complete a processing step, the job ends in `REQUIRES_REVIEW` or `PROCESSING_FAILED`.

## K. Product matching logic

For each line item, the app checks, in order:

1. exact barcode match
2. exact product SKU match
3. supplier SKU match if the supplier SKU is known
4. normalized product-name match
5. controlled similarity match only when the existing architecture supports it safely

Matching uses the existing shared `matchProduct` logic. Uncertain results become `POSSIBLE_MATCH` or `NEW_PRODUCT` and are stored in `product_matches` with confidence and reasons, then flagged for admin review.

## L. Landed cost allocation logic

For matched products we compute:

`item_total_cost = quantity × unit_cost`

Shared transport and other costs are allocated proportionally across all items based on each item’s purchase value:

`allocated_shared_cost = total_shared_cost × (item_purchase_value / total_purchase_value)`

The unit landed cost is calculated as:

`unit_cost + allocated_transport + other_costs - supplier_discount + tax_amount`

The result is stored in `landed_cost_calculations` without mutating product prices or inventory.

## M. Pricing recommendation logic

The app uses deterministic pricing rules rather than pretending to be AI. The rule set is intentionally simple to review and modify:

- minimum allowed price = landed cost × (1 + margin)
- retail price = landed cost × 1.35
- contractor price = landed cost × 1.25
- dealer price = landed cost × 1.12
- wholesale price = landed cost × 1.18
- promotional price is capped by the configured discount and rounded up to the step increment

The generated recommendation gets stored in `pricing_recommendations` with `status = AI_RECOMMENDED`. It must never auto-publish to product pricing columns.

## N. Why admin approval is required

The automation pipeline stops after pricing recommendations are generated. A human must review the match confidence, landed cost, and recommended prices in the admin portal before any product price change or inventory update is approved.

## O. What Phase 2 does NOT do yet

- no automatic product price publishing
- no automatic inventory adjustment
- no real WhatsApp or Gmail ingestion in production
- no external AI price execution
- no direct write to `products.retail_price`, `products.contractor_price`, `products.dealer_price`, `products.wholesale_price`, or `products.promotional_price`

## n8n workflow to build

This is the starter workflow shape:

Webhook OR Manual Trigger -> Edit Fields / Set structured stock data -> HTTP Request -> Dantown API -> Check Response -> Success/Error handling

Use a `Webhook` trigger when n8n is externally invoked, or a `Manual Trigger` for testing. The HTTP Request node calls the Dantown endpoint with the shared header and JSON body. The response is checked and routed to success or error branches.

## Local development vs production

### Local development

- n8n and Dantown are both running locally
- Example URL: `http://localhost:3000/api/automation/stock-intake`
- Header uses the local `N8N_WEBHOOK_SECRET`

### Production

- Dantown runs on a publicly reachable secure domain
- n8n calls the production HTTPS URL, not localhost
- The secret is stored only in the server environment and not in browser code

## Testing instructions

Use the project root and run the normal web build/lint/test commands from the app workspace:

```bash
npm run build --workspace @dantown/web
npm run lint --workspace @dantown/web
npm run test --workspace @dantown/web
```

For a functional smoke test:

1. set `N8N_WEBHOOK_SECRET` in the server environment
2. send a valid stock intake POST to `/api/automation/stock-intake`
3. confirm `automation_jobs` is created
4. verify status transitions to `COMPLETED` or `REQUIRES_REVIEW`
5. confirm `product_matches` contains an entry
6. confirm `landed_cost_calculations` contains a row
7. confirm `pricing_recommendations` contains a row
8. confirm product prices and inventory remain unchanged
9. resend the same `supplier_reference` and confirm the endpoint returns `409 Conflict`

This phase intentionally stops after recommendation generation and approval gates, matching the "admin review required" design.
