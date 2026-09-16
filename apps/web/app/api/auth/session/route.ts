import { NextResponse } from "next/server";
import { getAuthorizationContext } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthorizationContext();
  const canAccessWorkspace = Boolean(context && (context.userId === "dev-bypass-user" || ["orders.read", "orders.create", "inventory.read", "users.read", "reports.read"].some((permission) => context.permissions.includes(permission as never))));
  return NextResponse.json({ userId: context?.userId ?? null, canAccessWorkspace });
}