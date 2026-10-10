import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { getPaystackMode } from "@/lib/payments/paystack-mode";

const verifySchema = z.object({
  reference: z.string().trim().min(1).max(255)
});

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  const paystackMode = getPaystackMode(secretKey);
  if (!secretKey || !paystackMode) {
    return NextResponse.json(
      { error: "Configure a valid Paystack test or live secret key for this deployment." },
      { status: 503 }
    );
  }

  try {
    const input = verifySchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json({ error: "Payment confirmation details are invalid." }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const { data: transaction, error: transactionError } = await supabase
      .from("payment_transactions")
      .select("payment_id,response_payload")
      .eq("provider_reference", input.data.reference)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction?.payment_id) {
      return NextResponse.json({ error: "Paystack reference is not linked to an order." }, { status: 404 });
    }
    const transactionMode =
      transaction.response_payload &&
      typeof transaction.response_payload === "object" &&
      !Array.isArray(transaction.response_payload) &&
      (transaction.response_payload.mode === "test" || transaction.response_payload.mode === "live")
        ? transaction.response_payload.mode
        : paystackMode;
    if (transactionMode !== paystackMode) {
      return NextResponse.json(
        { error: "This payment was started in a different Paystack mode. Use the matching server configuration to verify it." },
        { status: 409 }
      );
    }

    const { data: paymentRecord, error: paymentRecordError } = await supabase
      .from("payments")
      .select("order_id")
      .eq("id", transaction.payment_id)
      .eq("provider", "PAYSTACK")
      .maybeSingle();
    if (paymentRecordError) throw paymentRecordError;
    if (!paymentRecord?.order_id) {
      return NextResponse.json({ error: "Paystack payment record was not found." }, { status: 404 });
    }

    const payment = await createPaystackClient(secretKey).transaction.verify(input.data.reference);
    if (
      payment.status !== "success" ||
      payment.reference !== input.data.reference ||
      payment.currency !== "KES" ||
      payment.metadata?.order_id !== paymentRecord.order_id
    ) {
      return NextResponse.json(
        { error: "Paystack has not confirmed a matching successful payment." },
        { status: 400 }
      );
    }

    const completionArgs = {
      target_order_id: paymentRecord.order_id,
      target_provider_reference: input.data.reference,
      provider_amount: payment.amount,
      provider_payload: payment
    };
    const completionResult = paystackMode === "test"
      ? await supabase.rpc("finish_online_paystack_sandbox_test", completionArgs)
      : await supabase.rpc("complete_online_paystack_payment", completionArgs);
    const { data: order, error } = completionResult;
    const expectedPaymentStatus = paystackMode === "test" ? "CANCELLED" : "SUCCESS";
    const expectedOrderStatus = paystackMode === "test" ? "CANCELLED" : "PROCESSING";
    if (error || !order || order.payment_status !== expectedPaymentStatus || order.order_status !== expectedOrderStatus) {
      console.error("Paystack online payment completion failed:", error);
      return NextResponse.json({
        error: paystackMode === "test"
          ? "Unable to safely finish the Paystack sandbox test."
          : "Unable to record the verified Paystack payment."
      }, { status: 409 });
    }

    if (paystackMode === "live") {
      return NextResponse.json({
        success: true,
        sandboxTest: false,
        orderId: order.id,
        orderNumber: order.order_number,
        message: `Paystack payment verified and order ${order.order_number} recorded for POS processing.`
      });
    }

    return NextResponse.json({
      success: true,
      sandboxTest: true,
      orderId: order.id,
      orderNumber: order.order_number,
      message: `Paystack sandbox payment verified for ${order.order_number}. The test order was cancelled, reserved stock was released, and no real payment was collected.`
    });
  } catch (error) {
    console.error("Paystack online verification failed:", error);
    if (error instanceof PaystackApiError) {
      return NextResponse.json(
        { error: "Unable to verify the Paystack payment. Please retry." },
        { status: error.status && error.status >= 500 ? 502 : 400 }
      );
    }
    return NextResponse.json({ error: "Unable to verify payment." }, { status: 500 });
  }
}
