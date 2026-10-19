import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { getPaystackMode } from "@/lib/payments/paystack-mode";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const verifySchema = z.object({
  orderId: z.string().uuid(),
  reference: z.string().trim().min(1).max(100),
  paymentToken: z.string().min(40).max(100),
});

export async function POST(request: Request) {
  if (!getPaystackMode()) {
    return NextResponse.json({ error: "Paystack is not configured for this deployment." }, { status: 503 });
  }

  try {
    const parsed = verifySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Paystack payment confirmation details are invalid." }, { status: 400 });
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

    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("id,payment_id,status,merchant_request_id,response_payload")
      .eq("provider_reference", parsed.data.reference)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction || transaction.merchant_request_id !== order.order_number) {
      return NextResponse.json({ error: "Paystack transaction is not linked to this order." }, { status: 404 });
    }
    const payload = transaction.response_payload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.provider !== "PAYSTACK") {
      return NextResponse.json({ error: "Paystack transaction record is invalid." }, { status: 409 });
    }
    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("id,provider")
      .eq("id", transaction.payment_id)
      .eq("order_id", order.id)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.provider !== "PAYSTACK") {
      return NextResponse.json({ error: "Paystack payment is not linked to this order." }, { status: 404 });
    }

    const verified = await createPaystackClient(process.env.PAYSTACK_SECRET_KEY)
      .transaction.verify(parsed.data.reference);
    if (verified.reference !== parsed.data.reference) {
      return NextResponse.json({ error: "Paystack returned a mismatched transaction reference." }, { status: 409 });
    }
    if (verified.status !== "success") {
      if (["failed", "abandoned"].includes(verified.status.toLowerCase())) {
        const { error: failedError } = await supabase
          .from("payment_transactions")
          .update({
            status: "FAILED",
            result_description: `Paystack transaction ${verified.status.toLowerCase()}.`,
            response_payload: { provider: "PAYSTACK", status: verified.status },
            processed_at: new Date().toISOString(),
          })
          .eq("id", transaction.id)
          .eq("status", "PENDING");
        if (failedError) throw failedError;
        return NextResponse.json({ error: "Paystack reports that this payment was not completed." }, { status: 402 });
      }
      return NextResponse.json({ pending: true }, { status: 202 });
    }
    if (
      verified.currency?.toUpperCase() !== "KES" ||
      verified.amount !== Math.round(Number(order.total) * 100) ||
      verified.metadata?.order_id !== order.id
    ) {
      return NextResponse.json({ error: "Paystack confirmed an amount, currency, or order that does not match." }, { status: 409 });
    }

    const { data: completedOrder, error: completionError } = await supabase.rpc("complete_online_paystack_payment", {
      target_order_id: order.id,
      target_provider_reference: parsed.data.reference,
      provider_amount: verified.amount,
      provider_payload: {
        provider: "PAYSTACK",
        reference: verified.reference,
        amount: verified.amount,
        currency: verified.currency,
        status: verified.status,
      },
    });
    if (completionError || !completedOrder) {
      console.error("Verified Paystack payment could not be completed:", completionError);
      return NextResponse.json({ error: "Verified payment could not yet be recorded." }, { status: 409 });
    }

    return NextResponse.json({
      success: true,
      orderId: completedOrder.id,
      orderNumber: completedOrder.order_number,
    });
  } catch (error) {
    if (error instanceof PaystackApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
    }
    console.error("Paystack payment verification failed:", error);
    return NextResponse.json({ error: "Unable to verify Paystack payment." }, { status: 500 });
  }
}
