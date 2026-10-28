import { NextResponse } from "next/server";
import { z } from "zod";
import { shouldBypassAuth } from "@/lib/auth/server";
import { getAuthenticatedUserId } from "@/lib/auth/server";
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

async function getCustomerAccessStatus(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
) {
  const userId = await getAuthenticatedUserId(supabase);
  if (!userId) return { userId: null, status: 401 as const };
  if (userId === "dev-bypass-user" || shouldBypassAuth()) return { userId, status: 200 as const };

  const { data: assignments, error: assignmentError } = await supabase
    .from("user_roles")
    .select("role_id")
    .eq("user_id", userId);
  if (assignmentError) throw assignmentError;
  const roleIds = (assignments ?? []).map((assignment) => assignment.role_id);
  if (!roleIds.length) return { userId: null, status: 403 as const };

  const { data: roles, error: roleError } = await supabase
    .from("roles")
    .select("code")
    .in("id", roleIds);
  if (roleError) throw roleError;
  return roles?.some((role) => role.code === "CUSTOMER")
    ? { userId, status: 200 as const }
    : { userId: null, status: 403 as const };
}

export async function GET(request: Request) {
  try {
    const supabase = await createSupabaseServerClient();
    const access = await getCustomerAccessStatus(supabase);
    if (access.status === 401) return NextResponse.json({ error: "Sign in to view your notifications." }, { status: 401 });
    if (access.status === 403) return NextResponse.json({ error: "Customer account access is required." }, { status: 403 });
    const userId = access.userId!;
    if (userId === "dev-bypass-user") {
      return NextResponse.json({ notifications: [], unreadCount: 0, persisted: false });
    }

    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!parsed.success) return NextResponse.json({ error: "Choose valid notification filters." }, { status: 400 });

    const { data: preferences, error: preferencesError } = await supabase
      .from("customer_notification_preferences")
      .select("inbox_enabled")
      .eq("user_id", userId)
      .maybeSingle();
    if (preferencesError) throw preferencesError;
    if (preferences && !preferences.inbox_enabled) {
      return NextResponse.json({ notifications: [], unreadCount: 0, persisted: true, inboxEnabled: false });
    }
    let query = supabase
      .from("customer_notifications")
      .select("id,type,title,body,href,related_type,related_id,read_at,created_at")
      .eq("user_id", userId)
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
        .eq("user_id", userId)
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
    const supabase = await createSupabaseServerClient();
    const access = await getCustomerAccessStatus(supabase);
    if (access.status === 401) return NextResponse.json({ error: "Sign in to update your notifications." }, { status: 401 });
    if (access.status === 403) return NextResponse.json({ error: "Customer account access is required." }, { status: 403 });
    const userId = access.userId!;
    if (userId === "dev-bypass-user") return NextResponse.json({ updated: 0, persisted: false });

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

    let query = supabase
      .from("customer_notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", userId)
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
