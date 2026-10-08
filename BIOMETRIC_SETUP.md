# Biometric (fingerprint / face) for Dantown staff

## Turn it on
1. Run the new migration `supabase/migrations/20261008120000_staff_passkeys.sql` (npm run migrate).
2. Use https (Vercel is fine) or `localhost`. Phones refuse biometrics on plain http.
3. Make sure `NEXT_PUBLIC_APP_URL` is your real site address (passkeys are tied to that domain).
4. Optional: `DANTOWN_BIOMETRIC_GATE=on` makes fingerprint/face the Dantown Centre lock even with no PIN.
   `DANTOWN_QUICK_ACCESS_COOKIE_SECRET` should be a long random value.

## Each staff member (30 seconds)
Sign in with password once -> open **Staff** or **Dantown Centre** -> "Fingerprint & face unlock" -> **Link this device**.
Up to 5 devices each. Remove a lost phone from the same card (or delete its row in `staff_passkeys`).

## What it does
- **Sign in**: "Staff: sign in with fingerprint or face" on the login page. No password, and it identifies the person.
- **Centre lock**: replaces the PIN screen in /admin (PIN still works if configured).
- **Step-up**: refunds, stock adjustments and removing a device need a fresh fingerprint (valid 5 minutes).
  Only applies to people who have linked a phone, so nobody is locked out while you roll it out.
- **Accountability**: every biometric login / confirmation / failure is written to `audit_logs`
  and shown per person under "Staff activity today" in the Dantown Centre.

Security notes: only a public key is stored; replayed or cloned credentials are rejected; sign-out clears the
Centre unlock and fingerprint confirmation; customers cannot enrol (staff roles only).
