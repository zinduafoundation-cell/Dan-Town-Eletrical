import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to update your notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ ok: true, persisted: false });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a notification to update." }, { status: 400 });
    }
    const parsed = z.union([
      z.object({ id: z.string().uuid() }).strict(),
      z.object({ all: z.literal(true) }).strict(),
    ]).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid notification action." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("customer_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if ("id" in parsed.data) query = query.eq("id", parsed.data.id);
    const { error } = await query;
    if (error) throw error;
    return NextResponse.json({ ok: true, persisted: true });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATION READ UPDATE ERROR", error);
    return NextResponse.json({ error: "Unable to update your notifications." }, { status: 500 });
  }
}
