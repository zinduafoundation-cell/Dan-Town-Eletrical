import { NextResponse } from "next/server";

import { hasPermission } from "@dantown/auth";
import { getAuthorizationContext, isBskEmailAddress } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function requireAccessManager() {
  const context = await getAuthorizationContext();
  if (!context) {
    return { response: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!hasPermission(context, "users.manage")) {
    return { response: NextResponse.json({ error: "You cannot manage Business Centre access." }, { status: 403 }) };
  }
  return { context };
}

export async function GET() {
  const access = await requireAccessManager();
  if (access.response) return access.response;

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("business_center_access")
      .select("user_id, email, approved_at")
      .order("approved_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ accounts: data ?? [] });
  } catch (error) {
    console.error("Business Centre access list failed", error);
    return NextResponse.json({ error: "Unable to load approved accounts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await requireAccessManager();
  if (access.response) return access.response;

  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid account email is required." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid account email." }, { status: 400 });
  }
  if (isBskEmailAddress(email)) {
    return NextResponse.json({ error: "The owner account already has permanent access." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    let page = 1;
    let userId: string | null = null;
    while (!userId) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      const authUsers: Array<{ id: string; email?: string }> = data.users;
      const user = authUsers.find((candidate) => candidate.email?.toLowerCase() === email);
      if (user) {
        userId = user.id;
        break;
      }
      if (data.users.length < 1000) break;
      page += 1;
    }

    if (!userId) {
      return NextResponse.json({ error: "No registered account was found for that email." }, { status: 404 });
    }

    const { error } = await supabase.from("business_center_access").upsert(
      { user_id: userId, email, approved_by: access.context.userId },
      { onConflict: "user_id" }
    );
    if (error) throw error;

    return NextResponse.json({ account: { user_id: userId, email } }, { status: 201 });
  } catch (error) {
    console.error("Business Centre account approval failed", error);
    return NextResponse.json({ error: "Unable to approve this account." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const access = await requireAccessManager();
  if (access.response) return access.response;

  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "A valid account ID is required." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    return NextResponse.json({ error: "A valid account ID is required." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("business_center_access")
      .delete()
      .eq("user_id", userId)
      .select("user_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Approved account not found." }, { status: 404 });
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("Business Centre account revocation failed", error);
    return NextResponse.json({ error: "Unable to remove this account's access." }, { status: 500 });
  }
}
