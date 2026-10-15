import type { Database } from "@dantown/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPesapalTransactionStatus, PesapalApiError } from "./pesapal";
import { pesapalPaymentMethod } from "./pesapal-utils";

export class PesapalVerificationError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "PesapalVerificationError";
  }
}

export async function verifyPesapalPayment(input: {
  supabase: SupabaseClient<Database>;
  orderId: string;
  trackingId: string;
  merchantReference: string;
}) {
  const { supabase } = input;
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("id,order_number,total,payment_status,order_status,sales_channel")
    .eq("id", input.orderId)
    .maybeSingle();
  if (orderError) throw orderError;
  if (!order) throw new PesapalVerificationError("Order not found.", 404);
  if (order.order_number !== input.merchantReference) {
    throw new PesapalVerificationError("Pesapal merchant reference does not match this order.", 400);
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("id")
    .eq("order_id", order.id)
    .eq("provider", "PESAPAL")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (paymentError) throw paymentError;
  if (!payment) throw new PesapalVerificationError("Pesapal payment was not found for this order.", 404);

  let { data: transaction, error: transactionError } = await supabase
    .from("payment_transactions")
    .select("id,payment_id,status,provider_reference,merchant_request_id")
    .eq("provider_reference", input.trackingId)
    .maybeSingle();
  if (transactionError) throw transactionError;
  if (!transaction) {
    const pendingLookup = await supabase
      .from("payment_transactions")
      .select("id,payment_id,status,provider_reference,merchant_request_id")
      .eq("payment_id", payment.id)
      .eq("merchant_request_id", order.order_number)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    transaction = pendingLookup.data;
    transactionError = pendingLookup.error;
    if (transactionError) throw transactionError;
  }
  if (!transaction || transaction.payment_id !== payment.id) {
    throw new PesapalVerificationError("Pesapal tracking ID is not linked to this order.", 404);
  }
  if (transaction.merchant_request_id !== order.order_number) {
    throw new PesapalVerificationError("Pesapal merchant reference does not match the stored payment.", 400);
  }

  let status;
  try {
    status = await getPesapalTransactionStatus(input.trackingId);
  } catch (error) {
    if (error instanceof PesapalApiError) {
      throw new PesapalVerificationError(error.message, error.status ?? 502);
    }
    throw error;
  }

  const paymentStatusCode = Number(status.payment_status_code);
  if (paymentStatusCode !== 1) {
    if (paymentStatusCode === 2 || paymentStatusCode === 3) {
      const description = status.payment_status_description ?? "Pesapal payment was not completed.";
      const { error: failedTransactionError } = await supabase
        .from("payment_transactions")
        .update({
          status: "FAILED",
          result_code: String(paymentStatusCode),
          result_description: description,
          response_payload: status,
          processed_at: new Date().toISOString(),
        })
        .eq("id", transaction.id)
        .eq("status", "PENDING");
      if (failedTransactionError) throw failedTransactionError;
      return {
        success: false as const,
        pending: false as const,
        orderId: order.id,
        orderNumber: order.order_number,
      };
    }
    return { success: false as const, pending: true as const, orderId: order.id, orderNumber: order.order_number };
  }
  if (
    status.currency.toUpperCase() !== "KES" ||
    !Number.isFinite(Number(status.amount)) ||
    Math.round(Number(status.amount) * 100) !== Math.round(Number(order.total) * 100)
  ) {
    throw new PesapalVerificationError("Pesapal confirmed an amount or currency that does not match this order.", 400);
  }

  const method = pesapalPaymentMethod(status.payment_method);
  if (!method) {
    throw new PesapalVerificationError("Pesapal returned an unsupported payment method.", 400);
  }

  if (transaction.provider_reference !== input.trackingId) {
    const { error: referenceError } = await supabase
      .from("payment_transactions")
      .update({ provider_reference: input.trackingId })
      .eq("id", transaction.id)
      .eq("status", "PENDING");
    if (referenceError) throw referenceError;
  }

  const { data: completedOrder, error: completionError } = await supabase.rpc("complete_pesapal_payment", {
    target_order_id: order.id,
    target_provider_reference: input.trackingId,
    provider_amount: Number(status.amount),
    provider_method: method,
    provider_payload: status,
  });
  if (completionError || !completedOrder) {
    console.error("Pesapal verified payment could not be completed:", completionError);
    throw new PesapalVerificationError("Verified payment could not yet be recorded.", 409);
  }

  const [itemsResult, paymentResult] = await Promise.all([
    supabase
      .from("order_items")
      .select("product_name_snapshot,sku_snapshot,quantity,line_total,vat")
      .eq("order_id", order.id),
    supabase
      .from("payments")
      .select("method,status")
      .eq("order_id", order.id)
      .eq("status", "SUCCESS")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  if (itemsResult.error) throw itemsResult.error;
  if (paymentResult.error) throw paymentResult.error;
  if (!paymentResult.data || !itemsResult.data) {
    throw new PesapalVerificationError("The verified receipt is not yet available.", 409);
  }

  return {
    success: true as const,
    orderId: completedOrder.id,
    orderNumber: completedOrder.order_number,
    salesChannel: completedOrder.sales_channel,
    receipt: {
      subtotal: Number(completedOrder.subtotal),
      discount: Number(completedOrder.discount),
      tax: Number(completedOrder.vat),
      delivery: Number(completedOrder.delivery_fee),
      total: Number(completedOrder.total),
      paymentMethod: paymentResult.data.method,
      date: completedOrder.created_at,
      items: itemsResult.data.map((item) => ({
        name: item.product_name_snapshot,
        sku: item.sku_snapshot,
        qty: item.quantity,
        total: Number(item.line_total) + Number(item.vat),
      })),
      payment: paymentResult.data,
    },
  };
}
