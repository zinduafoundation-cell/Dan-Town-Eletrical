import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(request: Request) {
  const context = await requireAuthenticated();
  const payload = (await request.json()) as { id?: string; all?: boolean };
  const supabase = await createSupabaseServerClient();
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", context.userId).is("read_at", null);
  if (payload.id) query = query.eq("id", payload.id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: "Unable to update notifications." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
