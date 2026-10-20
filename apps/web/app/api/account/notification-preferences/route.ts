import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { isCustomerPushConfigured } from "@/lib/customer-notifications";
import { defaultCustomerNotificationPreferences } from "@/lib/customer-notification-types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const preferenceSchema = z.object({
  inbox_enabled: z.boolean(),
  transactional_email: z.boolean(),
  marketing_email: z.boolean(),
  push_enabled: z.boolean(),
  push_marketing: z.boolean(),
  promotions_opt_in: z.boolean(),
  products_opt_in: z.boolean(),
  back_in_stock_enabled: z.boolean(),
  quiet_start: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  quiet_end: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable(),
  timezone: z.string().trim().min(1).max(64),
}).refine((value) => Boolean(value.quiet_start) === Boolean(value.quiet_end), {
  message: "Set both quiet-hours times, or leave both empty.",
  path: ["quiet_end"],
}).refine((value) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: value.timezone });
    return true;
  } catch {
    return false;
  }
}, {
  message: "Choose a supported time zone.",
  path: ["timezone"],
});

export async function GET() {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to manage your preferences." }, { status: 401 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({
        preferences: defaultCustomerNotificationPreferences,
        pushAvailable: isCustomerPushConfigured(),
        emailAvailable: Boolean(process.env.RESEND_API_KEY && process.env.CUSTOMER_EMAIL_FROM),
        persisted: false,
      });
    }
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customer_notification_preferences")
      .select("inbox_enabled,transactional_email,marketing_email,push_enabled,push_marketing,promotions_opt_in,products_opt_in,back_in_stock_enabled,quiet_start,quiet_end,timezone,promotions_consent_at,promotions_consent_source,products_consent_at,products_consent_source")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({
      preferences: data ?? defaultCustomerNotificationPreferences,
      pushAvailable: isCustomerPushConfigured(),
      emailAvailable: Boolean(process.env.RESEND_API_KEY && process.env.CUSTOMER_EMAIL_FROM),
      persisted: true,
    });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATION PREFERENCES GET ERROR", error);
    return NextResponse.json({ error: "Unable to load your notification preferences." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to save your preferences." }, { status: 401 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose valid notification preferences." }, { status: 400 });
    }
    const parsed = preferenceSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose valid notification preferences." }, { status: 400 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({ preferences: parsed.data, persisted: false });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customer_notification_preferences")
      .upsert({ user_id: context.userId, ...parsed.data }, { onConflict: "user_id" })
      .select("inbox_enabled,transactional_email,marketing_email,push_enabled,push_marketing,promotions_opt_in,products_opt_in,back_in_stock_enabled,quiet_start,quiet_end,timezone,promotions_consent_at,promotions_consent_source,products_consent_at,products_consent_source")
      .single();
    if (error) throw error;
    return NextResponse.json({ preferences: data, persisted: true });
  } catch (error) {
    console.error("CUSTOMER NOTIFICATION PREFERENCES SAVE ERROR", error);
    return NextResponse.json({ error: "Unable to save your notification preferences." }, { status: 500 });
  }
}
