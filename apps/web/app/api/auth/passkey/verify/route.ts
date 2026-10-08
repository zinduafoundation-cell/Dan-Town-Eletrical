import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { AUTH_SESSION_PERSISTENCE_COOKIE, persistenceMarkerCookieOptions } from "@/lib/auth/session-cookies";
import { isQuickAccessEnabled, quickAccessCookie } from "@/lib/auth/quick-access";
import { verifyAuthentication, verifyRegistration } from "@/lib/auth/webauthn";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  clearChallengeCookie, isStaffUser, listPasskeys, maxDevicesPerPerson, passkeyDb, recordSecurityEvent,
  relyingParty, stepUpCookie, takeChallenge, tooManyAttempts, type PasskeyRow,
} from "@/lib/auth/passkeys";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mode: z.enum(["register", "login", "verify"]),
  deviceLabel: z.string().trim().max(60).optional(),
  credential: z.object({
    id: z.string().min(1).max(1024),
    response: z.object({
      clientDataJSON: z.string(),
      attestationObject: z.string().optional(),
      authenticatorData: z.string().optional(),
      signature: z.string().optional(),
      userHandle: z.string().nullable().optional(),
      transports: z.array(z.string()).optional(),
    }),
  }),
});

function fail(message: string, status = 400) {
  const response = NextResponse.json({ error: message }, { status });
  response.cookies.set(clearChallengeCookie);
  return response;
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return fail("Invalid biometric response.");
  const { mode, credential, deviceLabel } = parsed.data;
  const { origin, rpId } = relyingParty(request);
  const challenge = await takeChallenge(mode);
  if (!challenge) return fail("That request expired. Please try again.");
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  try {
    /* ---- link this phone to the signed-in staff member ---- */
    if (mode === "register") {
      const context = await getAuthorizationContext();
      if (!context || context.userId !== challenge.u) return fail("Sign in first.", 401);
      if ((await listPasskeys(context.userId)).length >= maxDevicesPerPerson) return fail("Device limit reached. Remove one first.");
      if (!credential.response.attestationObject) return fail("Invalid biometric response.");

      const result = verifyRegistration({
        credential: { id: credential.id, response: { clientDataJSON: credential.response.clientDataJSON, attestationObject: credential.response.attestationObject, transports: credential.response.transports } },
        expectedChallenge: challenge.c, expectedOrigin: origin, rpId,
      });
      const { error } = await passkeyDb().from("staff_passkeys").insert({
        user_id: context.userId, credential_id: result.credentialId, public_key: result.publicKey,
        counter: result.counter, transports: result.transports, device_label: deviceLabel || "This phone",
      });
      if (error) return fail(error.code === "23505" ? "This phone is already linked." : "Could not save this device.");
      await recordSecurityEvent(context.userId, "BIOMETRIC_DEVICE_ADDED", { device_label: deviceLabel || "This phone" });

      const response = NextResponse.json({ ok: true });
      response.cookies.set(clearChallengeCookie);
      response.cookies.set(stepUpCookie(context.userId));
      return response;
    }

    /* ---- check an assertion (login or confirm-it's-me) ---- */
    if (!credential.response.authenticatorData || !credential.response.signature) return fail("Invalid biometric response.");
    if (mode === "login" && tooManyAttempts(`login:${ip}`)) return fail("Too many attempts. Try again in a few minutes.", 429);

    const { data } = await passkeyDb().from("staff_passkeys").select("*").eq("credential_id", credential.id).maybeSingle();
    const row = data as PasskeyRow | null;
    if (!row) { tooManyAttempts(`login:${ip}`, true); return fail("This phone is not linked to a staff account.", 401); }
    if (mode === "verify" && row.user_id !== challenge.u) return fail("This is not your registered phone.", 403);

    let result;
    try {
      result = verifyAuthentication({
        credential: { id: credential.id, response: { clientDataJSON: credential.response.clientDataJSON, authenticatorData: credential.response.authenticatorData, signature: credential.response.signature } },
        expectedChallenge: challenge.c, expectedOrigin: origin, rpId, publicKey: row.public_key, storedCounter: Number(row.counter),
      });
    } catch (error) {
      tooManyAttempts(`login:${ip}`, true);
      await recordSecurityEvent(row.user_id, "BIOMETRIC_FAILED", { mode, reason: error instanceof Error ? error.message : "unknown" });
      return fail("Biometric check failed. Try again or use your password.", 401);
    }
    await passkeyDb().from("staff_passkeys").update({ counter: result.newCounter, last_used_at: new Date().toISOString() }).eq("id", row.id);

    const admin = createSupabaseServiceClient();
    const { data: userResult } = await admin.auth.admin.getUserById(row.user_id);
    const user = userResult.user;
    if (!user?.email || !(await isStaffUser(user.id, user.email))) return fail("This account no longer has staff access.", 403);

    if (mode === "login") {
      // Turn the verified fingerprint into a normal Supabase session for that staff member.
      const { data: link, error: linkError } = await admin.auth.admin.generateLink({ type: "magiclink", email: user.email });
      const tokenHash = link?.properties?.hashed_token;
      if (linkError || !tokenHash) return fail("Could not start your session. Use your password instead.", 500);
      const supabase = await createSupabaseServerClient({ sessionPersistence: "session" });
      const { error: otpError } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (otpError) return fail("Could not start your session. Use your password instead.", 500);
      (await cookies()).set(AUTH_SESSION_PERSISTENCE_COOKIE, "session", persistenceMarkerCookieOptions("session", origin.startsWith("https:")));
      await recordSecurityEvent(user.id, "BIOMETRIC_LOGIN", { device_label: row.device_label });
    } else {
      await recordSecurityEvent(user.id, "BIOMETRIC_CONFIRMED", { device_label: row.device_label });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(clearChallengeCookie);
    response.cookies.set(stepUpCookie(user.id));
    // A confirmed fingerprint also opens the secondary Dantown Centre lock (replaces typing the PIN).
    if (isQuickAccessEnabled()) response.cookies.set(quickAccessCookie(user.id));
    return response;
  } catch (error) {
    console.error("PASSKEY ERROR", error);
    return fail(error instanceof Error ? error.message : "Biometric check failed.");
  }
}
