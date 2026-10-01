import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { ensureCustomerProvisioning } from "../../../lib/auth/provisioning";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  if (!token_hash || !type) return NextResponse.redirect(new URL("/callback-error", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error || !data.user) {
      console.error("AUTH CALLBACK ERROR", { type, error: error?.message ?? "No authenticated user returned" });
      return NextResponse.redirect(new URL("/callback-error", request.url));
    }

    await ensureCustomerProvisioning(data.user);
    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    console.error("AUTH CALLBACK EXCEPTION", error);
    return NextResponse.redirect(new URL("/callback-error", request.url));
  }
}
