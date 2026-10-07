import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { applySessionPersistence, AUTH_SESSION_PERSISTENCE_COOKIE, readSessionPersistence } from "./lib/auth/session-cookies";

const protectedPrefixes = ["/account", "/business", "/business-center", "/centre", "/staff", "/admin", "/pos"];

function shouldBypassRouteAuth() {
  if (process.env.NODE_ENV !== "development") return false;
  const override = process.env.NEXT_PUBLIC_ALLOW_AUTH_BYPASS;
  if (override === undefined) return false;
  return !["0", "false", "no", "off", "disabled"].includes(override.toLowerCase());
}

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });
  if (shouldBypassRouteAuth()) return response;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response;

  const sessionPersistence = readSessionPersistence(
    request.cookies.get(AUTH_SESSION_PERSISTENCE_COOKIE)?.value,
  );
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) =>
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, applySessionPersistence(options, sessionPersistence)),
        ),
    },
  });

  const isProtected = protectedPrefixes.some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  );
  if (!isProtected) return response;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  return response;
}

export const config = {
  matcher: ["/account/:path*", "/business/:path*", "/business-center/:path*", "/centre/:path*", "/staff/:path*", "/admin/:path*", "/pos/:path*"],
};
