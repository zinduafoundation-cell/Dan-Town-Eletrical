import { NextRequest, NextResponse } from "next/server";

import { getAuthorizationContext } from "@/lib/auth/server";
import { resolvePostLoginPath } from "@/lib/auth/post-login";
import { ensureCustomerProvisioning } from "@/lib/auth/provisioning";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);
  const requestedNext = request.nextUrl.searchParams.get("next");
  if (requestedNext?.startsWith("/") && !requestedNext.startsWith("//")) {
    loginUrl.searchParams.set("next", requestedNext);
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return NextResponse.redirect(loginUrl);

    // Covers legacy accounts and provider logins that were created before the
    // customer record and CUSTOMER role existed.
    await ensureCustomerProvisioning(user);
    const context = await getAuthorizationContext();
    return NextResponse.redirect(new URL(resolvePostLoginPath(context, requestedNext), request.url));
  } catch (error) {
    console.error("POST-LOGIN SETUP ERROR", error);
    return NextResponse.redirect(new URL("/callback-error", request.url));
  }
}
