import { NextResponse } from "next/server";
import { getAuthorizationContext, isBskAccount } from "../../../../lib/auth/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const context = await getAuthorizationContext();
  const canAccessWorkspace = Boolean(context && ((await isBskAccount()) || context.userId === "dev-bypass-user"));
  return NextResponse.json({ userId: context?.userId ?? null, canAccessWorkspace });
}