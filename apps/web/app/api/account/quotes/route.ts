import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const requestSchema = z.object({
  requirements: z.string().trim().min(10).max(3000),
  company: z.string().trim().max(160).optional().default(""),
});

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to request a quotation." }, { status: 401 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ error: "Quote requests are not persisted in development bypass mode." }, { status: 409 });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Please complete the quote request." }, { status: 400 });
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please provide project requirements." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (customerError) throw customerError;
    if (!customer) return NextResponse.json({ error: "Complete your customer profile before requesting a quote." }, { status: 409 });

    const quoteNumber = `QR-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
    const notes = [
      "Customer quote request",
      parsed.data.company ? `Company/project: ${parsed.data.company}` : null,
      `Requirements: ${parsed.data.requirements}`,
    ].filter(Boolean).join("\n");
    const { error: insertError } = await supabase.from("quotations").insert({
      quote_number: quoteNumber,
      customer_id: customer.id,
      status: "DRAFT",
      subtotal: 0,
      discount: 0,
      vat: 0,
      delivery_fee: 0,
      total: 0,
      valid_until: null,
      terms: null,
      notes,
      created_by: context.userId,
    });
    if (insertError) throw insertError;
    return NextResponse.json({ quoteNumber }, { status: 201 });
  } catch (error) {
    console.error("CUSTOMER QUOTE REQUEST ERROR", error);
    return NextResponse.json({ error: "Unable to send your quote request." }, { status: 500 });
  }
}
