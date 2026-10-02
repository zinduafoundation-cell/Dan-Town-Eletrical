import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { safeNextPath } from "../../../lib/auth/post-login";

function completeUrl(request: NextRequest, next: string | null) {
  const url = new URL("/auth/complete", request.url);
  const safeNext = safeNextPath(next);
  if (safeNext) url.searchParams.set("next", safeNext);
  return url;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next");

  if (!token_hash || !type) return NextResponse.redirect(new URL("/callback-error", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (error || !data.user) {
      console.error("AUTH CALLBACK ERROR", { type, error: error?.message ?? "No authenticated user returned" });
      return NextResponse.redirect(new URL("/callback-error", request.url));
    }

    return NextResponse.redirect(completeUrl(request, next));
  } catch (error) {
    console.error("AUTH CALLBACK EXCEPTION", error);
    return NextResponse.redirect(new URL("/callback-error", request.url));
  }
}
