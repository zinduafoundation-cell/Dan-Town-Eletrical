import { NextResponse } from "next/server";
import { getAuthorizationContext } from "@/lib/auth/server";
import { isCustomerPushConfigured, sendCustomerPushTest } from "@/lib/customer-notifications";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to test browser notifications." }, { status: 401 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({ error: "Browser notifications are not persisted in development bypass mode." }, { status: 409 });
    }
    if (!isCustomerPushConfigured()) {
      return NextResponse.json({ error: "Browser push delivery is not configured." }, { status: 503 });
    }
    const supabase = createSupabaseServiceClient();
    const { data: claimed, error } = await supabase.rpc("claim_customer_push_test_slot", {
      target_user_id: context.userId,
    });
    if (error) throw error;
    if (!claimed) {
      return NextResponse.json({ error: "Enable push on a device and wait a minute between test notifications." }, { status: 429 });
    }

    const result = await sendCustomerPushTest(context.userId);
    return NextResponse.json({ result });
  } catch (error) {
    console.error("CUSTOMER PUSH TEST ERROR", error);
    const message = error instanceof Error && /not configured|Enable browser push/i.test(error.message)
      ? error.message
      : "Unable to send a test notification. Check that this browser subscription is still active.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
