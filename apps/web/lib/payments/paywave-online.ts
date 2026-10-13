import "server-only";

import type { PaymentStatus } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { createPaywaveClient, type PaywaveTransactionStatus } from "@/lib/payments/paywave";
import { matchesKshAmount } from "@/lib/payments/paywave-utils";

export type PaywaveVerificationResult =
  | { status: "pending" }
  | { status: "failed" }
  | { status: "completed"; orderId: string; orderNumber: string };

function safeProviderPayload(
  transactionRequestId: string,
  result: PaywaveTransactionStatus,
) {
  return {
    provider: "PAYWAVE_EXPRESS",
    transactionRequestId,
    status: result.TransactionStatus,
    resultCode: String(result.ResultCode),
    resultDescription: result.ResultDesc ?? null,
    transactionReceipt: result.TransactionReceipt ?? null,
    transactionAmount: String(result.TransactionAmount),
    transactionReference: result.TransactionReference,
    transactionDate: result.TransactionDate ?? null,
    checkoutRequestId: result.CheckoutRequestID ?? null,
    merchantRequestId: result.MerchantRequestID ?? null,
  };
}

export async function verifyAndCompletePaywaveTransaction(
  transactionRequestId: string,
): Promise<PaywaveVerificationResult> {
  const supabase = createSupabaseServiceClient();
  const { data: transaction, error: transactionError } = await supabase
    .from("payment_transactions")
    .select("id,payment_id,status")
    .eq("provider_reference", transactionRequestId)
    .maybeSingle();
  if (transactionError) throw transactionError;
  if (!transaction?.payment_id) throw new Error("Paywave Express transaction was not found.");

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id,order_id,amount,status")
    .eq("id", transaction.payment_id)
    .eq("provider", "PAYWAVE_EXPRESS")
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) throw new Error("Paywave Express payment record was not found.");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,total,payment_status,order_status,sales_channel")
    .eq("id", payment.order_id)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order || order.sales_channel !== "ONLINE") {
    throw new Error("Paywave Express online order was not found.");
  }
  if (transaction.status === "SUCCESS" && order.payment_status === "SUCCESS") {
    return { status: "completed", orderId: order.id, orderNumber: order.order_number };
  }
  if (transaction.status === "FAILED" || transaction.status === "CANCELLED") {
    return { status: "failed" };
  }

  const providerStatus = await createPaywaveClient().verify(transactionRequestId);
  if (providerStatus.TransactionReference !== order.order_number) {
    throw new Error("Paywave Express transaction reference does not match the order.");
  }
  if (!matchesKshAmount(providerStatus.TransactionAmount, Number(payment.amount)) ||
    !matchesKshAmount(providerStatus.TransactionAmount, Number(order.total))) {
    throw new Error("Paywave Express transaction amount does not match the order.");
  }

  const providerPayload = safeProviderPayload(transactionRequestId, providerStatus);
  if (providerStatus.TransactionStatus === "Pending") return { status: "pending" };
  if (providerStatus.TransactionStatus === "Failed" || providerStatus.TransactionStatus === "Cancelled") {
    const transactionStatus: PaymentStatus = providerStatus.TransactionStatus === "Failed" ? "FAILED" : "CANCELLED";
    const { error } = await supabase
      .from("payment_transactions")
      .update({
        status: transactionStatus,
        result_code: String(providerStatus.ResultCode),
        result_description: providerStatus.ResultDesc ?? providerStatus.TransactionStatus,
        response_payload: providerPayload,
        processed_at: new Date().toISOString(),
      })
      .eq("id", transaction.id)
      .eq("status", "PENDING");
    if (error) throw error;
    return { status: "failed" };
  }

  const { data: completedOrder, error: completionError } = await supabase.rpc(
    "complete_online_paywave_payment",
    {
      target_order_id: order.id,
      target_provider_reference: transactionRequestId,
      provider_amount: Number(providerStatus.TransactionAmount),
      provider_payload: providerPayload,
    },
  );
  if (completionError || !completedOrder ||
    completedOrder.payment_status !== "SUCCESS" ||
    completedOrder.order_status !== "PROCESSING") {
    console.error("Paywave Express order completion failed:", completionError);
    throw new Error("Unable to record the verified Paywave Express payment.");
  }
  return { status: "completed", orderId: completedOrder.id, orderNumber: completedOrder.order_number };
}
