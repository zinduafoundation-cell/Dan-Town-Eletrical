import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { safeNextPath } from "../../../lib/auth/post-login";

function completeUrl(request: NextRequest, next: string | null) {
  const url = new URL("/auth/complete", request.url);
  const safeNext = safeNextPath(next);
  if (safeNext) url.searchParams.set("next", safeNext);
  return url;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) return NextResponse.redirect(new URL("/callback-error", request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("GOOGLE AUTH CALLBACK ERROR", error?.message ?? "No authenticated user returned");
      return NextResponse.redirect(new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url));
    }
    return NextResponse.redirect(completeUrl(request, next));
  } catch (error) {
    console.error("GOOGLE AUTH CALLBACK EXCEPTION", error);
    return NextResponse.redirect(new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url));
  }
}
