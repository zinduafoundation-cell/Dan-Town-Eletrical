# Dantown API Endpoint for n8n Integration

## Overview

The Dantown API endpoint receives stock intake data from n8n and orchestrates:
1. Validation
2. Product matching
3. Landed cost calculation
4. Pricing recommendations
5. Supabase database writes

## Endpoint Setup

Dantown also exposes operational channels for customer conversations and AI intake. All automation webhooks persisted through Supabase are visible in `/admin/automation`.

### Channel Routes

- `apps/web/app/api/automation/ingest/route.ts` – generic catch-all ingestion endpoint
- `apps/web/app/api/automation/whatsapp/route.ts` – WhatsApp messages and follow-ups
- `apps/web/app/api/automation/email/route.ts` – inbound/outbound email activity
- `apps/web/app/api/automation/crm/route.ts` – CRM/customer pipeline events
- `apps/web/app/api/automation/ai-assistant/route.ts` – AI chat and support conversations
- `apps/web/app/api/automation/stock-intake/route.ts` – supplier stock intake workflow

### File Location

`apps/web/app/api/automation/stock-intake/route.ts`
### Environment Variables Required

Add to `apps/web/.env.local`:
```env
# N8N Integration
N8N_WEBHOOK_SECRET=your-secure-secret-here
```

### Request Validation

**Header required:**
```
x-dantown-automation-secret: <value of N8N_WEBHOOK_SECRET>
```

**Request body schema:**
```typescript
{
  source: "N8N" | "SHOPIFY" | "MANUAL" // required
  workflow_name: string // required, e.g., "DANTOWN_STOCK_INTAKE"
  supplier_name: string // required
  supplier_reference: string // required, unique per source
  received_at: ISO8601 string // required
  transport_cost: number // >= 0
  other_costs: number // >= 0
  items: [
    {
      name: string // product name
      supplier_sku: string // supplier product code
      barcode?: string // optional product barcode
      quantity: number // > 0
      unit_cost: number // >= 0
    }
  ]
}
```

### Response Schema

**Success (200 OK):**
```json
{
  "ok": true,
  "jobId": "uuid-string",
  "status": "COMPLETED",
  "itemCount": 1,
  "recommendationsCount": 1,
  "matches": [
    {
      "productId": "uuid-string",
      "supplierSku": "LED-001",
      "status": "MATCHED",
      "matchConfidence": 0.95,
      "landedCost": 2635,
      "recommendedPrice": 3500
    }
  ]
}
```

**Pending Review (202 Accepted):**
```json
{
  "ok": true,
  "jobId": "uuid-string",
  "status": "PENDING_REVIEW",
  "message": "Items require admin approval",
  "itemCount": 2,
  "matched": 1,
  "unmatched": 1,
  "unmatched_items": [
    {
      "name": "Unknown LED Bulb",
      "supplier_sku": "UNK-001",
      "quantity": 5,
      "unit_cost": 1500
    }
  ]
}
```

**Error (400/401/409/500):**
```json
{
  "ok": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

---

## Implementation Guide

### Step 1: Create the Route Handler

Create file: `apps/web/app/api/automation/stock-intake/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

// Request validation schema
const stockIntakeSchema = z.object({
  source: z.enum(["N8N", "SHOPIFY", "MANUAL"]),
  workflow_name: z.string().min(1),
  supplier_name: z.string().min(1),
  supplier_reference: z.string().min(1),
  received_at: z.string().datetime(),
  transport_cost: z.number().min(0).default(0),
  other_costs: z.number().min(0).default(0),
  items: z.array(
    z.object({
      name: z.string().min(1),
      supplier_sku: z.string().min(1),
      barcode: z.string().nullable().optional(),
      quantity: z.number().int().positive(),
      unit_cost: z.number().nonnegative(),
    })
  ),
});

type StockIntakeRequest = z.infer<typeof stockIntakeSchema>;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication header
    const secret = request.headers.get("x-dantown-automation-secret");
    const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

    if (!secret || secret !== expectedSecret) {
      console.error("STOCK_INTAKE UNAUTHORIZED");
      return NextResponse.json(
        { ok: false, error: "Unauthorized", code: "INVALID_SECRET" },
        { status: 401 }
      );
    }

    // 2. Parse and validate request body
    const body = await request.json();
    const parsed = stockIntakeSchema.safeParse(body);

    if (!parsed.success) {
      console.error("STOCK_INTAKE VALIDATION_ERROR", parsed.error);
      return NextResponse.json(
        { ok: false, error: "Invalid request body", code: "VALIDATION_ERROR" },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    console.log("STOCK_INTAKE STARTED", {
      source: payload.source,
      workflow: payload.workflow_name,
      itemCount: payload.items.length,
    });

    // 3. Check for duplicate submissions
    const supabase = await createSupabaseServerClient();

    const { data: existingJob } = await supabase
      .from("automation_jobs")
      .select("id")
      .eq("source", payload.source)
      .eq("source_reference", payload.supplier_reference)
      .eq("workflow_name", payload.workflow_name)
      .maybeSingle();

    if (existingJob) {
      console.error("STOCK_INTAKE DUPLICATE", {
        source: payload.source,
        reference: payload.supplier_reference,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "Duplicate submission already processed",
          code: "DUPLICATE_SUBMISSION",
          jobId: existingJob.id,
        },
        { status: 409 }
      );
    }

    // 4. Create automation job record
    const { data: job, error: jobError } = await supabase
      .from("automation_jobs")
      .insert({
        source: payload.source,
        workflow_name: payload.workflow_name,
        source_reference: payload.supplier_reference,
        status: "PROCESSING",
        payload: payload,
      })
      .select("id")
      .single();

    if (jobError || !job) {
      console.error("STOCK_INTAKE JOB_CREATE_ERROR", jobError);
      return NextResponse.json(
        { ok: false, error: "Failed to create job", code: "JOB_CREATE_FAILED" },
        { status: 500 }
      );
    }

    // 5. Process items and match with products
    const matchResults = [];
    const unmatchedItems = [];

    for (const item of payload.items) {
      // Match against existing products (simplified example)
      const { data: matchedProduct } = await supabase
        .from("products")
        .select("id, name, supplier_sku, price")
        .ilike("supplier_sku", `%${item.supplier_sku}%`)
        .single()
        .catch(() => ({ data: null }));

      if (matchedProduct) {
        // Calculate landed cost
        const itemLandedCost = calculateLandedCost(
          item.quantity,
          item.unit_cost,
          payload.transport_cost,
          payload.other_costs
        );

        matchResults.push({
          productId: matchedProduct.id,
          supplierSku: item.supplier_sku,
          status: "MATCHED",
          matchConfidence: 0.95,
          landedCost: itemLandedCost,
          recommendedPrice: calculateRecommendedPrice(itemLandedCost),
        });
      } else {
        unmatchedItems.push(item);
      }
    }

    // 6. Update automation job with results
    const status = unmatchedItems.length > 0 ? "PENDING_REVIEW" : "COMPLETED";
    const httpStatus = unmatchedItems.length > 0 ? 202 : 200;

    const { error: updateError } = await supabase
      .from("automation_jobs")
      .update({
        status,
        result: {
          matched: matchResults.length,
          unmatched: unmatchedItems.length,
          matches: matchResults,
          unmatched_items: unmatchedItems,
        },
      })
      .eq("id", job.id);

    if (updateError) {
      console.error("STOCK_INTAKE UPDATE_ERROR", updateError);
      return NextResponse.json(
        { ok: false, error: "Failed to update job", code: "UPDATE_FAILED" },
        { status: 500 }
      );
    }

    console.log("STOCK_INTAKE COMPLETED", {
      jobId: job.id,
      matched: matchResults.length,
      unmatched: unmatchedItems.length,
    });

    // 7. Return response
    if (unmatchedItems.length > 0) {
      return NextResponse.json(
        {
          ok: true,
          jobId: job.id,
          status: "PENDING_REVIEW",
          message: "Items require admin approval",
          itemCount: payload.items.length,
          matched: matchResults.length,
          unmatched: unmatchedItems.length,
          unmatched_items: unmatchedItems,
        },
        { status: httpStatus }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        jobId: job.id,
        status: "COMPLETED",
        itemCount: payload.items.length,
        recommendationsCount: matchResults.length,
        matches: matchResults,
      },
      { status: httpStatus }
    );
  } catch (err) {
    console.error("STOCK_INTAKE EXCEPTION", err);
    return NextResponse.json(
      { ok: false, error: "Internal server error", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}

// Helper functions
function calculateLandedCost(
  quantity: number,
  unitCost: number,
  transportCost: number,
  otherCosts: number
): number {
  const totalCost = quantity * unitCost + transportCost + otherCosts;
  return Math.round(totalCost / quantity);
}

function calculateRecommendedPrice(landedCost: number): number {
  // 40% markup by default
  return Math.round(landedCost * 1.4);
}
```

### Step 2: Create Database Table

**If not already created, run in Supabase SQL Editor:**

```sql
CREATE TABLE IF NOT EXISTS automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL, -- N8N, SHOPIFY, MANUAL, etc.
  workflow_name TEXT NOT NULL,
  source_reference TEXT, -- Unique per source
  status TEXT NOT NULL DEFAULT 'PENDING', -- PROCESSING, COMPLETED, PENDING_REVIEW, FAILED
  payload JSONB,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT automation_jobs_unique_source_ref 
    UNIQUE(source, source_reference) WHERE source_reference IS NOT NULL
);

CREATE INDEX automation_jobs_source_idx ON automation_jobs(source);
CREATE INDEX automation_jobs_status_idx ON automation_jobs(status);
CREATE INDEX automation_jobs_created_idx ON automation_jobs(created_at DESC);
```

### Step 3: Enable RLS (Optional but Recommended)

```sql
ALTER TABLE automation_jobs ENABLE ROW LEVEL SECURITY;

-- Allow n8n to insert and read
CREATE POLICY "n8n_access_automation_jobs" ON automation_jobs
FOR ALL
USING (source = 'N8N')
WITH CHECK (source = 'N8N');

-- Allow authenticated users to read
CREATE POLICY "users_read_automation_jobs" ON automation_jobs
FOR SELECT
USING (auth.role() = 'authenticated');
```

---

## Testing

### Test with curl:

```bash
curl -X POST http://localhost:3000/api/automation/stock-intake \
  -H "Content-Type: application/json" \
  -H "x-dantown-automation-secret: your-secret-key" \
  -d '{
    "source": "N8N",
    "workflow_name": "DANTOWN_STOCK_INTAKE",
    "supplier_name": "Test Supplier",
    "supplier_reference": "TEST-001",
    "received_at": "2026-08-31T12:00:00Z",
    "transport_cost": 500,
    "other_costs": 0,
    "items": [
      {
        "name": "LED Floodlight",
        "supplier_sku": "LED-50W-001",
        "quantity": 20,
        "unit_cost": 2500
      }
    ]
  }'
```

### Expected responses:

**All items matched (200):**
```json
{
  "ok": true,
  "jobId": "...",
  "status": "COMPLETED",
  "matches": [...]
}
```

**Some unmatched (202):**
```json
{
  "ok": true,
  "jobId": "...",
  "status": "PENDING_REVIEW",
  "unmatched_items": [...]
}
```

---

## Monitoring

### Check job status in Supabase:

```sql
SELECT id, source, workflow_name, status, created_at
FROM automation_jobs
ORDER BY created_at DESC
LIMIT 10;
```

### View job details:

```sql
SELECT * FROM automation_jobs WHERE id = 'job-uuid';
```

### Check errors:

```sql
SELECT source, workflow_name, error_message, created_at
FROM automation_jobs
WHERE status = 'FAILED'
ORDER BY created_at DESC;
```

---

## Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| INVALID_SECRET | 401 | Wrong or missing authentication secret |
| VALIDATION_ERROR | 400 | Request body doesn't match schema |
| DUPLICATE_SUBMISSION | 409 | Same invoice already processed |
| JOB_CREATE_FAILED | 500 | Failed to create automation job |
| UPDATE_FAILED | 500 | Failed to update job with results |
| SERVER_ERROR | 500 | Unexpected server error |

---

## Security Considerations

- ✓ Secret stored in environment only (not in code)
- ✓ Request validation with strict schema
- ✓ Duplicate detection by source + reference
- ✓ All errors logged safely (no sensitive data exposed)
- ✓ RLS policies control database access
- ✓ Audit trail via `automation_jobs` table

---

## Next Steps

1. ✅ Create the route file with code above
2. ✅ Add `N8N_WEBHOOK_SECRET` to `.env.local`
3. ✅ Create `automation_jobs` table in Supabase
4. ✅ Restart `npm run dev`
5. ✅ Test with curl command above
6. ✅ Configure n8n HTTP Request node to use this endpoint
7. ✅ Run n8n workflows

---

## Reference

- Route docs: https://nextjs.org/docs/app/building-your-application/routing/route-handlers
- Supabase docs: https://supabase.com/docs/reference/javascript/select
- n8n docs: https://docs.n8n.io/
