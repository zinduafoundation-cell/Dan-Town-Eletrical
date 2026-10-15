import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { getAppUrl } from "@/lib/env";
import { getPesapalConfig, PesapalApiError } from "@/lib/payments/pesapal";
import { initializePesapalCheckout } from "@/lib/payments/pesapal-checkout";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const initSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  paymentToken: z.string().min(40).max(100),
});

export async function POST(request: Request) {
  if (!getPesapalConfig()) {
    return NextResponse.json({ error: "Pesapal is not configured for this deployment." }, { status: 503 });
  }

  try {
    const parsed = initSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address and payment session." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,total,payment_status,order_status,sales_channel,payment_access_token_hash")
      .eq("id", parsed.data.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.sales_channel !== "ONLINE") {
      return NextResponse.json({ error: "Online order not found." }, { status: 404 });
    }
    if (!verifyOrderPaymentAccessToken(parsed.data.paymentToken, order.payment_access_token_hash)) {
      return NextResponse.json({ error: "Payment access could not be verified for this order." }, { status: 403 });
    }
    if (order.payment_status !== "PENDING" || !["PENDING", "PAYMENT_PENDING"].includes(order.order_status)) {
      return NextResponse.json({ error: "This order is not awaiting payment." }, { status: 409 });
    }

    const { data: payment, error: paymentError } = await supabase.rpc(
      "prepare_online_pesapal_payment",
      { target_order_id: order.id },
    );
    if (paymentError || !payment) {
      console.error("Pesapal online payment preparation failed:", paymentError);
      return NextResponse.json({ error: "Unable to prepare this order for payment." }, { status: 409 });
    }

    const callbackUrl = new URL("/payment/pesapal-callback", getAppUrl(request));
    callbackUrl.searchParams.set("orderId", order.id);
    const redirectUrl = await initializePesapalCheckout({
      supabase,
      paymentId: payment.id,
      order,
      email: parsed.data.email,
      callbackUrl: callbackUrl.toString(),
    });

    return NextResponse.json({ redirectUrl });
  } catch (error) {
    console.error("Pesapal online checkout initialization failed:", error);
    const status = error instanceof PesapalApiError ? error.status ?? 502 : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to start Pesapal checkout.",
    }, { status: status >= 400 && status <= 599 ? status : 502 });
  }
}
