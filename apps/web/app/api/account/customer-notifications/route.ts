import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const querySchema = z.object({
  type: z.enum([
    "order", "payment", "delivery", "promotion", "product",
    "back_in_stock", "inquiry", "quotation", "account",
  ]).optional(),
  read: z.enum(["all", "unread", "read"]).default("all"),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
});

export async function GET(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to view your notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({ notifications: [], unreadCount: 0, persisted: false });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Choose valid notification filters." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data: preferences, error: preferencesError } = await supabase
      .from("customer_notification_preferences")
      .select("inbox_enabled")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (preferencesError) throw preferencesError;
    if (preferences && !preferences.inbox_enabled) {
      return NextResponse.json({ notifications: [], unreadCount: 0, persisted: true, inboxEnabled: false });
    }
    let query = supabase
      .from("customer_notifications")
      .select("id,type,title,body,href,related_type,related_id,read_at,created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(parsed.data.offset, parsed.data.offset + parsed.data.limit - 1);
    if (parsed.data.type) query = query.eq("type", parsed.data.type);
    if (parsed.data.read === "unread") query = query.is("read_at", null);
    if (parsed.data.read === "read") query = query.not("read_at", "is", null);

    const [{ data, error }, { count, error: countError }] = await Promise.all([
      query,
      supabase
        .from("customer_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .is("read_at", null),
    ]);
    if (error) throw error;
    if (countError) throw countError;
    return NextResponse.json({ notifications: data ?? [], unreadCount: count ?? 0, persisted: true, inboxEnabled: true });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATIONS GET ERROR", error);
    return NextResponse.json({ error: "Unable to load your notifications." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to update your notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ updated: 0, persisted: false });

    const schema = z.union([
      z.object({ all: z.literal(true) }).strict(),
      z.object({ id: z.string().uuid() }).strict(),
    ]);
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a notification to update." }, { status: 400 });
    }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid notification action." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("customer_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .is("read_at", null);
    if ("id" in parsed.data) query = query.eq("id", parsed.data.id);
    const { data, error } = await query.select("id");
    if (error) throw error;
    return NextResponse.json({ updated: data?.length ?? 0, persisted: true });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATIONS UPDATE ERROR", error);
    return NextResponse.json({ error: "Unable to update your notifications." }, { status: 500 });
  }
}
