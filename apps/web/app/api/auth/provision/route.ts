import { NextResponse } from "next/server";
import { ensureCustomerProvisioning } from "@/lib/auth/provisioning";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    }

    await ensureCustomerProvisioning(user);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("AUTH PROVISIONING ERROR", {
      message: error instanceof Error ? error.message : "Unknown provisioning error",
    });
    return NextResponse.json({ error: "We could not finish setting up your account. Please try again." }, { status: 500 });
  }
}
