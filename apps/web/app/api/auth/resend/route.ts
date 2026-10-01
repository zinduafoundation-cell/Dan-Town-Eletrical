import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getAppUrl, getPublicEnv } from "../../../../lib/env";

const resendSchema = z.object({
  email: z.string().email().max(254),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const parsed = resendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
  }

  const { email } = parsed.data;

  try {
    console.log("AUTH RESEND STARTED", { email });
    const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY } = getPublicEnv();

    const publicClient = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { error } = await publicClient.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${getAppUrl(request)}/auth/confirm`,
      },
    });

    if (error) {
      console.error("AUTH RESEND ERROR", { error: error.message });
      // Don't expose the actual error to prevent user enumeration
      return NextResponse.json({ message: "If this email is registered, a verification link has been sent." }, { status: 200 });
    }

    console.log("AUTH RESEND SUCCESS", { email });
    return NextResponse.json({ message: "Verification email sent. Please check your inbox." }, { status: 200 });
  } catch (err) {
    console.error("AUTH RESEND EXCEPTION", err);
    return NextResponse.json({ message: "If this email is registered, a verification link has been sent." }, { status: 200 });
  }
}
