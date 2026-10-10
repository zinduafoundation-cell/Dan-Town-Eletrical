import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { getAppUrl } from "@/lib/env";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const initSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  paymentToken: z.string().min(40).max(100)
});

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey) {
    return NextResponse.json(
      { error: "PAYSTACK_SECRET_KEY is not configured for this deployment." },
      { status: 503 }
    );
  }
  if (!secretKey.startsWith("sk_test_")) {
    return NextResponse.json(
      { error: "Website checkout requires a Paystack sandbox secret key beginning with sk_test_." },
      { status: 503 }
    );
  }

  try {
    const input = initSchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json({ error: "Enter a valid email address to continue." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,order_number,total,payment_status,order_status,sales_channel,payment_access_token_hash")
      .eq("id", input.data.orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.sales_channel !== "ONLINE") {
      return NextResponse.json({ error: "Online order not found." }, { status: 404 });
    }
    if (!verifyOrderPaymentAccessToken(input.data.paymentToken, order.payment_access_token_hash)) {
      return NextResponse.json({ error: "Payment access could not be verified for this order." }, { status: 403 });
    }
    if (
      order.payment_status !== "PENDING" ||
      !["PENDING", "PAYMENT_PENDING"].includes(order.order_status)
    ) {
      return NextResponse.json({ error: "This order is not awaiting payment." }, { status: 409 });
    }

    const { data: payment, error: paymentError } = await supabase.rpc(
      "prepare_online_paystack_payment",
      { target_order_id: order.id }
    );
    if (paymentError || !payment) {
      console.error("Paystack online payment preparation failed:", paymentError);
      return NextResponse.json({ error: "Unable to prepare this order for payment." }, { status: 409 });
    }

    const callbackUrl = new URL("/payment/paystack-callback", getAppUrl(request));
    callbackUrl.searchParams.set("orderId", order.id);
    const initialized = await createPaystackClient(secretKey).transaction.initialize({
      email: input.data.email,
      amount: Math.round(Number(order.total) * 100),
      callback_url: callbackUrl.toString(),
      metadata: {
        order_id: order.id,
        customer_name: "Online customer"
      }
    });

    const { error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        payment_id: payment.id,
        provider_reference: initialized.reference,
        response_payload: { provider: "PAYSTACK", status: "INITIALIZED" },
        status: "PENDING",
        checkout_request_id: null,
        merchant_request_id: null,
        result_code: null,
        result_description: null,
        processed_at: null
      });
    if (transactionError) {
      console.error("Paystack online transaction persistence failed:", transactionError);
      return NextResponse.json(
        { error: "Unable to save the payment session. Please retry or contact support." },
        { status: 500 }
      );
    }

    return NextResponse.json({ authorizationUrl: initialized.authorization_url });
  } catch (error) {
    console.error("Paystack online initialization failed:", error);
    if (error instanceof PaystackApiError) {
      return NextResponse.json(
        { error: "Unable to start Paystack sandbox checkout. Please try again." },
        { status: error.status && error.status >= 500 ? 502 : 400 }
      );
    }
    return NextResponse.json({ error: "Unable to start payment." }, { status: 500 });
  }
}
