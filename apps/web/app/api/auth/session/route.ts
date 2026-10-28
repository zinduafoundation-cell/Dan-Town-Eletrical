import { NextResponse } from "next/server";
import { isBskEmailAddress, shouldBypassAuth } from "../../../../lib/auth/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  if (shouldBypassAuth()) {
    return NextResponse.json({ userId: "dev-bypass-user", canAccessWorkspace: true, state: "authenticated" });
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      if (error.name === "AuthSessionMissingError") {
        return NextResponse.json({ userId: null, canAccessWorkspace: false, state: "anonymous" });
      }
      if (error.status === 400 || error.status === 401) {
        return NextResponse.json(
          { userId: null, canAccessWorkspace: false, state: "reauthentication_required" },
          { status: 401 },
        );
      }
      console.error("AUTH SESSION LOOKUP FAILED", { status: error.status, code: error.code ?? "unknown" });
      return NextResponse.json({ error: "Unable to restore the current session.", state: "unavailable" }, { status: 503 });
    }

    return NextResponse.json({
      userId: user?.id ?? null,
      canAccessWorkspace: isBskEmailAddress(user?.email),
      state: user ? "authenticated" : "anonymous",
    });
  } catch (error) {
    console.error("AUTH SESSION LOOKUP FAILED", {
      cause: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "Unable to restore the current session.", state: "unavailable" }, { status: 503 });
  }
}