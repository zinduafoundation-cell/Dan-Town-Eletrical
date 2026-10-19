import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppUrl } from "@/lib/env";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { getPaystackMode } from "@/lib/payments/paystack-mode";
import { isPaymentProviderAvailable } from "@/lib/payments/payment-provider-settings";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const initSchema = z.object({
  orderId: z.string().uuid(),
  email: z.string().trim().email().max(254),
  paymentToken: z.string().min(40).max(100),
});

export async function POST(request: Request) {
  if (!getPaystackMode()) {
    return NextResponse.json({ error: "Paystack is not configured for this deployment." }, { status: 503 });
  }

  try {
    const parsed = initSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Enter a valid email address and payment session." }, { status: 400 });
    }
    if (!(await isPaymentProviderAvailable("online", "paystack"))) {
      return NextResponse.json({ error: "Paystack website checkout is disabled or not configured." }, { status: 503 });
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
      "prepare_online_paystack_payment",
      { target_order_id: order.id },
    );
    if (paymentError || !payment) {
      console.error("Paystack online payment preparation failed:", paymentError);
      return NextResponse.json({ error: "Unable to prepare this order for payment." }, { status: 409 });
    }

    const reference = `DT-${randomUUID().replaceAll("-", "")}`;
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        payment_id: payment.id,
        provider_reference: reference,
        checkout_request_id: null,
        merchant_request_id: order.order_number,
        result_code: null,
        result_description: null,
        response_payload: { provider: "PAYSTACK", status: "INITIALIZING" },
        status: "PENDING",
        processed_at: null,
      })
      .select("id")
      .single();
    if (transactionError || !transaction) {
      console.error("Unable to record pending Paystack transaction:", transactionError);
      return NextResponse.json({ error: "Unable to prepare this order for payment." }, { status: 409 });
    }

    try {
      const callbackUrl = new URL("/payment/paystack-callback", getAppUrl(request));
      callbackUrl.searchParams.set("orderId", order.id);
      const initialized = await createPaystackClient(process.env.PAYSTACK_SECRET_KEY).transaction.initialize({
        email: parsed.data.email,
        amount: Math.round(Number(order.total) * 100),
        reference,
        callback_url: callbackUrl.toString(),
        metadata: { order_id: order.id, customer_name: order.order_number },
      });
      if (initialized.reference !== reference) {
        throw new PaystackApiError("Paystack returned a mismatched transaction reference.", 502);
      }
      const { error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          response_payload: {
            provider: "PAYSTACK",
            status: "INITIALIZED",
            authorization_url: initialized.authorization_url,
          },
        })
        .eq("id", transaction.id)
        .eq("status", "PENDING");
      if (updateError) throw updateError;
      return NextResponse.json({ redirectUrl: initialized.authorization_url });
    } catch (error) {
      const { error: updateError } = await supabase
        .from("payment_transactions")
        .update({
          status: "FAILED",
          result_description: error instanceof Error ? error.message : "Paystack checkout initialization failed.",
          processed_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("status", "PENDING");
      if (updateError) console.error("Unable to record failed Paystack initialization:", updateError);
      throw error;
    }
  } catch (error) {
    console.error("Paystack online checkout initialization failed:", error);
    const status = error instanceof PaystackApiError ? error.status ?? 502 : 500;
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Unable to start Paystack checkout.",
    }, { status: status >= 400 && status <= 599 ? status : 502 });
  }
}
