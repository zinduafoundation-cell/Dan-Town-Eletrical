import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthorizationContext } from "@/lib/auth/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullable().optional(),
});

export async function POST(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to request a stock alert." }, { status: 401 });
    if (context.userId === "dev-bypass-user") {
      return NextResponse.json({ error: "Stock alerts are not persisted in development bypass mode." }, { status: 409 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a product for the stock alert." }, { status: 400 });
    }
    const parsed = subscriptionSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid product for the stock alert." }, { status: 400 });

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customer_back_in_stock_requests")
      .insert({
        user_id: context.userId,
        product_id: parsed.data.productId,
        variant_id: parsed.data.variantId ?? null,
      })
      .select("id")
      .single();
    if (error?.code === "23505") return NextResponse.json({ requested: true, alreadyRequested: true });
    if (error) throw error;
    return NextResponse.json({ requested: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error("CUSTOMER BACK-IN-STOCK REQUEST ERROR", error);
    return NextResponse.json({ error: "Unable to create this stock alert." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const context = await getAuthorizationContext();
    if (!context) return NextResponse.json({ error: "Sign in to manage stock alerts." }, { status: 401 });
    if (context.userId === "dev-bypass-user") return NextResponse.json({ removed: true, persisted: false });
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Choose a valid stock alert." }, { status: 400 });
    }
    const parsed = z.object({ id: z.string().uuid() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Choose a valid stock alert." }, { status: 400 });
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("customer_back_in_stock_requests")
      .delete()
      .eq("id", parsed.data.id)
      .eq("user_id", context.userId)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Stock alert not found." }, { status: 404 });
    return NextResponse.json({ removed: true });
  } catch (error) {
    console.error("CUSTOMER BACK-IN-STOCK REMOVE ERROR", error);
    return NextResponse.json({ error: "Unable to remove this stock alert." }, { status: 500 });
  }
}
