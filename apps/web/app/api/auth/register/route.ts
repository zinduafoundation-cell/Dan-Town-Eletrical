import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseAdminClient } from "../../../../lib/supabase/admin";
import { publicEnv } from "../../../../lib/env";

const registrationSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().email().max(254),
  phone: z.string().trim().min(7).max(30),
  password: z.string().min(8).max(128),
  termsAccepted: z.literal(true),
});

function isMissingSchemaError(error: { message?: string } | null | undefined) {
  const message = error?.message ?? "";
  return /Could not find the table|schema cache|relation .* does not exist|does not exist in the schema/i.test(message);
}

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json());
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
        emailRedirectTo: new URL("/auth/confirm", request.url).toString(),
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
      
      return NextResponse.json({ error: `Account creation failed: ${errorMsg}` }, { status: 400 });
    }

    if (!data.user) {
      console.error("AUTH SIGNUP NO USER", { data });
      return NextResponse.json({ error: "Account creation failed. Please try again." }, { status: 400 });
    }

    console.log("AUTH SIGNUP SUCCESS", { userId: data.user.id, email });

    // Step 3: Create customer record with the new user ID
    const adminClient = createSupabaseAdminClient();

    const { data: customer, error: customerError } = await adminClient
      .from("customers")
      .insert({
        user_id: data.user.id,
        name: fullName,
        email,
        phone,
        customer_type: "RETAIL",
        status: "ACTIVE",
      })
      .select("id")
      .single();

    if (customerError) {
      console.error("CUSTOMER CREATE ERROR", { 
        error: customerError.message,
        code: customerError.code,
        details: customerError.details
      });
      const message = isMissingSchemaError(customerError) ? "The connected Supabase project is missing required database tables. Please sync the migrations before creating an account." : "We could not finish creating your account.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!customer) {
      console.error("CUSTOMER NOT RETURNED", { customerError });
      return NextResponse.json({ error: "We could not finish creating your account." }, { status: 500 });
    }

    console.log("CUSTOMER CREATED", { customerId: customer.id });

    // Step 4: Get or create CUSTOMER role
    let customerRole = null as { id: string } | null;

    const { data: existingCustomerRole, error: customerRoleLookupError } = await adminClient
      .from("roles")
      .select("id")
      .eq("code", "CUSTOMER")
      .maybeSingle();

    if (customerRoleLookupError) {
      console.error("CUSTOMER ROLE LOOKUP ERROR", { 
        error: customerRoleLookupError.message,
        code: customerRoleLookupError.code
      });
      const message = isMissingSchemaError(customerRoleLookupError) ? "The connected Supabase project is missing required database tables. Please sync the migrations before creating an account." : "We could not finish creating your account.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

    if (!existingCustomerRole) {
      console.log("CUSTOMER ROLE NOT FOUND, CREATING");
      const { data: createdRole, error: createdRoleError } = await adminClient
        .from("roles")
        .insert({ code: "CUSTOMER", name: "Customer", description: "Customer account access" })
        .select("id")
        .single();

      if (createdRoleError) {
        console.error("CUSTOMER ROLE CREATE ERROR", { 
          error: createdRoleError.message,
          code: createdRoleError.code
        });
        const message = isMissingSchemaError(createdRoleError) ? "The connected Supabase project is missing required database tables. Please sync the migrations before creating an account." : "We could not finish creating your account.";
        return NextResponse.json({ error: message }, { status: 500 });
      }

      if (!createdRole) {
        console.error("CUSTOMER ROLE CREATE NO RESULT");
        return NextResponse.json({ error: "We could not finish creating your account." }, { status: 500 });
      }

      customerRole = createdRole;
    } else {
      customerRole = existingCustomerRole;
    }

    // Step 5: Assign CUSTOMER role to the user
    const { error: assignmentError } = await adminClient.from("user_roles").insert({
      user_id: data.user.id,
      role_id: customerRole.id,
    });

    if (assignmentError) {
      console.error("ROLE ASSIGNMENT ERROR", { 
        error: assignmentError.message,
        code: assignmentError.code
      });
      const message = isMissingSchemaError(assignmentError) ? "The connected Supabase project is missing required database tables. Please sync the migrations before creating an account." : "We could not finish creating your account.";
      return NextResponse.json({ error: message }, { status: 500 });
    }

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
