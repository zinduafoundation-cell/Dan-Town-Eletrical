import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";
import { AUTH_SESSION_PERSISTENCE_COOKIE } from "../../../../lib/auth/session-cookies";

export async function POST() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error("AUTH SIGN-OUT ERROR", error);
    return NextResponse.json({ error: "Could not sign out. Please try again." }, { status: 500 });
  }

  const cookieStore = await cookies();
  cookieStore.set(AUTH_SESSION_PERSISTENCE_COOKIE, "", { path: "/", maxAge: 0 });
  // End the secondary unlock and biometric step-up too, so the next person on this device starts locked.
  cookieStore.set("dantown-privileged-access", "", { path: "/admin", maxAge: 0 });
  cookieStore.set("dantown-biometric-stepup", "", { path: "/", maxAge: 0 });
  cookieStore.set("dantown-passkey-challenge", "", { path: "/api/auth/passkey", maxAge: 0 });
  return NextResponse.json({ success: true });
}
