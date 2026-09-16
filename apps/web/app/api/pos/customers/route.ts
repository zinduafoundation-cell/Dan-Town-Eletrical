import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";

const customerSchema = z.object({ name: z.string().trim().min(1).max(160), phone: z.string().trim().max(40).optional(), email: z.string().email().optional().or(z.literal("")) });

export async function GET(request: Request) {
  try {
    await requireAuthorizedPermission("customers.read");
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (query.length < 2) return NextResponse.json({ customers: [] });
    const { data, error } = await createSupabaseServiceClient().from("customers").select("id,name,phone,email").eq("status", "ACTIVE").or(`name.ilike.%${query}%,phone.ilike.%${query}%`).order("name").limit(8);
    if (error) throw error;
    return NextResponse.json({ customers: data ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to find customers." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("customers.create");
    const parsed = customerSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Enter a valid customer name, phone, or email." }, { status: 400 });
    const { data, error } = await createSupabaseServiceClient().from("customers").insert({ name: parsed.data.name, phone: parsed.data.phone || null, email: parsed.data.email || null, customer_type: "RETAIL", status: "ACTIVE" }).select("id,name,phone,email").single();
    if (error) throw error;
    return NextResponse.json({ customer: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create customer." }, { status: 500 });
  }
}
