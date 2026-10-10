import { NextResponse } from "next/server";
import { z } from "zod";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const verifySchema = z.object({
  reference: z.string().trim().min(1).max(255)
});

export async function POST(request: Request) {
  const secretKey = process.env.PAYSTACK_SECRET_KEY?.trim();
  if (!secretKey?.startsWith("sk_test_") || process.env.PAYSTACK_ONLINE_TEST_ENABLED !== "true") {
    return NextResponse.json(
      { error: "Paystack sandbox verification is not enabled." },
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
      .select("payment_id")
      .eq("provider_reference", input.data.reference)
      .maybeSingle();
    if (transactionError) throw transactionError;
    if (!transaction?.payment_id) {
      return NextResponse.json({ error: "Paystack reference is not linked to an order." }, { status: 404 });
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

    const { data: order, error } = await supabase.rpc("finish_online_paystack_sandbox_test", {
      target_order_id: paymentRecord.order_id,
      target_provider_reference: input.data.reference,
      provider_amount: payment.amount,
      provider_payload: payment
    });
    if (
      error ||
      !order ||
      order.payment_status !== "CANCELLED" ||
      order.order_status !== "CANCELLED"
    ) {
      console.error("Paystack online payment completion failed:", error);
      return NextResponse.json({ error: "Unable to safely finish the Paystack sandbox test." }, { status: 409 });
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
