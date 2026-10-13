import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { PaywaveApiError, PaywaveConfigurationError } from "@/lib/payments/paywave";
import { verifyAndCompletePaywaveTransaction } from "@/lib/payments/paywave-online";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const verifySchema = z.object({
  transactionRequestId: z.string().trim().min(1).max(255),
  paymentToken: z.string().min(40).max(100),
});

export async function POST(request: Request) {
  try {
    const input = verifySchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json({ error: "Payment confirmation details are invalid." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("payment_id")
      .eq("provider_reference", input.data.transactionRequestId)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction?.payment_id) {
      return NextResponse.json({ error: "Paywave Express transaction was not found." }, { status: 404 });
    }

    const { data: payment, error: paymentError } = await supabase
      .from("payments")
      .select("order_id")
      .eq("id", transaction.payment_id)
      .eq("provider", "PAYWAVE_EXPRESS")
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment?.order_id) {
      return NextResponse.json({ error: "Paywave Express payment record was not found." }, { status: 404 });
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,payment_access_token_hash")
      .eq("id", payment.order_id)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || !verifyOrderPaymentAccessToken(input.data.paymentToken, order.payment_access_token_hash)) {
      return NextResponse.json({ error: "Payment access could not be verified for this order." }, { status: 403 });
    }

    const result = await verifyAndCompletePaywaveTransaction(input.data.transactionRequestId);
    if (result.status === "pending") {
      return NextResponse.json({ status: "pending", message: "Waiting for M-Pesa payment approval." }, { status: 202 });
    }
    if (result.status === "failed") {
      return NextResponse.json({ status: "failed", error: "M-Pesa payment was not completed. You can try again." }, { status: 402 });
    }
    return NextResponse.json({ success: true, orderId: result.orderId, orderNumber: result.orderNumber });
  } catch (error) {
    if (error instanceof PaywaveConfigurationError) {
      return NextResponse.json({ error: "Paywave Express is not configured on this deployment." }, { status: 503 });
    }
    if (error instanceof PaywaveApiError) {
      console.error("Paywave Express payment verification failed:", error.message, error.status);
      return NextResponse.json({ error: "Unable to verify the M-Pesa payment yet. Please retry." }, { status: 502 });
    }
    console.error("Paywave Express payment verification failed:", error);
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 500 });
  }
}
