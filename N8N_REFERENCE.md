# N8N Quick Reference Card

## Installation

```bash
# Install n8n globally
npm install -g n8n

# Verify installation
n8n --version
```

---

## Startup Commands

### Windows (PowerShell)
```powershell
# Set environment variable
$env:N8N_WEBHOOK_SECRET="your-secret-key-here"

# Start n8n
n8n

# Or in one line
$env:N8N_WEBHOOK_SECRET="your-secret"; n8n
```

### Mac/Linux (Bash)
```bash
# Set environment variable
export N8N_WEBHOOK_SECRET="your-secret-key-here"

# Start n8n
n8n

# Or in one line
N8N_WEBHOOK_SECRET="your-secret" n8n
```

---

## URLs

| Service | URL | Purpose |
|---------|-----|---------|
| n8n | http://localhost:5678 | Workflow editor |
| Dantown | http://localhost:3000 | API server |
| Supabase | https://app.supabase.com | Dashboard |
| API Endpoint | http://localhost:3000/api/automation/stock-intake | Stock intake endpoint |
| Mailpit | http://localhost:54325 | Local email capture (if using local Supabase) |

---

## API Testing

### Using curl

```bash
# Test stock intake endpoint
curl -X POST http://localhost:3000/api/automation/stock-intake \
  -H "Content-Type: application/json" \
  -H "x-dantown-automation-secret: YOUR_SECRET" \
  -d '{
    "source": "N8N",
    "workflow_name": "DANTOWN_STOCK_INTAKE",
    "supplier_name": "Test",
    "supplier_reference": "TEST-001",
    "received_at": "2026-08-31T12:00:00Z",
    "transport_cost": 500,
    "other_costs": 0,
    "items": [{
      "name": "LED",
      "supplier_sku": "LED-001",
      "quantity": 10,
      "unit_cost": 2500
    }]
  }'
```

### Using Postman

1. Create new **POST** request
2. URL: `http://localhost:3000/api/automation/stock-intake`
3. Headers:
   - `Content-Type: application/json`
   - `x-dantown-automation-secret: YOUR_SECRET`
4. Body (JSON):
   ```json
   {
     "source": "N8N",
     "workflow_name": "TEST",
     ...
   }
   ```
5. Click Send

---

## Supabase SQL Queries

### Check automation jobs
```sql
SELECT * FROM automation_jobs 
ORDER BY created_at DESC 
LIMIT 10;
```

### Find errors
```sql
SELECT * FROM automation_jobs 
WHERE status = 'FAILED' 
ORDER BY created_at DESC;
```

### Check pending review
```sql
SELECT id, source, workflow_name, result 
FROM automation_jobs 
WHERE status = 'PENDING_REVIEW';
```

### Get latest job
```sql
SELECT * FROM automation_jobs 
ORDER BY created_at DESC 
LIMIT 1;
```

### Count submissions today
```sql
SELECT COUNT(*) as count 
FROM automation_jobs 
WHERE DATE(created_at) = TODAY();
```

### View job details
```sql
SELECT 
  id,
  source,
  workflow_name,
  status,
  payload,
  result,
  created_at
FROM automation_jobs 
WHERE id = 'YOUR_JOB_ID';
```

---

## n8n Workflow Nodes

### Triggers
- **Manual Trigger** - Click to start
- **HTTP Webhook** - External system sends data
- **Email Trigger** - On incoming email
- **Database Trigger** - On table change
- **Cron** - Scheduled (every hour, daily, etc.)

### Data Processing
- **Code** - JavaScript code
- **If** - Conditional logic
- **Merge** - Combine data from multiple paths
- **Transform** - Restructure data

### Supabase
- **Supabase Select** - Read data
- **Supabase Insert** - Create records
- **Supabase Update** - Modify records
- **Supabase Delete** - Remove records

### Communications
- **Email** - Send emails
- **Slack** - Send Slack messages
- **HTTP Request** - Call APIs
- **Webhook** - Expose workflow as endpoint

### External Services
- **Shopify** - E-commerce
- **Stripe** - Payments
- **Google Sheets** - Spreadsheets
- **Airtable** - Databases

---

## Environment Variables

### n8n (.env.n8n or system env)
```env
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
N8N_WEBHOOK_SECRET=your-secret-here
N8N_TIMEZONE=Africa/Nairobi
```

### Dantown (apps/web/.env.local)
```env
N8N_WEBHOOK_SECRET=your-secret-here
```

---

## Keyboard Shortcuts (n8n)

| Action | Shortcut |
|--------|----------|
| Save workflow | Ctrl+S |
| Test workflow | Ctrl+Enter |
| Duplicate node | Ctrl+D |
| Delete node | Delete |
| Pan view | Space + drag |
| Zoom in | Ctrl+Plus |
| Zoom out | Ctrl+Minus |
| Fit to view | Ctrl+1 |

---

## Common Workflow Patterns

### HTTP Request to Dantown API
```
HTTP Request Node:
├─ Method: POST
├─ URL: http://localhost:3000/api/automation/stock-intake
├─ Auth: Header
├─ Header: x-dantown-automation-secret = {{ $env.N8N_WEBHOOK_SECRET }}
├─ Body: JSON with payload
└─ Send as: application/json
```

### Read from Supabase
```
Supabase Select Node:
├─ Credential: Supabase - Dantown
├─ Table: products
├─ Limit: 100
├─ Filters: (optional)
└─ Return All: true
```

### Update Supabase
```
Supabase Update Node:
├─ Credential: Supabase - Dantown
├─ Table: automation_jobs
├─ Filter: id = {{ jobId }}
└─ Set: status = "COMPLETED"
```

### Send Slack Message
```
Slack Node:
├─ Action: Send message
├─ Channel: #alerts
├─ Message: "New order received: {{ orderId }}"
└─ Mention: (optional)
```

---

## Error Codes

| Code | Status | Meaning | Fix |
|------|--------|---------|-----|
| INVALID_SECRET | 401 | Wrong secret header | Check N8N_WEBHOOK_SECRET |
| VALIDATION_ERROR | 400 | Invalid payload | Check payload format |
| DUPLICATE_SUBMISSION | 409 | Invoice already processed | Use different supplier_reference |
| JOB_CREATE_FAILED | 500 | DB error creating job | Check Supabase connection |
| TABLE_NOT_FOUND | ERROR | Missing automation_jobs table | Create table via SQL |

---

## Workflow Examples

### Example 1: Simple Stock Intake
```
Manual Trigger
→ HTTP Request (POST to Dantown)
→ Check Response (If status = 200)
→ Success: Log to console
→ Error: Send email alert
```

### Example 2: Daily Low Stock Check
```
Cron (Every day at 9 AM)
→ Supabase Select (products qty < 5)
→ Slack Message (send alert)
→ Supabase Update (mark as notified)
```

### Example 3: Email Invoice Processing
```
Email Trigger
→ Extract PDF attachment
→ AI Document Parser (extract text)
→ Code (parse invoice)
→ HTTP Request (send to Dantown)
→ Log results
→ Send confirmation email
```

---

## Debugging

### n8n Logs
Look in terminal where n8n runs:
```
[workflow-name] execution started
[workflow-name] execution completed
```

### Dantown Logs
Look in terminal where `npm run dev` runs:
```
STOCK_INTAKE STARTED { ... }
STOCK_INTAKE COMPLETED { ... }
STOCK_INTAKE ERROR { ... }
```

### Browser Console (n8n)
- F12 to open DevTools
- Console tab shows client-side errors
- Network tab shows API requests

### Supabase Logs
- Dashboard → Logs Explorer
- Filter by time and message
- Check for SQL errors

---

## File Locations

| File | Path | Purpose |
|------|------|---------|
| n8n config | ~/.n8n | Settings |
| Dantown API | apps/web/app/api/automation/stock-intake/route.ts | API endpoint |
| Workflow sample | automation/n8n/n8n_workflow_stock_intake.json | Template |
| Setup script | setup-n8n.bat or setup-n8n.sh | Configuration |
| Documentation | N8N_*.md files | Guides |

---

## Performance Tips

- Use Supabase connection pooling for high volume
- Limit n8n workflow concurrency to 5-10
- Cache API responses when possible
- Use database indexes on frequently queried fields
- Monitor n8n memory usage (`top` or Task Manager)
- Scale n8n horizontally if needed

---

## Security Checklist

- [ ] N8N_WEBHOOK_SECRET in .env.local
- [ ] Service Role Key never in workflows
- [ ] Use `{{ $env.VARIABLE }}` for secrets
- [ ] HTTPS in production
- [ ] RLS policies on Supabase tables
- [ ] IP whitelisting if possible
- [ ] Audit logging enabled
- [ ] Regular backups configured

---

## Quick Start Command

```bash
# Windows
cd c:\Users\user\dantownecomers
setup-n8n.bat
```

```bash
# Mac/Linux
cd /Users/user/dantownecomers
bash setup-n8n.sh
```

---

## Documentation Index

- **N8N_QUICK_START.md** - 5 min setup
- **N8N_SUPABASE_SETUP.md** - Full technical guide
- **N8N_DANTOWN_API_SETUP.md** - API implementation
- **N8N_SETUP_CHECKLIST.md** - Step-by-step checklist
- **N8N_INTEGRATION_SUMMARY.md** - Architecture overview
- **This file** - Quick reference

---

## Support

**Stuck?**
1. Check error codes above
2. Review relevant documentation file
3. Check logs (n8n, Dantown, Supabase)
4. Test API with curl
5. Verify environment variables

**Resources:**
- n8n Docs: https://docs.n8n.io
- Supabase Docs: https://supabase.com/docs
- Next.js Docs: https://nextjs.org/docs

---

**Last Updated:** 2026-08-31
**Status:** ✅ Ready for Production
