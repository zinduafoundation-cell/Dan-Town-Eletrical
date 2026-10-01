import { NextResponse } from "next/server";
import { getAuthorizationContext, isBskAccount } from "@/lib/auth/server";
import { hasPermission, hasRole } from "@dantown/auth";
import { isQuickAccessEnabled, quickAccessCookie, verifyQuickAccessPin } from "@/lib/auth/quick-access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const context = await getAuthorizationContext();
  if (!context) return NextResponse.json({ ok: false, error: "Authentication required." }, { status: 401 });
  if (!(await isBskAccount())) return NextResponse.json({ ok: false, error: "Only the BSK account can open this privileged workspace." }, { status: 403 });
  if (!hasRole(context, "CEO") && !hasPermission(context, "users.read")) return NextResponse.json({ ok: false, error: "Privileged workspace permission required." }, { status: 403 });
  if (!isQuickAccessEnabled()) return NextResponse.json({ ok: false, error: "Quick access is not configured." }, { status: 503 });

  const body = await request.json().catch(() => null) as { pin?: unknown } | null;
  const result = await verifyQuickAccessPin(context.userId, typeof body?.pin === "string" ? body.pin : "");
  if (!result.ok) return NextResponse.json({ ok: false, locked: result.locked, error: result.locked ? "Too many attempts. Try again later." : "Invalid access PIN." }, { status: result.locked ? 429 : 401 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(quickAccessCookie(context.userId));
  return response;
}
