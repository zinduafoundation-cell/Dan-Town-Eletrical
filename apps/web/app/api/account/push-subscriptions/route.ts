import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import {
  encryptCustomerPushSubscription,
  isCustomerPushConfigured,
  getCustomerPushPublicKey,
} from "@/lib/customer-notifications";
import { validatePushSubscription } from "@/lib/customer-notification-policy";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const registerSchema = z.object({
  subscription: z.unknown(),
  deviceLabel: z.string().trim().min(1).max(80).default("This device"),
});

export async function GET() {
  const context = await getAuthorizationContext();
  if (!context) return NextResponse.json({ error: "Sign in to manage browser notifications." }, { status: 401 });
  if (context.userId === "dev-bypass-user") {
    return NextResponse.json({ devices: [], publicKey: getCustomerPushPublicKey(), persisted: false });
  }
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("customer_push_subscriptions")
    .select("id,device_label,active,created_at,last_success_at")
    .eq("user_id", context.userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("CUSTOMER PUSH DEVICES GET ERROR", error);
    return NextResponse.json({ error: "Unable to load browser notification devices." }, { status: 500 });
  }
  return NextResponse.json({ devices: data ?? [], publicKey: getCustomerPushPublicKey(), persisted: true });
}

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to enable browser notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({ error: "Browser notifications are not persisted in development bypass mode." }, { status: 409 });
    }
    if (!isCustomerPushConfigured()) {
      return NextResponse.json({ error: "Browser push is not configured for this website." }, { status: 503 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a valid browser subscription." }, { status: 400 });
    }
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid browser subscription." }, { status: 400 });

    const subscription = validatePushSubscription(parsed.data.subscription);
    const encrypted = encryptCustomerPushSubscription(subscription);
    const supabase = createSupabaseServiceClient();
    const { data: existing, error: existingError } = await supabase
      .from("customer_push_subscriptions")
      .select("id,user_id")
      .eq("endpoint_hash", encrypted.endpoint_hash)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing && existing.user_id !== context.userId) {
      return NextResponse.json({ error: "This browser subscription is already registered to another account." }, { status: 409 });
    }
    if (!existing) {
      const { count, error: countError } = await supabase
        .from("customer_push_subscriptions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("active", true);
      if (countError) throw countError;
      if ((count ?? 0) >= 10) {
        return NextResponse.json({ error: "Remove a device before adding another browser subscription." }, { status: 429 });
      }
    }

    const subscriptionData = {
        user_id: context.userId,
        ...encrypted,
        device_label: parsed.data.deviceLabel,
        active: true,
        failure_count: 0,
        revoked_at: null,
      };
    const saveResult = existing
      ? await supabase
          .from("customer_push_subscriptions")
          .update(subscriptionData)
          .eq("id", existing.id)
          .eq("user_id", context.userId)
      : await supabase
          .from("customer_push_subscriptions")
          .insert(subscriptionData);
    const saveError = saveResult.error;
    if (saveError?.code === "23505") {
      return NextResponse.json({ error: "This browser subscription is already registered. Refresh your devices and try again." }, { status: 409 });
    }
    if (saveError) throw saveError;

    const { error: preferenceError } = await supabase
      .from("customer_notification_preferences")
      .upsert({ user_id: context.userId, push_enabled: true }, { onConflict: "user_id" });
    if (preferenceError) throw preferenceError;
    return NextResponse.json({ registered: true });
  } catch (error) {
    console.error("CUSTOMER PUSH SUBSCRIPTION SAVE ERROR", error);
    return NextResponse.json({
      error: error instanceof Error && /browser push|subscription/i.test(error.message)
        ? error.message
        : "Unable to register this browser for notifications.",
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to manage browser notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ removed: true, persisted: false });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a valid device to remove." }, { status: 400 });
    }
    const parsed = z.object({ subscriptionId: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid device to remove." }, { status: 400 });
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("customer_push_subscriptions")
      .update({ active: false, revoked_at: new Date().toISOString() })
      .eq("id", parsed.data.subscriptionId)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Browser subscription not found." }, { status: 404 });
    const { count, error: remainingError } = await supabase
      .from("customer_push_subscriptions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("active", true);
    if (remainingError) throw remainingError;
    if (!count) {
      const { error: preferenceError } = await supabase
        .from("customer_notification_preferences")
        .upsert({ user_id: context.userId, push_enabled: false, push_marketing: false }, { onConflict: "user_id" });
      if (preferenceError) throw preferenceError;
    }
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("CUSTOMER PUSH SUBSCRIPTION REMOVE ERROR", error);
    return NextResponse.json({ error: "Unable to remove this browser subscription." }, { status: 500 });
  }
}
