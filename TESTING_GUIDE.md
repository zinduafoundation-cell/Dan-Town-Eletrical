# Quick Testing Guide - Email Verification Fix

## 🚀 QUICK START TEST (2 minutes)

### Step 1: Start Dev Server
```powershell
cd c:\Users\user\dantownecomers
npm run dev
```
Should see:
```
✓ Next.js running at http://localhost:3000
```

### Step 2: Open Registration
Visit: http://localhost:3000/register

### Step 3: Fill Registration Form
```
Full Name: Test User
Email: test@example.com
Phone: 555-1234
Password: TestPassword123!
Confirm: TestPassword123!
✓ Check terms
Click: Create account
```

### Step 4: Expected Result 1 ✓
You should see:
- Redirect to: `http://localhost:3000/auth/verify-email`
- Shows: "Check your inbox"
- Shows email: `test@example.com`
- Shows "Resend verification email" button

### Step 5: Check Email
- **If Local Supabase:**
  - Visit: `http://localhost:54325` (Mailpit)
  - Look for email from Supabase
  - Subject: "Confirm your email address"
  
- **If Cloud Supabase:**
  - Check your inbox
  - Might take a minute
  - Search for "Dantown" or "Confirm"

### Step 6: Click Verification Link
- Open the email
- Click "Confirm email address" link
- Link looks like: `http://localhost:3000/auth/confirm?token_hash=xxx`

### Step 7: Expected Result 2 ✓
You should:
- See redirect happening
- End up at: `http://localhost:3000/account`
- Be fully logged in
- See dashboard content

### Step 8: Verify in Browser
- Open DevTools (F12)
- Go to: Application → Cookies
- Look for: `sb-auth-token` cookie
- Should be set ✓

---

## 🔍 DETAILED TEST SCENARIOS

### Scenario A: Fresh Account → Verification → Login

**Test:** Complete signup flow works end-to-end

```bash
# 1. Navigate to /register
# 2. Use email: alice@example.com
# 3. Complete registration
# 4. Go to Mailpit/check email
# 5. Click verification link
# 6. Should redirect to /account
# 7. Verify session cookies present
# 8. Logout
# 9. Try login with alice@example.com
# 10. Should login successfully
```

**Expected:** ✓ Can register, verify, logout, and login

---

### Scenario B: Resend Verification Email

**Test:** Resend button works with cooldown

```bash
# 1. Register with bob@example.com
# 2. On /auth/verify-email page
# 3. Click "Resend verification email"
# 4. Button should show "Sending..."
# 5. After 2-3 seconds: "Verification email sent!"
# 6. Button shows "Resend in 60s..."
# 7. Wait 10 seconds
# 8. Button still shows "Resend in 50s..." (countdown)
# 9. Check email inbox
# 10. Should have 2 verification emails
# 11. Both links should work
```

**Expected:** ✓ Resend works, cooldown prevents spam, both emails valid

---

### Scenario C: Error Handling - Expired Link

**Test:** Shows error page if link expired

```bash
# 1. Get a verification link from email
# 2. Wait 24+ hours OR manually corrupt the token
# 3. Click the link
# 4. Should redirect to: /auth/callback-error
# 5. Shows: "Verification link expired"
# 6. Shows: "Request new verification email" link
# 7. Click "Request new verification email"
# 8. Returns to /register
```

**Expected:** ✓ Error handled gracefully, user can recover

---

### Scenario D: Wrong Email - Can Start Over

**Test:** User can go back and use different email

```bash
# 1. Register with wrong@example.com
# 2. On /auth/verify-email page
# 3. Click "Use a different email address"
# 4. Redirected to /register
# 5. Can register again with correct@example.com
# 6. Should work normally
```

**Expected:** ✓ User can start over with different email

---

### Scenario E: Login Before Verification

**Test:** Unverified accounts can't login

```bash
# 1. Register with charlie@example.com
# 2. DO NOT verify email
# 3. Go to /login
# 4. Try login with charlie@example.com
# 5. Should see: "The email or password was not recognised"
# 6. Now verify the email
# 7. Try login again
# 8. Should succeed this time
```

**Expected:** ✓ Unverified accounts blocked, verified accounts work

---

### Scenario F: Database Consistency

**Test:** Database records created correctly

```bash
# After verifying an account in Test A above:
# 
# 1. Check auth.users table
#    - Should have user record
#    - Should have email_confirmed_at timestamp (not null)
#
# 2. Check profiles table
#    - Should have profile for that user
#    - Should have full_name filled in
#
# 3. Check customers table
#    - Should have customer record
#    - user_id should reference auth user
#    - name, email, phone should match registration
#
# 4. Check user_roles table
#    - Should link user to CUSTOMER role
```

**Expected:** ✓ All database records created, relationships correct

---

## 📋 VERIFICATION CHECKLIST

After testing, verify these items:

- [ ] Registration form submits successfully
- [ ] Email is captured and shown on verify-email page
- [ ] Verification email is received in inbox (Mailpit or real email)
- [ ] Verification link in email is clickable
- [ ] Clicking link redirects to /account
- [ ] User session is authenticated after verification
- [ ] Logout works
- [ ] Can login with verified account
- [ ] Resend button works with cooldown
- [ ] Multiple resends all work
- [ ] Expired link shows error page
- [ ] Can use different email
- [ ] Unverified accounts can't login
- [ ] Database records are created correctly
- [ ] No console errors in browser
- [ ] No errors in server logs

---

## 🐛 DEBUGGING TIPS

### Check Server Logs
Look for these log messages in `npm run dev` output:

```
AUTH SIGNUP STARTED { email: 'test@example.com' }
AUTH SIGNUP SUCCESS { userId: 'xxx-xxx-xxx', email: 'test@example.com' }
CUSTOMER CREATED { customerId: 'yyy-yyy-yyy' }
AUTH CALLBACK SUCCESS { type: 'email', next: '/account' }
```

### Check Browser Errors
Open DevTools (F12):
- Console tab: Look for errors (red messages)
- Network tab: Check /api/auth/register response
- Application → Cookies: Verify session cookies

### Check Email Issues
- Mailpit: `http://localhost:54325`
  - Should show "Confirm your email address" subject
  - Should have clickable link
  - Click in Mailpit to test link

- Real Email:
  - Check spam/junk folder
  - Check promotions tab (Gmail)
  - Search for "Dantown" or sender email

### Check Database
```sql
-- Check user was created
SELECT id, email, email_confirmed_at FROM auth.users 
WHERE email = 'test@example.com';

-- Check profile was created (by trigger)
SELECT * FROM profiles 
WHERE id = (SELECT id FROM auth.users WHERE email = 'test@example.com');

-- Check customer was created
SELECT * FROM customers 
WHERE email = 'test@example.com';

-- Check role was assigned
SELECT * FROM user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'test@example.com');
```

### If Tests Fail

**Problem:** "Email not arriving"
- Solution 1: Use Mailpit instead (local dev)
- Solution 2: Check Supabase rate limits (2 emails/hour default)
- Solution 3: Wait 30 seconds and try again
- Solution 4: Check spam folder

**Problem:** "Verification link doesn't work"
- Solution 1: Check URL has all query params
- Solution 2: Try different browser/incognito
- Solution 3: Check browser console for errors
- Solution 4: Check server logs for callback errors

**Problem:** "Still can't login after verification"
- Solution 1: Hard refresh browser (Ctrl+Shift+R)
- Solution 2: Clear cookies (DevTools → Storage → Cookies → Delete all)
- Solution 3: Check email was actually verified in database
- Solution 4: Try different email address

---

## 📊 SUCCESS CRITERIA

All tests pass if:
1. ✓ Can register with new email
2. ✓ Receive verification email within 2 minutes
3. ✓ Clicking link verifies account
4. ✓ Can login after verification
5. ✓ Can't login before verification
6. ✓ Can resend verification email
7. ✓ Database records created correctly
8. ✓ No errors in console or server logs
9. ✓ Session persists after page refresh
10. ✓ Logout clears session

---

## 📞 SUPPORT

If you get stuck:
1. Check EMAIL_VERIFICATION_FIX.md for detailed documentation
2. Review server logs (npm run dev terminal)
3. Check browser DevTools (F12 → Console)
4. Verify Supabase configuration in dashboard
5. Confirm Mailpit is running (local dev): `supabase status`

Good luck! 🎉
