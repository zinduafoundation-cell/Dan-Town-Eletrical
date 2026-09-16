# Email Verification Fix - Complete Documentation

## PROBLEM DIAGNOSED

### Root Cause
Your registration endpoint was using Supabase's **admin API** with `email_confirm: false`:

```typescript
const { data, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: false,  // ← THIS PREVENTS EMAIL SENDING
  user_metadata: { full_name: fullName, phone }
});
```

**Result:** Users could register but Supabase NEVER sent a verification email. The account was silently marked as unconfirmed.

### Why This Broke
The admin API with `email_confirm: false` is for **internal/backend user creation** (like staff invitations). It doesn't trigger the normal email confirmation flow that sends verification links to users.

---

## SOLUTION IMPLEMENTED

### 1. Created Auth Callback Route
**File:** `app/auth/confirm/route.ts`

Handles the verification link clicked by the user:
- Extracts `token_hash` and `type` from email link
- Exchanges token for verified session using `supabase.auth.verifyOtp()`
- Redirects to `/account` on success
- Redirects to `/auth/callback-error` on failure

```
Email link: http://localhost:3000/auth/confirm?token_hash=abc123&type=email
           ↓
         This route verifies the token
           ↓
         User is authenticated
           ↓
         Redirects to /account
```

### 2. Fixed Registration Endpoint
**File:** `app/api/auth/register/route.ts`

Changed from admin API to proper signup:

```typescript
// NOW: Use regular signup which sends email
const { data, error: signupError } = await publicClient.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    data: { full_name: fullName, phone }
  }
});

// Still create customer record (existing behavior preserved)
const { data: customer } = await adminClient
  .from("customers")
  .insert({ user_id: data.user.id, ... })
```

### 3. Created Resend Endpoint
**File:** `app/api/auth/resend/route.ts`

Allows users to request a new verification email:

```typescript
const { error } = await publicClient.auth.resend({
  type: "signup",
  email,
  options: {
    emailRedirectTo: `${publicEnv.NEXT_PUBLIC_APP_URL}/auth/confirm`
  }
});
```

### 4. Enhanced Verification Page
**File:** `app/(auth)/verify-email/page.tsx`

Complete verification screen with:
- ✓ Shows the registered email address
- ✓ Clear instructions to check inbox
- ✓ Resend button with 60-second cooldown
- ✓ Option to use a different email
- ✓ Success/error messages
- ✓ Link back to login

### 5. Improved Registration Page
**File:** `app/(auth)/register/page.tsx`

- Better error handling
- Stores email in sessionStorage
- Redirects to verification page after signup
- Cleaner flow

---

## NEW AUTH FLOW

```
┌─────────────────────────────────────────────────────────────┐
│ 1. User visits /register                                    │
│    Fills: email, password, fullName, phone                  │
│    Accepts terms                                            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. POST /api/auth/register                                  │
│    - Calls supabase.auth.signUp() ← SENDS EMAIL              │
│    - Creates customer record                                │
│    - Creates user_role mapping                              │
│    - Stores email in sessionStorage                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. Redirects to /auth/verify-email                          │
│    Shows registered email                                  │
│    Shows verification instructions                         │
│    Provides resend button                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. User checks email                                        │
│    Email from Supabase contains:                            │
│    "Confirm your email address"                            │
│    + Link: /auth/confirm?token_hash=...&type=email         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. User clicks link in email                               │
│    GET /auth/confirm?token_hash=xxx&type=email             │
│    - Backend calls supabase.auth.verifyOtp()               │
│    - Exchange token for verified session                   │
│    - Set session cookies                                  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. User redirected to /account                             │
│    - Fully authenticated                                  │
│    - Can access dashboard                                │
│    - Email is verified                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## SUPABASE CONFIGURATION CHECKLIST

### ✓ Authentication Providers - Email
Go to: **Supabase Dashboard** → **Authentication** → **Providers** → **Email**

```
☑ ENABLE Supabase Auth
☑ ENABLE Email/Password signup
☑ Confirm email (EMAIL CONFIRMATIONS REQUIRED)
   - Set to: ✓ ENABLED (default for hosted projects)
   - This is the critical setting - it REQUIRES email verification
```

### ✓ URL Configuration - Redirect URLs
Go to: **Supabase Dashboard** → **Authentication** → **URL Configuration**

**Site URL:**
```
http://localhost:3000  (for local development)
https://yourdomain.com (for production)
```

**Redirect URLs:**
Must include the callback route. Add these:

```
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
https://yourdomain.com/auth/confirm
https://yourdomain.com/auth/callback
```

### ✓ Email Templates
Go to: **Supabase Dashboard** → **Authentication** → **Email Templates** → **Confirm Signup**

The default template should include:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next={{ .RedirectTo }}">
  Confirm your email address
</a>
```

**Note:** The default Supabase email template is rate-limited to **2 emails per hour**. For production, configure a custom SMTP provider (SendGrid, AWS SES, etc.). See: [Custom SMTP Guide](https://supabase.com/docs/guides/auth/auth-smtp)

---

## ENVIRONMENT VARIABLES

Your `.env.local` is correct:

```env
NEXT_PUBLIC_SUPABASE_URL=https://vldccdtuwwyumqdkyxde.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Add this if missing for local dev
```

**Security:** The `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the browser. It's server-only. ✓ (Correctly hidden in `server.ts`)

---

## FILES CHANGED

### Created (New Files)
1. `app/auth/confirm/route.ts` - Callback handler (88 lines)
2. `app/(auth)/callback-error/page.tsx` - Error page (27 lines)
3. `app/api/auth/resend/route.ts` - Resend endpoint (39 lines)

### Modified (Updated Files)
1. `app/api/auth/register/route.ts` - Fixed signup flow (+30 lines, complete rewrite)
2. `app/(auth)/register/page.tsx` - Better UX (+60 lines)
3. `app/(auth)/verify-email/page.tsx` - Full implementation (+120 lines)

### NOT Modified (Preserved)
- ✓ All 23 database migrations (untouched)
- ✓ Existing roles/permissions/RLS policies
- ✓ Supabase clients and configuration
- ✓ Login page logic
- ✓ Profile/customer creation logic

---

## LOCAL DEVELOPMENT TESTING

### Prerequisites
- `npm run dev` is running
- Local Supabase (with `supabase start`) OR remote project configured

### Test A: New Account Registration

1. **Open registration page:**
   ```
   http://localhost:3000/register
   ```

2. **Fill form:**
   - Full Name: `John Test`
   - Email: `john+test@example.com`
   - Phone: `555-1234`
   - Password: `TestPassword123!`
   - Confirm password: `TestPassword123!`
   - ✓ Accept terms

3. **Submit:**
   - Should see success message
   - Redirected to `/auth/verify-email`

4. **Check verification screen:**
   - Shows email: `john+test@example.com`
   - Shows clear instructions
   - Resend button present

5. **Check email:**
   - **If using Mailpit (local Supabase):**
     - Go to: `http://localhost:54325`
     - Subject: `Confirm your email address`
     - Click link in email

   - **If using Supabase Cloud:**
     - Check Gmail/Outlook inbox
     - Search for "Confirm your email address"
     - Link should look like: `https://vldccdtuwwyumqdkyxde.supabase.co/...`

6. **Click verification link:**
   - Should be redirected to `/account`
   - User should be fully authenticated
   - Session cookies should be set

7. **Verify database:**
   ```sql
   SELECT id, email, email_confirmed_at FROM auth.users WHERE email = 'john+test@example.com';
   SELECT * FROM profiles WHERE id = 'user-id';
   SELECT * FROM customers WHERE user_id = 'user-id';
   SELECT * FROM user_roles WHERE user_id = 'user-id';
   ```

### Test B: Resend Verification Email

1. **On verify-email page:**
   - Click "Resend verification email"
   - Button should show "Sending..."
   - After success: "Verification email sent!"
   - Button should show "Resend in 60s..." and be disabled

2. **Wait 60 seconds:**
   - Button should become enabled again
   - Can click to resend

3. **Check email:**
   - Should receive another verification email

### Test C: Login Before Verification

1. **Open login:**
   ```
   http://localhost:3000/login
   ```

2. **Try logging in with unverified email:**
   - Use the email from Test A
   - Enter password
   - Should see: `"The email or password was not recognised."`
   - Reason: Unverified users can't log in (by default in Supabase)

3. **After clicking verification link:**
   - Now login should work

### Test D: Already Verified Account

1. **Go to login:**
   ```
   http://localhost:3000/login
   ```

2. **Login with verified account:**
   - Should succeed immediately
   - Should be redirected to `/account`

---

## TROUBLESHOOTING

### Email Not Arriving

**Check 1: Supabase Email Confirmations Enabled?**
- Dashboard → Authentication → Email Providers
- Make sure "Confirm email" toggle is ON
- Should say "Email confirmations enabled"

**Check 2: Redirect URL Configured?**
- Dashboard → Authentication → URL Configuration
- Add redirect URL: `http://localhost:3000/auth/confirm`
- Save changes

**Check 3: Rate Limit?**
- Default Supabase email: 2 emails per hour
- Wait 30 minutes between registrations
- Or configure custom SMTP

**Check 4: Mailpit (Local Dev)?**
- Run: `supabase status`
- Open Mailpit URL shown in output
- Emails should appear there
- If not, check database logs

**Check 5: Wrong Email Address?**
- Typo in registration email
- Re-register with correct email

**Check 6: Browser Console Errors?**
- Open DevTools (F12)
- Check Console tab
- Look for errors in auth flow

**Check 7: Server Logs?**
- Run: `npm run dev`
- Look for "AUTH SIGNUP STARTED" logs
- Should see "AUTH SIGNUP SUCCESS"
- Should see "AUTH CALLBACK SUCCESS"

### Verification Link Expired

- Default Supabase token expiry: 24 hours
- User can click "Resend verification email" on verify-email page
- New link will be sent

### User Already Exists Error

- Clear browser cookies: DevTools → Application → Cookies
- Register with different email address
- Or wait 30 seconds before retrying same email

### "Verification link is invalid" Error

- Token hash may have been corrupted in URL
- User should click "Resend verification email"
- Or go back to login and try again

### Session Not Set After Verification

- Check browser cookies: DevTools → Application → Cookies
- Should see: `sb-auth-token`, `sb-refresh-token`
- If missing, callback route may have failed
- Check server logs for "AUTH CALLBACK ERROR"

---

## WHAT SUPABASE CONFIGURATION CANNOT FIX

These must be fixed in the code (already done):

1. ✓ Signup must use `auth.signUp()` not admin API
2. ✓ Email redirect must be set: `emailRedirectTo: '/auth/confirm'`
3. ✓ Callback route must exist to exchange token
4. ✓ Callback must use `auth.verifyOtp()` to verify
5. ✓ Session cookies must be set after verification

All of these are now implemented correctly.

---

## IMPORTANT PRODUCTION CHECKLIST

Before going to production:

- [ ] Configure custom SMTP provider (not default 2 emails/hour)
  - SendGrid: [Guide](https://supabase.com/docs/guides/auth/auth-smtp)
  - AWS SES: [Guide](https://supabase.com/docs/guides/auth/auth-smtp)
  - Other: Check Supabase documentation

- [ ] Update Site URL
  ```
  Supabase Dashboard → Authentication → URL Configuration
  Site URL: https://yourdomain.com
  ```

- [ ] Add redirect URLs
  ```
  https://yourdomain.com/auth/confirm
  https://yourdomain.com/auth/callback
  ```

- [ ] Test complete flow in production domain

- [ ] Enable email rate limiting
  - Supabase Dashboard → Email Rate Limiting
  - Recommend: 10 emails per hour per user

- [ ] Monitor email deliverability
  - Check spam/junk folder rates
  - Implement DKIM/SPF for custom SMTP

- [ ] Add monitoring/alerts
  - Log verification email sends
  - Log verification failures
  - Alert on high failure rates

---

## SUMMARY OF CHANGES

| Aspect | Before | After |
|--------|--------|-------|
| Email Sent | ✗ Never | ✓ Always |
| Signup Method | Admin API | Regular auth.signUp() |
| Callback Route | ✗ Missing | ✓ /auth/confirm |
| Verification Page | Basic | Professional with resend |
| Resend Ability | ✗ None | ✓ With cooldown |
| Session After Verify | ✗ Manual | ✓ Automatic |
| Error Handling | Poor | Clear messages |
| Security | Admin key exposed in logic | ✓ Properly isolated |

---

## NEXT STEPS FOR YOU

1. **Verify Supabase Settings:**
   - Confirm "Email Confirmations" is ENABLED
   - Add `/auth/confirm` to redirect URLs
   - Review email template

2. **Test Locally:**
   - Run: `npm run dev`
   - Register a test account
   - Complete the flow
   - Check Mailpit for emails

3. **Deploy Changes:**
   - Push code to your repository
   - Deploy to production
   - Test in production domain

4. **Monitor:**
   - Check Supabase logs for issues
   - Monitor email delivery rates
   - Alert on verification failures

---

**All code is in place. The flow is ready to test!** 🎉
