import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { getAppUrl, publicEnv } from "../../../../lib/env";
import { ensureCustomerProvisioning } from "../../../../lib/auth/provisioning";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(128),
  termsAccepted: z.literal(true),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Please check your registration details." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    console.error("AUTH SIGNUP VALIDATION ERROR", parsed.error);
    return NextResponse.json({ error: "Please check your registration details." }, { status: 400 });
  }

  const { fullName, email, phone, password } = parsed.data;

  try {
    console.log("AUTH SIGNUP STARTED", { email });

    // Step 1: Verify environment variables
    if (!publicEnv.NEXT_PUBLIC_SUPABASE_URL || !publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      console.error("AUTH SIGNUP ENV ERROR", "Missing Supabase environment variables");
      return NextResponse.json({ error: "Server configuration error. Please contact support." }, { status: 500 });
    }

    // Step 2: Use regular Supabase client to sign up (triggers email)
    const publicClient = createClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL, publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error: signupError } = await publicClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getAppUrl(request)}/auth/confirm`,
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    if (signupError) {
      const errorMsg = signupError.message || "Unknown error";
      const errorStatus = signupError.status || "unknown";
      const errorCode = "code" in signupError && typeof signupError.code === "string" ? signupError.code : "unknown";
      console.error(`AUTH SIGNUP ERROR: ${errorMsg} (status: ${errorStatus}, code: ${errorCode})`);
      
      // Return more specific error messages
      if (errorCode === "over_email_send_rate_limit" || errorMsg.toLowerCase().includes("rate limit")) {
        return NextResponse.json({ 
          error: "Too many signup attempts. Please wait 30 minutes and try again. Or configure a custom SMTP provider in Supabase for production." 
        }, { status: 429 });
      }
      if (errorMsg.toLowerCase().includes("already registered")) {
        return NextResponse.json({ error: "This email is already registered. Please sign in instead." }, { status: 400 });
      }
      if (errorMsg.toLowerCase().includes("invalid") || errorMsg.toLowerCase().includes("email")) {
        return NextResponse.json({ error: "Please provide a valid email address." }, { status: 400 });
      }
      if (errorMsg.toLowerCase().includes("password")) {
        return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      }
      
      return NextResponse.json({ error: "Account creation failed. Please try again." }, { status: 400 });
    }

    if (!data.user) {
      console.error("AUTH SIGNUP NO USER", { data });
      return NextResponse.json({ error: "Account creation failed. Please try again." }, { status: 400 });
    }

    console.log("AUTH SIGNUP SUCCESS", { userId: data.user.id, email });

    // Step 3: Set up the customer record and role through one idempotent path.
    await ensureCustomerProvisioning(data.user);

    console.log("AUTH SIGNUP COMPLETE", { userId: data.user.id, email });

    return NextResponse.json({ message: "Account created. Check your email to verify your account.", email }, { status: 201 });
  } catch (err) {
    console.error("AUTH SIGNUP EXCEPTION", { 
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined
    });
    return NextResponse.json({ error: "An unexpected error occurred. Please try again." }, { status: 500 });
  }
}
