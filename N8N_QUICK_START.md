# Quick Start: Connect n8n to Supabase

## 5-Minute Setup

### 1. Get Credentials (1 min)

**From Supabase Dashboard:**
- Go to **Settings** → **API**
- Copy: **Project URL**, **Anon Key**, **Service Role Key**

**Example:**
```
URL: https://vldccdtuwwyumqdkyxde.supabase.co
Anon Key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Service Role: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Run Setup Script (2 min)

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

This creates `.env.n8n` with all your credentials.

### 3. Update Dantown Environment (1 min)

Add to `apps/web/.env.local`:
```env
N8N_WEBHOOK_SECRET=<value from setup script>
```

Restart `npm run dev` in Dantown folder.

### 4. Start n8n (1 min)

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

### 5. Add Supabase Credential in n8n (2 min)

**In n8n UI:**
1. Click **Credentials** (left sidebar)
2. Click **New Credential** (top right)
3. Search for **"Supabase"**
4. Fill in:
   - **Credential Name:** `Supabase - Dantown`
   - **Host:** Your Supabase URL
   - **API Key (Anon):** Your anon key
   - **Service Role Key:** Your service role key
5. Click **Save**

---

## Import Sample Workflow

**In n8n UI:**
1. Click **Import** (top left)
2. Select file: `automation/n8n/n8n_workflow_stock_intake.json`
3. Click **Import**

This creates a workflow that:
- Accepts supplier invoice data
- Sends it to Dantown API
- Logs results

---

## Test the Integration

### Test 1: Manual Workflow Test

1. **Open the imported workflow**
2. Click **Test Workflow** (top right)
3. Click **Manual Trigger**
4. Enter test data:
   ```json
   {
     "supplier_name": "Test Supplier",
     "invoice_number": "INV-001",
     "transport_cost": 500,
     "items": [
       {
         "name": "LED Light",
         "supplier_sku": "LED-001",
         "quantity": 10,
         "unit_cost": 2500
       }
     ]
   }
   ```
5. Check the response - should show `200` or `202`

### Test 2: Check Supabase

**In Supabase Dashboard:**
1. Go to **SQL Editor**
2. Run:
   ```sql
   SELECT * FROM automation_jobs 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```
3. Should see your test data

---

## Architecture Overview

```
N8N Workflow
    ↓
HTTP Request Node
    ↓
Dantown API (/api/automation/stock-intake)
    ↓
Validate & Process
    ↓
Supabase Database
    ↓
Product Matching
    ↓
Landed Cost Calculation
    ↓
Pricing Recommendation
    ↓
Admin Approval
```

**Key Points:**
- ✓ n8n sends HTTP requests (not direct DB access)
- ✓ Dantown API validates and writes to Supabase
- ✓ Supabase is the single source of truth
- ✓ All requests require authentication header

---

## Common Tasks

### Task 1: Read Inventory from Supabase

Add a **Supabase Select** node:
```
Operation: Select
Table: products
Filters: quantity < 10
```

### Task 2: Update Product Price

Add a **Supabase Update** node:
```
Operation: Update
Table: products
Where: id = {{ id }}
Set: price = {{ newPrice }}
```

### Task 3: Create Automation Job Record

Add a **Supabase Insert** node:
```
Operation: Insert
Table: automation_jobs
Columns:
  - source: N8N
  - workflow_name: My Workflow
  - status: PENDING
```

### Task 4: Send Alert on Low Stock

**Workflow:**
1. Cron Trigger (every 1 hour)
2. Supabase Select (products where quantity < 5)
3. Slack Node (send alert)
4. Log to Supabase

### Task 5: Sync Prices to Shopify

**Workflow:**
1. Database Trigger (when price updated)
2. Shopify Node (update product)
3. Log result to Supabase

---

## Troubleshooting

### Issue: "Supabase node not found"
**Solution:** Check Supabase credential is set up (Credentials → Supabase - Dantown)

### Issue: "401 Unauthorized" from Dantown API
**Solution:** Verify `N8N_WEBHOOK_SECRET` is set in Dantown `.env.local`

### Issue: "Connection refused" to localhost:3000
**Solution:** Make sure `npm run dev` is running in Dantown folder

### Issue: HTTP Request returns 400
**Solution:** Check payload matches expected format (see N8N_SUPABASE_SETUP.md)

### Issue: "Email rate limit" on test
**Solution:** Wait 30+ minutes before testing again

---

## Files Created

- `N8N_SUPABASE_SETUP.md` - Complete setup guide
- `.env.n8n` - Environment configuration (created by script)
- `automation/n8n/n8n_workflow_stock_intake.json` - Sample workflow
- `setup-n8n.bat` - Windows setup script
- `setup-n8n.sh` - Mac/Linux setup script

---

## Next: Create Your First Workflow

Ready to build? Start with:

1. **Supplier Invoice Processing**
   - Email trigger → PDF extraction → Stock intake
   
2. **Low Stock Alerts**
   - Cron trigger → Query inventory → Slack notification
   
3. **Price Updates**
   - Recommendation trigger → Calculate pricing → Update DB
   
4. **E-commerce Sync**
   - Database trigger → Sync to Shopify/WooCommerce

See `N8N_SUPABASE_SETUP.md` Part 7 for detailed workflow examples.

---

## Security Checklist

- [ ] `N8N_WEBHOOK_SECRET` set in Dantown `.env.local`
- [ ] Supabase Service Role Key never exposed in workflows
- [ ] All workflow secrets use `{{ $env.VARIABLE_NAME }}`
- [ ] Credentials stored in n8n Credentials UI (not hardcoded)
- [ ] HTTPS used in production (not localhost)
- [ ] RLS policies configured for n8n access

---

## Support

**Check these files for help:**
- `N8N_SUPABASE_SETUP.md` - Full technical guide
- `automation/n8n/` - Workflow documentation
- `.next/dev/logs/next-development.log` - Dantown API logs
- Supabase Logs Explorer - Database logs

---

**Status:** ✅ Ready to go!

Run the setup script and start building workflows! 🚀
