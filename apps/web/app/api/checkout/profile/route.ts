import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

const ProfileSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().email().nullable().optional(),
  county: z.string().trim().min(1),
  town: z.string().trim().min(1),
  address: z.string().trim().min(1)
});

async function getUser() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ authenticated: false });

  const supabase = createSupabaseServiceClient();
  const [{ data: profile }, { data: customer }] = await Promise.all([
    supabase.from("profiles").select("full_name,phone").eq("id", user.id).maybeSingle(),
    supabase.from("customers").select("id,name,email,phone").eq("user_id", user.id).maybeSingle()
  ]);

  const { data: address } = customer
    ? await supabase
        .from("customer_addresses")
        .select("county,city,address_line_1,recipient_name,phone")
        .eq("customer_id", customer.id)
        .eq("is_default", true)
        .maybeSingle()
    : { data: null };

  return NextResponse.json({
    authenticated: true,
    fullName: profile?.full_name || customer?.name || user.user_metadata?.full_name || "",
    phone: profile?.phone || customer?.phone || user.phone || "",
    email: customer?.email || user.email || "",
    county: address?.county || "Trans Nzoia",
    town: address?.city || "Kitale",
    address: address?.address_line_1 || ""
  });
}

export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your checkout details." }, { status: 401 });

  try {
    const input = ProfileSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .upsert(
        {
          user_id: user.id,
          name: input.fullName,
          email: input.email || user.email || null,
          phone: input.phone,
          status: "ACTIVE"
        },
        { onConflict: "user_id" }
      )
      .select("id")
      .single();

    if (customerError || !customer) throw customerError ?? new Error("Unable to save customer details.");

    const { data: existingAddress } = await supabase
      .from("customer_addresses")
      .select("id")
      .eq("customer_id", customer.id)
      .eq("is_default", true)
      .maybeSingle();
    const addressValues = {
      customer_id: customer.id,
      label: "Primary",
      recipient_name: input.fullName,
      phone: input.phone,
      address_line_1: input.address,
      city: input.town,
      county: input.county,
      is_default: true
    };
    const [{ error: profileError }, { error: addressError }] = await Promise.all([
      supabase.from("profiles").upsert({ id: user.id, full_name: input.fullName, phone: input.phone }),
      existingAddress
        ? supabase.from("customer_addresses").update(addressValues).eq("id", existingAddress.id)
        : supabase.from("customer_addresses").insert(addressValues)
    ]);

    if (profileError || addressError) {
      throw profileError ?? addressError ?? new Error("Unable to save checkout address.");
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "Please complete your checkout details." }, { status: 400 });
    }
    console.error("Checkout profile save failed:", error);
    return NextResponse.json({ error: "Unable to save your checkout details." }, { status: 500 });
  }
}
