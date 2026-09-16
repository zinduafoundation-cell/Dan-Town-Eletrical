import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";

const scrypt = promisify(scryptCallback);
const COOKIE_NAME = "dantown-privileged-access";
const WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, { count: number; resetAt: number }>();

function secret() {
  return process.env.DANTOWN_QUICK_ACCESS_COOKIE_SECRET || process.env.DANTOWN_QUICK_ACCESS_PIN_HASH || "disabled";
}

export function isQuickAccessEnabled() {
  return Boolean(process.env.DANTOWN_QUICK_ACCESS_PIN_HASH);
}

function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

function tokenFor(userId: string) {
  const payload = `${userId}.${Date.now() + 15 * 60 * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export async function hasQuickAccess(userId: string) {
  if (!isQuickAccessEnabled()) return true;
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  if (!value) return false;
  const [tokenUserId, expiry, signature] = value.split(".");
  if (!tokenUserId || !expiry || !signature || tokenUserId !== userId || Number(expiry) < Date.now()) return false;
  const expected = sign(`${tokenUserId}.${expiry}`);
  return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function quickAccessCookie(userId: string) {
  return { name: COOKIE_NAME, value: tokenFor(userId), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/admin", maxAge: 15 * 60 };
}

export async function verifyQuickAccessPin(userId: string, pin: string) {
  const now = Date.now();
  const current = failures.get(userId);
  if (current && current.resetAt > now && current.count >= MAX_FAILURES) return { ok: false as const, locked: true };
  if (!/^\d{4,12}$/.test(pin)) return registerFailure(userId);

  const encoded = process.env.DANTOWN_QUICK_ACCESS_PIN_HASH ?? "";
  const [algorithm, saltHex, digestHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !digestHex) return { ok: false as const, locked: false };
  const derived = await scrypt(pin, Buffer.from(saltHex, "hex"), 32) as Buffer;
  const expected = Buffer.from(digestHex, "hex");
  if (derived.length !== expected.length || !timingSafeEqual(derived, expected)) return registerFailure(userId);
  failures.delete(userId);
  return { ok: true as const, locked: false };
}

function registerFailure(userId: string) {
  const now = Date.now();
  const current = failures.get(userId);
  const next = !current || current.resetAt <= now ? { count: 1, resetAt: now + WINDOW_MS } : { count: current.count + 1, resetAt: current.resetAt };
  failures.set(userId, next);
  return { ok: false as const, locked: next.count >= MAX_FAILURES };
}

export function hashPinForSetup(pin: string) {
  const salt = randomBytes(16);
  return scrypt(pin, salt, 32).then((derived) => `scrypt$${salt.toString("hex")}$${(derived as Buffer).toString("hex")}`);
}
