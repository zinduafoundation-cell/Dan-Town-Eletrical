import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/auth/server";
import { listPasskeys, passkeyDb, recordSecurityEvent, requireBiometricStepUp } from "@/lib/auth/passkeys";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context || context.userId === "dev-bypass-user") return NextResponse.json({ devices: [] });
  const rows = await listPasskeys(context.userId);
  return NextResponse.json({ devices: rows.map((row) => ({ id: row.id, label: row.device_label, createdAt: row.created_at, lastUsedAt: row.last_used_at })) });
}

export async function DELETE(request: Request) {
  const context = await getAuthorizationContext();
  if (!context) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Choose a device to remove." }, { status: 400 });
  // Removing a device is sensitive: if you have one linked, prove it's you first.
  const blocked = await requireBiometricStepUp(context.userId);
  if (blocked) return blocked;
  const { error } = await passkeyDb().from("staff_passkeys").delete().eq("id", id).eq("user_id", context.userId);
  if (error) return NextResponse.json({ error: "Could not remove this device." }, { status: 500 });
  await recordSecurityEvent(context.userId, "BIOMETRIC_DEVICE_REMOVED", { device_id: id });
  return NextResponse.json({ ok: true });
}
