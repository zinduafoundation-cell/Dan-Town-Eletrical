import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

function safeNextPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));

  if (!code) return NextResponse.redirect(new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url));

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      console.error("GOOGLE AUTH CALLBACK ERROR", error.message);
      return NextResponse.redirect(new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url));
    }
    return NextResponse.redirect(new URL(next, request.url));
  } catch (error) {
    console.error("GOOGLE AUTH CALLBACK EXCEPTION", error);
    return NextResponse.redirect(new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url));
  }
}
