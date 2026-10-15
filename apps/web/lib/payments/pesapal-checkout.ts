import type { Database, Json } from "@dantown/database";
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { submitPesapalOrder } from "./pesapal";

type OrderForCheckout = {
  id: string;
  order_number: string;
  total: number;
};

export async function initializePesapalCheckout(input: {
  supabase: SupabaseClient<Database>;
  paymentId: string;
  order: OrderForCheckout;
  email: string;
  phone?: string | null;
  callbackUrl: string;
}) {
  const { supabase, paymentId, order } = input;
  const { data: pending, error: pendingError } = await supabase
    .from("payment_transactions")
    .select("id,provider_reference,response_payload,created_at")
    .eq("payment_id", paymentId)
    .eq("status", "PENDING")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pendingError) throw pendingError;

  if (pending) {
    const payload = pending.response_payload;
    if (payload && typeof payload === "object" && !Array.isArray(payload)) {
      const redirectUrl = payload.redirect_url;
      if (payload.status === "INITIALIZED" && typeof redirectUrl === "string") {
        return redirectUrl;
      }
      if (
        payload.status === "SUBMITTING" &&
        Date.now() - Date.parse(pending.created_at) < 90_000
      ) {
        throw new Error("Pesapal checkout is already being prepared. Please wait a moment and retry.");
      }
    }
    const { error: staleError } = await supabase
      .from("payment_transactions")
      .update({
        status: "FAILED",
        result_description: "The Pesapal checkout session could not be resumed.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", pending.id)
      .eq("status", "PENDING");
    if (staleError) throw staleError;
  }

  const merchantReference = order.order_number;
  const initialReference = `PESAPAL_INIT_${randomUUID()}`;
  const config = {
    payment_id: paymentId,
    provider_reference: initialReference,
    checkout_request_id: null,
    merchant_request_id: merchantReference,
    result_code: null,
    result_description: null,
    response_payload: { provider: "PESAPAL", status: "SUBMITTING" } as Json,
    status: "PENDING" as const,
    processed_at: null,
  };
  const { data: transaction, error: transactionError } = await supabase
    .from("payment_transactions")
    .insert(config)
    .select("id")
    .single();
  if (transactionError) {
    if (transactionError.code === "23505") {
      const { data: concurrent, error: concurrentError } = await supabase
        .from("payment_transactions")
        .select("response_payload")
        .eq("payment_id", paymentId)
        .eq("status", "PENDING")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (concurrentError) throw concurrentError;
      if (concurrent?.response_payload && typeof concurrent.response_payload === "object" && !Array.isArray(concurrent.response_payload)) {
        const redirectUrl = concurrent.response_payload.redirect_url;
        if (concurrent.response_payload.provider === "PESAPAL" && typeof redirectUrl === "string") {
          return redirectUrl;
        }
      }
      throw new Error("Pesapal checkout is already being prepared. Please wait a moment and retry.");
    }
    throw transactionError;
  }

  try {
    const submitted = await submitPesapalOrder({
      merchantReference,
      amount: Number(order.total),
      description: `Dantown order ${order.order_number}`,
      email: input.email,
      phone: input.phone,
      callbackUrl: input.callbackUrl,
    });
    const { error: updateError } = await supabase
      .from("payment_transactions")
      .update({
        provider_reference: submitted.order_tracking_id,
        response_payload: {
          provider: "PESAPAL",
          status: "INITIALIZED",
          environment: submitted.environment,
          redirect_url: submitted.redirect_url,
          merchant_reference: submitted.merchant_reference,
          order_tracking_id: submitted.order_tracking_id,
        },
      })
      .eq("id", transaction.id);
    if (updateError) throw updateError;
    return submitted.redirect_url;
  } catch (error) {
    await supabase
      .from("payment_transactions")
      .update({
        status: "FAILED",
        result_description: error instanceof Error ? error.message : "Pesapal initialization failed.",
        processed_at: new Date().toISOString(),
      })
      .eq("id", transaction.id);
    throw error;
  }
}
