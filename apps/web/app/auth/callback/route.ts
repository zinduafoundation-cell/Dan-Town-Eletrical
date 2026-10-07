import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { safeNextPath } from "../../../lib/auth/post-login";
import {
  AUTH_SESSION_PERSISTENCE_COOKIE,
  AUTH_SESSION_PREFERENCE_COOKIE,
  persistenceMarkerCookieOptions,
  readSessionPersistence,
} from "../../../lib/auth/session-cookies";

function completeUrl(request: NextRequest, next: string | null) {
  const url = new URL("/auth/complete", request.url);
  const safeNext = safeNextPath(next);
  if (safeNext) url.searchParams.set("next", safeNext);
  return url;
}

function redirectWithPersistence(request: NextRequest, destination: URL, persistence?: "session" | "30-days") {
  const response = NextResponse.redirect(destination);
  response.cookies.set(AUTH_SESSION_PREFERENCE_COOKIE, "", {
    ...persistenceMarkerCookieOptions("session", request.nextUrl.protocol === "https:"),
    maxAge: 0,
  });
  if (persistence) {
    response.cookies.set(
      AUTH_SESSION_PERSISTENCE_COOKIE,
      persistence,
      persistenceMarkerCookieOptions(persistence, request.nextUrl.protocol === "https:"),
    );
  }
  return response;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");

  if (!code) return redirectWithPersistence(request, new URL("/callback-error", request.url));

  try {
    const persistence =
      readSessionPersistence(request.cookies.get(AUTH_SESSION_PREFERENCE_COOKIE)?.value) ?? "session";
    const supabase = await createSupabaseServerClient({
      sessionPersistence: persistence,
    });
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.user) {
      console.error("GOOGLE AUTH CALLBACK ERROR", error?.message ?? "No authenticated user returned");
      return redirectWithPersistence(
        request,
        new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url),
      );
    }
    return redirectWithPersistence(request, completeUrl(request, next), persistence);
  } catch (error) {
    console.error("GOOGLE AUTH CALLBACK EXCEPTION", error);
    return redirectWithPersistence(
      request,
      new URL(`/callback-error?next=${encodeURIComponent(next)}`, request.url),
    );
  }
}
