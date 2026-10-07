import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

import {
  AUTH_SESSION_PERSISTENCE_COOKIE,
  persistenceMarkerCookieOptions,
  type SessionPersistence,
} from "@/lib/auth/session-cookies";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  rememberMe: z.boolean(),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please enter your email and password." }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please enter your email and password." }, { status: 400 });
  }

  try {
    const sessionPersistence: SessionPersistence = parsed.data.rememberMe ? "30-days" : "session";
    const supabase = await createSupabaseServerClient({ sessionPersistence });
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      return NextResponse.json({ error: "The email or password was not recognised." }, { status: 401 });
    }

    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_SESSION_PERSISTENCE_COOKIE,
      sessionPersistence,
      persistenceMarkerCookieOptions(sessionPersistence, new URL(request.url).protocol === "https:"),
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("EMAIL SIGN-IN ERROR", error);
    return NextResponse.json(
      { error: "We could not complete sign-in. Check your connection and try again." },
      { status: 500 },
    );
  }
}
