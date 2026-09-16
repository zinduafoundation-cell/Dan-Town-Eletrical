import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticated } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const preferenceSchema = z.object({ email: z.boolean(), sms: z.boolean(), whatsapp: z.boolean(), push: z.boolean() });

export async function GET() {
  try {
    const context = await requireAuthenticated();
    if (context.userId === "dev-bypass-user") return NextResponse.json({ preferences: { email: true, sms: false, whatsapp: false, push: false }, persisted: false });
    const { data, error } = await (await createSupabaseServerClient()).from("notification_preferences").select("email,sms,whatsapp,push").eq("user_id", context.userId).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ preferences: data ?? { email: true, sms: false, whatsapp: false, push: false }, persisted: true });
  } catch (error) {
    console.error("NOTIFICATION PREFERENCES GET ERROR", error);
    return NextResponse.json({ error: "Unable to load notification preferences." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const context = await requireAuthenticated();
    const parsed = preferenceSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Choose valid notification preferences." }, { status: 400 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ preferences: parsed.data, persisted: false });
    const { data, error } = await (await createSupabaseServerClient()).from("notification_preferences").upsert({ user_id: context.userId, ...parsed.data }, { onConflict: "user_id" }).select("email,sms,whatsapp,push").single();
    if (error) throw error;
    return NextResponse.json({ preferences: data, persisted: true });
  } catch (error) {
    console.error("NOTIFICATION PREFERENCES SAVE ERROR", error);
    return NextResponse.json({ error: "Unable to save notification preferences." }, { status: 500 });
  }
}