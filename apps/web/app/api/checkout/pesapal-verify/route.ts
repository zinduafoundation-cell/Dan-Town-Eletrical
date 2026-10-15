import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { getPesapalConfig } from "@/lib/payments/pesapal";
import { PesapalVerificationError, verifyPesapalPayment } from "@/lib/payments/pesapal-verification";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const verifySchema = z.object({
  orderId: z.string().uuid(),
  trackingId: z.string().trim().min(1).max(128),
  merchantReference: z.string().trim().min(1).max(64),
  paymentToken: z.string().min(40).max(100).optional(),
});

export async function POST(request: Request) {
  if (!getPesapalConfig()) {
    return NextResponse.json({ error: "Pesapal is not configured for this deployment." }, { status: 503 });
  }
  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Pesapal payment confirmation details are invalid." }, { status: 400 });
    }
    const supabase = createSupabaseServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,sales_channel,payment_access_token_hash")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    if (order.sales_channel === "ONLINE") {
      if (!parsed.data.paymentToken || !verifyOrderPaymentAccessToken(parsed.data.paymentToken, order.payment_access_token_hash)) {
        return NextResponse.json({ error: "Payment access could not be verified for this order." }, { status: 403 });
      }
    } else if (order.sales_channel === "POS") {
      await requireAuthorizedPermission("orders.create");
    } else {
      return NextResponse.json({ error: "This order cannot be paid through Pesapal." }, { status: 400 });
    }

    const result = await verifyPesapalPayment({
      supabase,
      orderId: parsed.data.orderId,
      trackingId: parsed.data.trackingId,
      merchantReference: parsed.data.merchantReference,
    });
    if (!result.success) {
      return NextResponse.json(result, { status: result.pending ? 202 : 402 });
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PesapalVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Pesapal payment verification failed:", error);
    return NextResponse.json({ error: "Unable to verify Pesapal payment." }, { status: 500 });
  }
}
