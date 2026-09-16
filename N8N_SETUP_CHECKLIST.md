# N8N + Supabase Integration - Setup Checklist

## PRE-SETUP REQUIREMENTS

- [ ] n8n installed (`npm install -g n8n`)
- [ ] Supabase project created (vldccdtuwwyumqdkyxde)
- [ ] Dantown API running (`npm run dev` in apps/web)
- [ ] Access to Supabase dashboard
- [ ] Text editor for .env files

---

## STEP 1: Gather Credentials (5 min)

From **Supabase Dashboard → Settings → API**:

- [ ] Copy **Project URL**
  ```
  https://vldccdtuwwyumqdkyxde.supabase.co
  ```

- [ ] Copy **Anon Key** (public, safe to share)
  ```
  eyJhbGci...
  ```

- [ ] Copy **Service Role Key** (secret, keep safe)
  ```
  eyJhbGci...
  ```

---

## STEP 2: Run Setup Script (2 min)

### Windows
```bash
cd c:\Users\user\dantownecomers
setup-n8n.bat
```

### Mac/Linux
```bash
cd /Users/user/dantownecomers
bash setup-n8n.sh
```

**Script will:**
- [ ] Ask for Supabase credentials
- [ ] Ask for webhook secret
- [ ] Create `.env.n8n` file
- [ ] Show instructions for next steps

---

## STEP 3: Update Dantown Environment (1 min)

**File:** `apps/web/.env.local`

Add this line:
```env
N8N_WEBHOOK_SECRET=<value from setup script>
```

### Windows (PowerShell)
```powershell
Add-Content apps\web\.env.local "`nN8N_WEBHOOK_SECRET=<value>"
```

### Mac/Linux (Bash)
```bash
echo "N8N_WEBHOOK_SECRET=<value>" >> apps/web/.env.local
```

**Then:**
- [ ] Stop `npm run dev` in Dantown (Ctrl+C)
- [ ] Restart it: `npm run dev`
- [ ] Verify it starts successfully

---

## STEP 4: Start n8n (1 min)

### Windows (PowerShell)
```powershell
$env:N8N_WEBHOOK_SECRET="<value from .env.n8n>"
n8n
```

### Mac/Linux (Bash)
```bash
export N8N_WEBHOOK_SECRET="<value from .env.n8n>"
n8n
```

**Verify:**
- [ ] n8n starts without errors
- [ ] Access http://localhost:5678
- [ ] n8n Dashboard loads

---

## STEP 5: Add Supabase Credential (2 min)

**In n8n Dashboard:**

1. [ ] Click **Credentials** (left sidebar)
2. [ ] Click **New Credential** (top right)
3. [ ] Search for **"Supabase"**
4. [ ] Fill in:
   - [ ] **Credential Name:** `Supabase - Dantown`
   - [ ] **Host:** Your Supabase Project URL
   - [ ] **API Key (Anon):** Your anon key
   - [ ] **Service Role Key:** Your service role key
5. [ ] Click **Save**

**Verify:**
- [ ] Credential appears in Credentials list
- [ ] Status shows "Ready"

---

## STEP 6: Import Sample Workflow (1 min)

**In n8n Dashboard:**

1. [ ] Click **Import** (top left)
2. [ ] Choose file: `automation/n8n/n8n_workflow_stock_intake.json`
3. [ ] Click **Import**
4. [ ] Workflow appears in Dashboard

**Verify:**
- [ ] Workflow named "Stock Intake - Supplier Invoice" appears
- [ ] Can open it without errors

---

## STEP 7: Test API Connectivity (3 min)

**Using curl (Windows PowerShell / Mac Terminal):**

```bash
curl -X POST http://localhost:3000/api/automation/stock-intake `
  -H "Content-Type: application/json" `
  -H "x-dantown-automation-secret: <N8N_WEBHOOK_SECRET>" `
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
  "jobId": "...",
  "status": "COMPLETED",
  "itemCount": 1,
  "matches": [...]
}
```

**Verify:**
- [ ] Response status is 200 or 202
- [ ] Response is valid JSON
- [ ] No error messages

---

## STEP 8: Test n8n Workflow (2 min)

**In n8n Workflow:**

1. [ ] Open the imported "Stock Intake" workflow
2. [ ] Click **Test Workflow** (top right)
3. [ ] Click on **Manual Trigger** node
4. [ ] In the popup, provide test data:
   ```json
   {
     "supplier_name": "Test Co",
     "invoice_number": "INV-001",
     "transport_cost": 500,
     "items": [
       {
         "name": "LED",
         "supplier_sku": "LED-001",
         "quantity": 10,
         "unit_cost": 2500
       }
     ]
   }
   ```
5. [ ] Click **Execute**
6. [ ] Check the **HTTP Request** node result

**Verify:**
- [ ] HTTP status code is 200 or 202
- [ ] Response contains jobId
- [ ] No error messages in console

---

## STEP 9: Verify Supabase Data (2 min)

**In Supabase Dashboard:**

1. [ ] Go to **SQL Editor**
2. [ ] Run this query:
   ```sql
   SELECT * FROM automation_jobs 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```
3. [ ] Check results

**Verify:**
- [ ] Table exists (no "not found" error)
- [ ] Your test data appears in results
- [ ] Source is "N8N"
- [ ] Status is "COMPLETED" or "PENDING_REVIEW"

**If table doesn't exist:**
- [ ] Run setup SQL from N8N_DANTOWN_API_SETUP.md
- [ ] Create automation_jobs table

---

## STEP 10: Configure Your First Real Workflow (10 min)

**Choose one:**

### Option A: Email Invoice Processing
- [ ] Create new workflow
- [ ] Add **Gmail Trigger** or **Outlook Trigger**
- [ ] Add **PDF Parser** node
- [ ] Add **HTTP Request** node (Stock Intake)
- [ ] Add **Slack** notification
- [ ] Save & activate

### Option B: Low Stock Alerts
- [ ] Create new workflow
- [ ] Add **Cron** trigger (every 1 hour)
- [ ] Add **Supabase Select** node
- [ ] Configure: SELECT from `products` WHERE quantity < 5
- [ ] Add **Slack** node
- [ ] Add **Email** node
- [ ] Save & activate

### Option C: E-commerce Sync
- [ ] Create new workflow
- [ ] Add **Database Trigger** from Supabase
- [ ] Trigger on: products table updated
- [ ] Add **Shopify** or **WooCommerce** node
- [ ] Add **Supabase Update** node
- [ ] Log the sync result
- [ ] Save & activate

---

## STEP 11: Monitor & Debug (ongoing)

### Check n8n Logs
- [ ] Terminal where n8n runs
- [ ] Look for workflow execution logs
- [ ] Check for errors

### Check Dantown Logs
- [ ] Terminal where `npm run dev` runs
- [ ] Look for "STOCK_INTAKE" messages
- [ ] Check for auth or validation errors

### Check Supabase Logs
- [ ] Supabase Dashboard → Logs Explorer
- [ ] Filter for recent requests
- [ ] Check for SQL errors

### Query Supabase
```sql
-- View all submissions
SELECT * FROM automation_jobs;

-- View errors
SELECT * FROM automation_jobs WHERE status = 'FAILED';

-- View pending review
SELECT * FROM automation_jobs WHERE status = 'PENDING_REVIEW';
```

---

## TROUBLESHOOTING

### Issue: n8n won't start
**Check:**
- [ ] n8n installed? `n8n --version`
- [ ] Port 5678 available? `netstat -an | find "5678"`
- [ ] N8N_WEBHOOK_SECRET set? `echo $env:N8N_WEBHOOK_SECRET`

**Fix:**
```bash
# Kill any running n8n
taskkill /F /IM node.exe

# Try again with verbose logging
n8n -n --loglevel=verbose
```

### Issue: "401 Unauthorized"
**Check:**
- [ ] N8N_WEBHOOK_SECRET in Dantown `.env.local`
- [ ] Dantown restarted after adding secret
- [ ] Secret value matches in n8n (.env.n8n)

**Fix:**
- [ ] Update `.env.local` with correct secret
- [ ] Restart `npm run dev`
- [ ] Try API test again

### Issue: "Connection refused"
**Check:**
- [ ] Dantown running? `npm run dev` in apps/web
- [ ] URL correct? Should be `http://localhost:3000`
- [ ] Firewall blocking? Check Windows Defender

**Fix:**
- [ ] Start Dantown: `cd apps/web && npm run dev`
- [ ] Wait 2-3 seconds for startup
- [ ] Try again

### Issue: "Supabase node not found"
**Check:**
- [ ] Credential created? Go to Credentials
- [ ] Credential name correct? Should be "Supabase - Dantown"

**Fix:**
- [ ] Create new credential with exact name
- [ ] Fill in correct project URL and keys
- [ ] Try workflow again

### Issue: "Table automation_jobs doesn't exist"
**Check:**
- [ ] Table created in Supabase? Run SQL query

**Fix:**
- [ ] Go to Supabase SQL Editor
- [ ] Run SQL from N8N_DANTOWN_API_SETUP.md
- [ ] Try workflow again

---

## PERFORMANCE OPTIMIZATION

- [ ] Enable n8n database (SQLite or PostgreSQL)
- [ ] Configure n8n webhooks for production
- [ ] Set up n8n authentication
- [ ] Configure Supabase connection pooling
- [ ] Enable query result caching
- [ ] Set up monitoring/alerts
- [ ] Configure backup strategy
- [ ] Performance test workflows

---

## SECURITY HARDENING

- [ ] Review Supabase RLS policies
- [ ] Enable n8n authentication
- [ ] Rotate secrets monthly
- [ ] Use HTTPS in production
- [ ] Enable IP whitelisting
- [ ] Set up audit logging
- [ ] Review workflow permissions
- [ ] Encrypt sensitive data

---

## GO-LIVE CHECKLIST

### Before Production:
- [ ] All tests passing locally
- [ ] Workflows tested thoroughly
- [ ] Error handling configured
- [ ] Monitoring/alerts set up
- [ ] Backup strategy in place
- [ ] HTTPS configured
- [ ] Custom SMTP for emails
- [ ] Rate limiting configured
- [ ] Logging enabled
- [ ] Security review completed

### Deployment:
- [ ] Code deployed to production
- [ ] Environment variables updated
- [ ] Database migrations run
- [ ] Workflows activated
- [ ] Monitoring verified
- [ ] Alerts tested
- [ ] Documentation updated
- [ ] Team trained

### Post-Launch:
- [ ] Monitor logs for errors
- [ ] Track submission rates
- [ ] Monitor API response times
- [ ] Verify data accuracy
- [ ] Collect user feedback
- [ ] Plan iterations

---

## COMPLETION STATUS

- [ ] Step 1: Credentials gathered
- [ ] Step 2: Setup script run
- [ ] Step 3: Dantown updated
- [ ] Step 4: n8n started
- [ ] Step 5: Supabase credential added
- [ ] Step 6: Sample workflow imported
- [ ] Step 7: API test passed
- [ ] Step 8: n8n workflow tested
- [ ] Step 9: Supabase data verified
- [ ] Step 10: First real workflow configured
- [ ] Step 11: Monitoring set up

---

## NEXT STEPS

**Congratulations! Your n8n + Supabase integration is ready!**

Next:
1. ✅ Read N8N_QUICK_START.md for quick reference
2. ✅ Review N8N_SUPABASE_SETUP.md for advanced features
3. ✅ Check automation/n8n/ for workflow templates
4. ✅ Build your first production workflow
5. ✅ Monitor and iterate

---

**Status:** ✅ **READY TO USE**

Your n8n ↔ Supabase ↔ Dantown integration is fully operational! 🚀
