import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  AUTH_SESSION_PREFERENCE_COOKIE,
  persistenceMarkerCookieOptions,
  type SessionPersistence,
} from "@/lib/auth/session-cookies";

const preferenceSchema = z.object({ rememberMe: z.boolean() });

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid sign-in preference." }, { status: 400 });
  }

  const parsed = preferenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sign-in preference." }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });
  const persistence: SessionPersistence = parsed.data.rememberMe ? "30-days" : "session";
  response.cookies.set(AUTH_SESSION_PREFERENCE_COOKIE, persistence, {
    ...persistenceMarkerCookieOptions(persistence, request.nextUrl.protocol === "https:"),
    maxAge: 5 * 60,
  });
  return response;
}
