import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { createPaywaveClient, PaywaveApiError, PaywaveConfigurationError } from "@/lib/payments/paywave";
import { normalizeKenyanPhone, toKshAmount } from "@/lib/payments/paywave-utils";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const initSchema = z.object({
  orderId: z.string().uuid(),
  phone: z.string().trim().min(9).max(20),
  paymentToken: z.string().min(40).max(100),
});

export async function POST(request: Request) {
  try {
    const input = initSchema.safeParse(await request.json());
    if (!input.success) {
      return NextResponse.json({ error: "Enter a valid M-Pesa phone number and payment session." }, { status: 400 });
    }

    let phone: string;
    try {
      phone = normalizeKenyanPhone(input.data.phone);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Enter a valid Kenyan M-Pesa mobile number." },
        { status: 400 },
      );
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
    if (order.payment_status !== "PENDING" || !["PENDING", "PAYMENT_PENDING"].includes(order.order_status)) {
      return NextResponse.json({ error: "This order is not awaiting payment." }, { status: 409 });
    }

    const { data: payment, error: paymentError } = await supabase.rpc(
      "prepare_online_paywave_payment",
      { target_order_id: order.id },
    );
    if (paymentError || !payment) {
      console.error("Paywave Express payment preparation failed:", paymentError);
      return NextResponse.json({ error: "Unable to prepare this order for M-Pesa payment." }, { status: 409 });
    }

    const { data: pendingTransaction, error: pendingTransactionError } = await supabase
      .from("payment_transactions")
      .select("provider_reference")
      .eq("payment_id", payment.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pendingTransactionError) throw pendingTransactionError;
    if (pendingTransaction?.provider_reference) {
      return NextResponse.json({
        success: true,
        transactionRequestId: pendingTransaction.provider_reference,
        message: "An M-Pesa request is already awaiting confirmation. Check your phone or payment status.",
      });
    }

    const recentCutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: recentTransaction, error: recentTransactionError } = await supabase
      .from("payment_transactions")
      .select("id")
      .eq("payment_id", payment.id)
      .gte("created_at", recentCutoff)
      .limit(1)
      .maybeSingle();
    if (recentTransactionError) throw recentTransactionError;
    if (recentTransaction) {
      return NextResponse.json(
        { error: "An M-Pesa request was just sent. Wait a minute before requesting another prompt." },
        { status: 429 },
      );
    }

    const initialized = await createPaywaveClient().stkPush({
      amount: toKshAmount(Number(order.total)),
      msisdn: phone,
      reference: order.order_number,
    });

    const { error: transactionError } = await supabase
      .from("payment_transactions")
      .insert({
        payment_id: payment.id,
        provider_reference: initialized.transaction_request_id,
        response_payload: {
          provider: "PAYWAVE_EXPRESS",
          status: "INITIALIZED",
        },
        status: "PENDING",
        checkout_request_id: initialized.CheckoutRequestID ?? null,
        merchant_request_id: initialized.MerchantRequestID ?? null,
        result_code: String(initialized.ResponseCode),
        result_description: initialized.message ?? null,
        processed_at: null,
      });
    if (transactionError) {
      console.error("Paywave Express transaction persistence failed:", transactionError);
      return NextResponse.json({ error: "Unable to save the payment session. Contact support before retrying." }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      transactionRequestId: initialized.transaction_request_id,
      message: "Check your phone and enter your M-Pesa PIN to approve the payment.",
    });
  } catch (error) {
    if (error instanceof PaywaveConfigurationError) {
      return NextResponse.json({ error: "Paywave Express is not configured on this deployment." }, { status: 503 });
    }
    if (error instanceof PaywaveApiError) {
      console.error("Paywave Express payment initiation failed:", error.message, error.status);
      return NextResponse.json({ error: "Unable to send the M-Pesa prompt. Please try again." }, { status: 502 });
    }
    console.error("Paywave Express payment initialization failed:", error);
    return NextResponse.json({ error: "Unable to start M-Pesa payment." }, { status: 500 });
  }
}
