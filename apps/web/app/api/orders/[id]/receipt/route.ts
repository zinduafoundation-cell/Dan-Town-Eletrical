import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadBusinessConfiguration } from "@/lib/settings/business-configuration";

const requestSchema = z.object({ paymentToken: z.string().min(40).max(100).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orderId = (await params).id;
  if (!z.string().uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order receipt not found." }, { status: 404 });
  }

  let input: z.infer<typeof requestSchema> = {};
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Receipt access could not be verified." }, { status: 400 });
    input = parsed.data;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  const service = createSupabaseServiceClient();
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id,order_number,customer_id,subtotal,discount,vat,delivery_fee,total,payment_status,payment_access_token_hash,created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("Unable to load order for receipt.", orderError);
    return NextResponse.json({ error: "Unable to load this receipt." }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "Order receipt not found." }, { status: 404 });

  let authorized = Boolean(input.paymentToken && verifyOrderPaymentAccessToken(input.paymentToken, order.payment_access_token_hash));
  if (!authorized && order.customer_id) {
    const auth = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") throw authError;
    if (user) {
      const { data: customer, error: customerError } = await service
        .from("customers")
        .select("user_id")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (customerError) throw customerError;
      authorized = customer?.user_id === user.id;
    }
  }
  if (!authorized) return NextResponse.json({ error: "Sign in to the account that placed this order, or open the original payment link." }, { status: 403 });
  if (order.payment_status !== "SUCCESS") {
    return NextResponse.json({ error: "The receipt will be available after payment is confirmed." }, { status: 409 });
  }

  const [{ data: lines, error: linesError }, { data: payment, error: paymentError }, { data: customer, error: customerError }, configuration] = await Promise.all([
    service.from("order_items").select("product_name_snapshot,sku_snapshot,quantity,line_total").eq("order_id", order.id),
    service.from("payments").select("method,status").eq("order_id", order.id).eq("status", "SUCCESS").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    order.customer_id
      ? service.from("customers").select("name").eq("id", order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadBusinessConfiguration(),
  ]);
  if (linesError) throw linesError;
  if (paymentError) throw paymentError;
  if (customerError) throw customerError;

  return NextResponse.json({
    receipt: {
      orderNumber: order.order_number,
      date: order.created_at,
      customer: customer?.name ?? null,
      paymentMethod: payment?.method ?? null,
      lines: (lines ?? []).map((line) => ({
        name: line.product_name_snapshot,
        sku: line.sku_snapshot,
        quantity: line.quantity,
        total: Number(line.line_total),
      })),
      subtotal: Number(order.subtotal),
      discount: Number(order.discount),
      tax: Number(order.vat),
      delivery: Number(order.delivery_fee),
      total: Number(order.total),
    },
    settings: configuration.documentSettings,
  });
}
