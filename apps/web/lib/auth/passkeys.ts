import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { isBskEmailAddress } from "@/lib/auth/server";

export const CHALLENGE_COOKIE = "dantown-passkey-challenge";
export const STEPUP_COOKIE = "dantown-biometric-stepup";
const STEPUP_MINUTES = 5;
const MAX_DEVICES_PER_PERSON = 5;

export type PasskeyMode = "register" | "login" | "verify";

export type PasskeyRow = {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[];
  device_label: string;
  created_at: string;
  last_used_at: string | null;
};

/** The passkey table is server-only, so it is not part of the generated client types. */
export function passkeyDb() {
  return createSupabaseServiceClient() as unknown as SupabaseClient;
}

export const maxDevicesPerPerson = MAX_DEVICES_PER_PERSON;

/* ---------- signing ---------- */

function secret() {
  const explicit = process.env.DANTOWN_QUICK_ACCESS_COOKIE_SECRET || process.env.DANTOWN_QUICK_ACCESS_PIN_HASH;
  if (explicit) return explicit;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error("A server secret is required for biometric sign-in.");
  return createHmac("sha256", serviceKey).update("dantown-passkey-v1").digest("hex");
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("base64url");
}

export function signPayload(payload: Record<string, unknown>) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSignedPayload<T>(value: string | undefined): (T & { exp: number }) | null {
  if (!value) return null;
  const [body, signature] = value.split(".");
  if (!body || !signature) return null;
  const expected = sign(body);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
    return parsed.exp > Date.now() ? parsed : null;
  } catch {
    return null;
  }
}

/* ---------- relying party (this website) ---------- */

export function relyingParty(request: Request) {
  const configured = new URL(getAppUrl(request)).origin;
  // In production only the configured site is trusted. Locally, accept the page you are testing from.
  const origin = process.env.NODE_ENV === "production" ? configured : request.headers.get("origin") ?? configured;
  return { origin, rpId: new URL(origin).hostname, rpName: "Dantown Electrical" };
}

/* ---------- challenges ---------- */

export function newChallenge() {
  return randomBytes(32).toString("base64url");
}

export function challengeCookie(mode: PasskeyMode, challenge: string, userId: string | null) {
  return {
    name: CHALLENGE_COOKIE,
    value: signPayload({ c: challenge, m: mode, u: userId, exp: Date.now() + 2 * 60 * 1000 }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/api/auth/passkey",
    maxAge: 120,
  };
}

export async function takeChallenge(mode: PasskeyMode) {
  const store = await cookies();
  const payload = readSignedPayload<{ c: string; m: PasskeyMode; u: string | null }>(store.get(CHALLENGE_COOKIE)?.value);
  if (!payload || payload.m !== mode) return null;
  return payload;
}

export const clearChallengeCookie = { name: CHALLENGE_COOKIE, value: "", path: "/api/auth/passkey", maxAge: 0 };

/* ---------- who may use biometrics ---------- */

/** Everyone except plain customers. All staff share one role, so biometrics identify the person. */
export async function isStaffUser(userId: string, email?: string | null) {
  if (isBskEmailAddress(email)) return true;
  const db = passkeyDb();
  const { data: assignments } = await db.from("user_roles").select("role_id").eq("user_id", userId);
  const roleIds = (assignments ?? []).map((row: { role_id: string }) => row.role_id);
  if (!roleIds.length) return false;
  const { data: roles } = await db.from("roles").select("code").in("id", roleIds);
  return (roles ?? []).some((role: { code: string }) => role.code !== "CUSTOMER");
}

export async function listPasskeys(userId: string) {
  const { data } = await passkeyDb().from("staff_passkeys").select("*").eq("user_id", userId).order("created_at");
  return (data ?? []) as PasskeyRow[];
}

export async function userHasPasskey(userId: string) {
  const { count } = await passkeyDb().from("staff_passkeys").select("id", { count: "exact", head: true }).eq("user_id", userId);
  return (count ?? 0) > 0;
}

export async function recordSecurityEvent(userId: string | null, action: string, details: Record<string, unknown> = {}) {
  await passkeyDb().from("audit_logs").insert({ user_id: userId, action, resource_type: "staff_passkey", new_data: details });
}

/* ---------- step-up: "prove it is really you" before sensitive actions ---------- */

export function stepUpCookie(userId: string) {
  return {
    name: STEPUP_COOKIE,
    value: signPayload({ u: userId, exp: Date.now() + STEPUP_MINUTES * 60 * 1000 }),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: STEPUP_MINUTES * 60,
  };
}

export async function hasRecentBiometric(userId: string) {
  const store = await cookies();
  const payload = readSignedPayload<{ u: string }>(store.get(STEPUP_COOKIE)?.value);
  return Boolean(payload && payload.u === userId);
}

/**
 * Call at the top of a sensitive API route (refunds, stock adjustments...).
 * Returns a ready-made 403 response when the person has enrolled a phone but
 * has not confirmed with it in the last few minutes; otherwise returns null.
 * People who have not enrolled yet are not locked out.
 */
export async function requireBiometricStepUp(userId: string) {
  if (userId === "dev-bypass-user") return null;
  if (!(await userHasPasskey(userId))) return null;
  if (await hasRecentBiometric(userId)) return null;
  return NextResponse.json({ error: "Confirm with your fingerprint or face to continue.", code: "BIOMETRIC_REQUIRED" }, { status: 403 });
}

/* ---------- gentle brute-force guard for the public login endpoint ---------- */

const attempts = new Map<string, { count: number; resetAt: number }>();

export function tooManyAttempts(key: string, record = false) {
  const now = Date.now();
  const current = attempts.get(key);
  const live = current && current.resetAt > now ? current : null;
  if (record) attempts.set(key, { count: (live?.count ?? 0) + 1, resetAt: live?.resetAt ?? now + 10 * 60 * 1000 });
  return (live?.count ?? 0) >= 10;
}
