# N8N + Supabase Integration Guide

## Overview

Your n8n automation sends data to Dantown API (`POST /api/automation/stock-intake`), which then validates and writes to Supabase. This guide covers:

1. Setting up Supabase credentials in n8n
2. Configuring n8n to send requests to Dantown API
3. Direct Supabase queries from n8n (optional)
4. Environment setup

---

## Part 1: Set Up Supabase Credentials in n8n

### Step 1: Get Supabase API Keys

From **Supabase Dashboard**:

1. Go to **Settings** → **API**
2. Copy:
   - **Project URL:** `https://vldccdtuwwyumqdkyxde.supabase.co`
   - **Anon Key:** `eyJhbGci...` (starts with eyJhbGci)
   - **Service Role Key:** `eyJhbGci...` (for admin operations - **keep secret**)

### Step 2: Add Supabase Credential in n8n

1. **Open n8n Dashboard**
   - Go to: http://localhost:5678 (or your n8n URL)
   - Click **Credentials** (left sidebar)
   - Click **New Credential** (top right)

2. **Search for "Supabase"**
   - Select **Supabase** from the list

3. **Fill in the form:**
   - **Credential Name:** `Supabase - Dantown`
   - **Host:** `https://vldccdtuwwyumqdkyxde.supabase.co`
   - **API Key (Anon):** Paste your anon key
   - **Service Role Key (Optional):** Paste service role key for admin operations
   
4. **Click Save**

---

## Part 2: Create HTTP Request Node to Dantown API

This is the main integration point. n8n sends supplier data to Dantown API, which handles Supabase writes.

### Step 1: Create New Workflow

1. **Open n8n**
2. **Click "New Workflow"**
3. **Name it:** `Stock Intake Supplier Data`

### Step 2: Add HTTP Request Node

1. **Add Node** → Search for **"HTTP Request"**
2. **Configure:**

**URL:**
```
http://localhost:3000/api/automation/stock-intake
```
*(Change to production domain in production)*

**Method:** `POST`

**Authentication:** `Header`

**Header Name:** `x-dantown-automation-secret`

**Header Value:** 
```
{{ $env.N8N_WEBHOOK_SECRET }}
```

**Body Type:** `JSON`

**Body:**
```json
{
  "source": "N8N",
  "workflow_name": "DANTOWN_STOCK_INTAKE",
  "supplier_name": "{{ $node['Trigger'].json.supplier_name }}",
  "supplier_reference": "{{ $node['Trigger'].json.invoice_number }}",
  "received_at": "{{ $now.toISOString() }}",
  "transport_cost": "{{ $node['Trigger'].json.transport_cost || 0 }}",
  "other_costs": "{{ $node['Trigger'].json.other_costs || 0 }}",
  "items": "{{ $node['Trigger'].json.items }}"
}
```

### Step 3: Add Response Handler

Add another node after HTTP Request:

1. **Add Node** → Search for **"If"**
2. **Configure:**
   - If: `Response Status Code`
   - Equals: `200` or `201` or `202`
   - **Then:** Add node to log success
   - **Else:** Add node to log error

---

## Part 3: Direct Supabase Queries from n8n (Optional)

If you need n8n to directly read from Supabase (e.g., to check inventory, update prices), use these nodes:

### Node 1: Supabase Select (Read Data)

1. **Add Node** → **Supabase**
2. **Operation:** `Select`
3. **Configure:**
   - **Credential:** Select `Supabase - Dantown`
   - **Table:** `products` (or your table name)
   - **Limit:** `100`
   - **Return All:** `true`
   - **Filters:** (optional) Add conditions

**Example:** Get products with low stock
```
Column: quantity
Condition: Less than
Value: 10
```

### Node 2: Supabase Insert (Create Data)

1. **Add Node** → **Supabase**
2. **Operation:** `Insert`
3. **Configure:**
   - **Credential:** `Supabase - Dantown`
   - **Table:** `automation_jobs`
   - **Columns:** Match your table schema
   - **Values:** Use data from previous nodes

**Example:**
```
{
  "source": "N8N",
  "workflow_name": "{{ $node['Trigger'].json.workflow }}",
  "source_reference": "{{ $node['Trigger'].json.invoice_id }}",
  "payload": "{{ $node['HTTP Request'].json }}"
}
```

### Node 3: Supabase Update (Modify Data)

1. **Add Node** → **Supabase**
2. **Operation:** `Update`
3. **Configure:**
   - **Credential:** `Supabase - Dantown`
   - **Table:** `automation_jobs`
   - **Filter by:** `id` = `{{ $node['Trigger'].json.job_id }}`
   - **Set Columns:** e.g., `status` = `COMPLETED`

### Node 4: Supabase Delete (Remove Data)

1. **Add Node** → **Supabase**
2. **Operation:** `Delete`
3. **Configure:**
   - **Credential:** `Supabase - Dantown`
   - **Table:** `automation_jobs`
   - **Filter:** `id` = `{{ id }}`

---

## Part 4: Environment Variables in n8n

### Set N8N_WEBHOOK_SECRET

This secret is used for authentication between n8n and Dantown API.

**In n8n Server:**

1. **Stop n8n** (if running)
2. **Set environment variable:**
   ```bash
   # Windows
   set N8N_WEBHOOK_SECRET=your-secret-key-here
   npm run dev
   
   # macOS/Linux
   export N8N_WEBHOOK_SECRET=your-secret-key-here
   npm run dev
   ```

3. **In Docker (if using Docker):**
   ```dockerfile
   ENV N8N_WEBHOOK_SECRET=your-secret-key-here
   ```

4. **Restart n8n**

### Set NEXT_PUBLIC_APP_URL (for Dantown API)

In your Dantown `.env.local`:
```env
N8N_WEBHOOK_SECRET=your-secret-key-here
```

---

## Part 5: Test the Integration

### Test 1: Direct HTTP Request

Use **Postman** or **curl**:

```bash
curl -X POST http://localhost:3000/api/automation/stock-intake \
  -H "Content-Type: application/json" \
  -H "x-dantown-automation-secret: YOUR_SECRET" \
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
        "name": "LED Light",
        "supplier_sku": "LED-001",
        "quantity": 10,
        "unit_cost": 2500
      }
    ]
  }'
```

**Expected Response:**
```json
{
  "ok": true,
  "jobId": "uuid-here",
  "status": "COMPLETED",
  "itemCount": 1,
  "recommendationsCount": 1,
  "matches": [...]
}
```

### Test 2: From n8n Workflow

1. **Open n8n Workflow**
2. **Click "Test Workflow"** (top right)
3. **Check Results:**
   - Should show `200` or `202` response
   - Check Supabase `automation_jobs` table - new row should appear

### Test 3: Query Supabase from n8n

1. **Add Supabase Select node** (read `automation_jobs`)
2. **Test** - should show recently created job

---

## Part 6: Secure Credentials

### Production Checklist

- [ ] Never hardcode secrets in workflows
- [ ] Use `{{ $env.VARIABLE_NAME }}` for secrets
- [ ] Store secrets in n8n Credentials UI
- [ ] Set `N8N_WEBHOOK_SECRET` in server environment
- [ ] Use HTTPS for all URLs in production
- [ ] Rotate API keys regularly
- [ ] Use Service Role Key only for admin operations
- [ ] Enable Supabase RLS policies to restrict n8n access

### RLS Policy for n8n

In Supabase SQL Editor:

```sql
-- Allow n8n to insert into automation_jobs
CREATE POLICY "n8n_insert_automation_jobs" ON automation_jobs
FOR INSERT 
WITH CHECK (source = 'N8N');

-- Allow n8n to read automation_jobs
CREATE POLICY "n8n_read_automation_jobs" ON automation_jobs
FOR SELECT
USING (source = 'N8N');

-- Allow n8n to update automation_jobs
CREATE POLICY "n8n_update_automation_jobs" ON automation_jobs
FOR UPDATE
USING (source = 'N8N')
WITH CHECK (source = 'N8N');
```

---

## Part 7: Common Workflows

### Workflow 1: Supplier Invoice Intake

**Trigger:** Email (n8n Email Trigger)
↓
**Extract:** Document Parser (extract invoice data)
↓
**Send to Dantown:** HTTP Request to `/api/automation/stock-intake`
↓
**Log Result:** Save to Supabase via Dantown API
↓
**Notify:** Send confirmation email

### Workflow 2: Low Stock Alert

**Trigger:** Every 1 hour (Cron)
↓
**Query:** Supabase Select (products where quantity < min_stock)
↓
**Notify:** Send Slack message to #inventory
↓
**Update:** Mark as notified in Supabase

### Workflow 3: Price Update

**Trigger:** New pricing recommendation created
↓
**Fetch:** Get recommendation from Supabase
↓
**Calculate:** Apply logic
↓
**Update:** Supabase Update node (update `products.price`)
↓
**Sync:** Send to e-commerce platform

### Workflow 4: Inventory Sync

**Trigger:** Manual or scheduled
↓
**Read:** Supabase inventory table
↓
**Send:** POST to e-commerce API
↓
**Log:** Record sync in `automation_jobs`

---

## Part 8: Debugging

### Check n8n Logs

**In Terminal:**
```bash
npm run dev
```

Look for:
- Credential connection errors
- HTTP response codes
- Payload validation errors

### Check Dantown API Logs

**In Terminal (where `npm run dev` runs):**
```
AUTH SIGNUP STARTED...
AUTH CALLBACK SUCCESS...
POST /api/automation/stock-intake 200
```

### Check Supabase Logs

**In Supabase Dashboard:**
- **Logs Explorer** → View requests
- **SQL Editor** → Query `audit_logs` table
- **Authentication** → Check user creation logs

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Missing/wrong secret | Check `N8N_WEBHOOK_SECRET` env var |
| 400 Bad Request | Invalid payload | Validate JSON structure |
| 409 Conflict | Duplicate invoice | Check `automation_jobs.source_reference` uniqueness |
| Connection refused | Dantown API not running | Start `npm run dev` on Dantown |
| Supabase node doesn't work | Credential not selected | Select `Supabase - Dantown` credential |

---

## Next Steps

1. **Set up Supabase credential in n8n** (follow Part 1)
2. **Create test workflow with HTTP Request node** (follow Part 2)
3. **Test with curl or Postman** (follow Part 5, Test 1)
4. **Build automation workflows** (refer to Part 7)
5. **Monitor logs** (follow Part 8)

---

## API Reference

### Dantown Stock Intake Endpoint

- **URL:** `POST /api/automation/stock-intake`
- **Auth Header:** `x-dantown-automation-secret`
- **Request Body:** See Part 2 example
- **Success Responses:**
  - `200 OK` - All items matched, processing complete
  - `202 Accepted` - Items need review, waiting for admin approval
- **Error Responses:**
  - `400 Bad Request` - Invalid payload
  - `401 Unauthorized` - Wrong/missing secret
  - `409 Conflict` - Duplicate invoice
  - `500 Server Error` - Unexpected failure

### Supabase Tables Used

| Table | Purpose | Used By |
|-------|---------|---------|
| `automation_jobs` | Track all n8n submissions | n8n writes here |
| `products` | Product catalog | n8n reads/updates |
| `suppliers` | Supplier info | n8n references |
| `audit_logs` | Audit trail | n8n can query |
| `inventory` | Stock levels | n8n reads for alerts |

---

## Support

For issues:
1. Check Part 8: Debugging
2. Review Supabase RLS policies
3. Verify credentials are set correctly
4. Check firewall/network connectivity
5. Review n8n and Dantown logs
