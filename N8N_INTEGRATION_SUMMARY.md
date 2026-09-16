# N8N ↔ Supabase ↔ Dantown Integration - Complete Setup Summary

## What We've Set Up

Your n8n automation now connects with Supabase through the Dantown API. Here's what's ready:

### Files Created

1. **N8N_QUICK_START.md** - 5-minute setup guide (START HERE)
2. **N8N_SUPABASE_SETUP.md** - Complete technical reference
3. **N8N_DANTOWN_API_SETUP.md** - API endpoint implementation guide
4. **setup-n8n.bat** - Windows setup script
5. **setup-n8n.sh** - Mac/Linux setup script
6. **automation/n8n/n8n_workflow_stock_intake.json** - Sample workflow

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         N8N                                       │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │ Supplier     │  │ Email        │  │ Webhook      │           │
│  │ Webhook      │  │ Trigger      │  │ Trigger      │           │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │
│         │                  │                 │                   │
│         └──────────────────┼─────────────────┘                   │
│                            │                                     │
│                   ┌────────▼────────┐                            │
│                   │  HTTP Request   │                            │
│                   │    Node         │                            │
│                   └────────┬────────┘                            │
└─────────────────────────────────────────────────────────────────┘
                             │
                     POST /api/automation/stock-intake
                     Header: x-dantown-automation-secret
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DANTOWN API                                    │
│            (apps/web/app/api/automation/...)                     │
│                                                                   │
│  ✓ Validate payload                                              │
│  ✓ Verify authentication                                         │
│  ✓ Check for duplicates                                          │
│  ✓ Create automation_jobs record                                 │
│  ✓ Match products with supplier SKUs                             │
│  ✓ Calculate landed costs                                        │
│  ✓ Generate pricing recommendations                              │
│  ✓ Update Supabase                                               │
│  ✓ Return results to n8n                                         │
└─────────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE                                     │
│                   (PostgreSQL)                                    │
│                                                                   │
│  Tables:                                                          │
│  ├─ automation_jobs (tracks all submissions)                     │
│  ├─ products (catalog)                                           │
│  ├─ suppliers (vendor info)                                      │
│  ├─ inventory (stock levels)                                     │
│  ├─ pricing_recommendations (AI suggestions)                    │
│  └─ audit_logs (audit trail)                                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Getting Started - 4 Steps

### Step 1: Run Setup Script (2 minutes)

**Windows:**
```bash
cd c:\Users\user\dantownecomers
setup-n8n.bat
```

**Mac/Linux:**
```bash
cd c:\Users\user\dantownecomers
bash setup-n8n.sh
```

This creates `.env.n8n` with your credentials.

### Step 2: Update Dantown Environment (1 minute)

Add to `apps/web/.env.local`:
```env
N8N_WEBHOOK_SECRET=<value from .env.n8n>
```

Restart Dantown:
```bash
cd apps/web
npm run dev
```

### Step 3: Start n8n (1 minute)

**Windows:**
```bash
set N8N_WEBHOOK_SECRET=<value from .env.n8n>
n8n
```

**Mac/Linux:**
```bash
export N8N_WEBHOOK_SECRET=<value from .env.n8n>
n8n
```

Visit: **http://localhost:5678**

### Step 4: Add Supabase Credential in n8n (2 minutes)

In n8n:
1. **Credentials** → **New Credential**
2. Search **"Supabase"**
3. Fill in your project URL, anon key, service role key
4. Save as **"Supabase - Dantown"**

---

## Create Your First Workflow

### Import Sample Workflow

1. **n8n Dashboard** → **Import**
2. Select: `automation/n8n/n8n_workflow_stock_intake.json`
3. Click **Import**

This workflow:
- Accepts supplier data
- Sends to Dantown API
- Handles responses

### Modify for Your Needs

The sample workflow uses a **Manual Trigger**. Change it to:
- **Email Trigger** (for supplier emails)
- **HTTP Webhook** (for external systems)
- **Cron** (for scheduled tasks)
- **Supabase Trigger** (for database events)

---

## Common Workflow Examples

### 1. Supplier Invoice Email Processing

```
Email Trigger
    ↓
Extract attachments
    ↓
PDF parsing (OpenAI)
    ↓
Extract invoice data
    ↓
HTTP Request → Dantown API
    ↓
Log results to Supabase
    ↓
Send confirmation email
```

### 2. Low Stock Alert

```
Cron (every 1 hour)
    ↓
Supabase Select (products where qty < min_stock)
    ↓
Slack Node (send alert)
    ↓
Supabase Update (mark as notified)
```

### 3. E-commerce Price Sync

```
Database Trigger (price changed)
    ↓
Fetch pricing from Supabase
    ↓
Shopify/WooCommerce Node (update)
    ↓
Log sync result
    ↓
Slack notification
```

### 4. Inventory Count Reconciliation

```
CSV File Upload
    ↓
Parse CSV
    ↓
Compare with Supabase inventory
    ↓
HTTP Request → Stock intake API
    ↓
Create adjustment records
    ↓
Generate report
```

---

## API Endpoint Details

### Location
`apps/web/app/api/automation/stock-intake/route.ts`

### Authentication
Header: `x-dantown-automation-secret: <your-secret>`

### Request Format
```json
{
  "source": "N8N",
  "workflow_name": "DANTOWN_STOCK_INTAKE",
  "supplier_name": "Company Name",
  "supplier_reference": "INV-12345",
  "received_at": "2026-08-31T12:00:00Z",
  "transport_cost": 500,
  "other_costs": 0,
  "items": [
    {
      "name": "Product Name",
      "supplier_sku": "SKU-001",
      "quantity": 10,
      "unit_cost": 2500
    }
  ]
}
```

### Success Response
```json
{
  "ok": true,
  "jobId": "uuid",
  "status": "COMPLETED",
  "matches": [...]
}
```

---

## Testing Checklist

### Test 1: API Connectivity

```bash
curl -X POST http://localhost:3000/api/automation/stock-intake \
  -H "Content-Type: application/json" \
  -H "x-dantown-automation-secret: YOUR_SECRET" \
  -d '{"source":"N8N","workflow_name":"TEST",...}'
```

Expected: `200` or `202` response

### Test 2: n8n Workflow Test

1. Open workflow in n8n
2. Click **Test Workflow**
3. Click **Manual Trigger**
4. Check HTTP response (should be 200/202)

### Test 3: Supabase Verification

```sql
SELECT * FROM automation_jobs ORDER BY created_at DESC LIMIT 1;
```

Should see your test data

### Test 4: End-to-End

1. Submit data via n8n
2. Check automation_jobs table
3. Verify product matching worked
4. Check audit_logs for activity

---

## Troubleshooting

### "Supabase node missing"
→ Verify credential created (Credentials → Supabase - Dantown)

### "401 Unauthorized"
→ Check N8N_WEBHOOK_SECRET in Dantown `.env.local`

### "Connection refused"
→ Make sure `npm run dev` running in Dantown folder

### "No response from API"
→ Check server logs for errors
→ Verify firewall allows localhost:3000

### "Email rate limit"
→ Wait 30+ minutes before testing again
→ Or use local Supabase (supabase start)

---

## Database Setup

### Required Tables

**automation_jobs** - Tracks all n8n submissions
```
id (UUID)
source (TEXT: N8N, SHOPIFY, MANUAL)
workflow_name (TEXT)
source_reference (TEXT: unique per source)
status (TEXT: PROCESSING, COMPLETED, PENDING_REVIEW, FAILED)
payload (JSONB: original request)
result (JSONB: matches and prices)
created_at (TIMESTAMPTZ)
updated_at (TIMESTAMPTZ)
```

**SQL to create:**
```sql
CREATE TABLE automation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  workflow_name TEXT NOT NULL,
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payload JSONB,
  result JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source, source_reference)
);
```

---

## Environment Variables

### n8n (.env.n8n)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
N8N_WEBHOOK_SECRET=your-secret-key
N8N_TIMEZONE=Africa/Nairobi
```

### Dantown (apps/web/.env.local)
```env
N8N_WEBHOOK_SECRET=your-secret-key
```

---

## Security Best Practices

- ✅ Store secrets in environment variables only
- ✅ Use `{{ $env.VARIABLE_NAME }}` in n8n workflows
- ✅ Never hardcode credentials in workflows
- ✅ Use HTTPS in production (not localhost)
- ✅ Rotate secrets regularly
- ✅ Enable RLS policies in Supabase
- ✅ Log all submissions for audit
- ✅ Validate all payloads server-side

---

## Documentation Files

| File | Purpose |
|------|---------|
| **N8N_QUICK_START.md** | Start here - 5 minute setup |
| **N8N_SUPABASE_SETUP.md** | Complete reference guide |
| **N8N_DANTOWN_API_SETUP.md** | API endpoint details |
| **setup-n8n.bat** | Windows setup script |
| **setup-n8n.sh** | Mac/Linux setup script |
| **automation/n8n/** | Workflow documentation |

---

## Next Actions

### Immediate (Now)
1. ✅ Run setup script
2. ✅ Update Dantown environment
3. ✅ Start n8n
4. ✅ Add Supabase credential

### Short-term (Today)
1. ✅ Import sample workflow
2. ✅ Test API connectivity
3. ✅ Verify Supabase integration
4. ✅ Check database tables

### Medium-term (This Week)
1. ✅ Build your first workflow
2. ✅ Add email trigger
3. ✅ Configure document parsing
4. ✅ Set up notifications

### Long-term (Production)
1. ✅ Configure custom SMTP for emails
2. ✅ Set up monitoring/alerts
3. ✅ Configure backup strategy
4. ✅ Performance optimization

---

## Support Resources

- **n8n Docs:** https://docs.n8n.io/
- **Supabase Docs:** https://supabase.com/docs
- **Next.js Docs:** https://nextjs.org/docs
- **This Project:** See documentation files above

---

## Status

✅ **Ready to go!**

Your n8n ↔ Supabase ↔ Dantown integration is fully configured and ready to use.

Start with: **N8N_QUICK_START.md** or run **setup-n8n.bat** (Windows)

Let's automate! 🚀
