import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyPaystackWebhookSignature } from "@/lib/payments/paystack-webhook";
import { getPaystackMode } from "@/lib/payments/paystack-mode";
import { createPaystackClient, PaystackApiError } from "@/lib/payments/paystack";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const webhookSchema = z.object({
  event: z.string().trim().min(1).max(100),
  data: z.object({
    id: z.union([z.string(), z.number()]).optional(),
    reference: z.string().trim().min(1).max(100).optional(),
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().max(8).optional(),
    status: z.string().max(40).optional(),
    metadata: z.object({ order_id: z.string().uuid().optional() }).passthrough().optional(),
  }).passthrough(),
}).passthrough();

export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!getPaystackMode() || !secret) {
    return NextResponse.json({ error: "Paystack webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifyPaystackWebhookSignature(rawBody, request.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ error: "Invalid Paystack webhook signature." }, { status: 401 });
  }

  let rawPayload: unknown;
  try {
    rawPayload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid Paystack webhook payload." }, { status: 400 });
  }
  const parsed = webhookSchema.safeParse(rawPayload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid Paystack webhook payload." }, { status: 400 });
  }

  const event = parsed.data.event;
  const reference = parsed.data.data.reference ?? null;
  const supabase = createSupabaseServiceClient();
  let orderId: string | null = null;
  let transaction: { id: string; payment_id: string; status: string; merchant_request_id: string | null } | null = null;

  if (event === "charge.success" && reference) {
    const { data, error } = await supabase
      .from("payment_transactions")
      .select("id,payment_id,status,merchant_request_id")
      .eq("provider_reference", reference)
      .maybeSingle();
    if (error) {
      console.error("Paystack webhook transaction lookup failed:", error);
      return NextResponse.json({ error: "Unable to process Paystack webhook." }, { status: 500 });
    }
    transaction = data;
    if (transaction) {
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .select("id,order_id,provider")
        .eq("id", transaction.payment_id)
        .maybeSingle();
      if (paymentError) {
        console.error("Paystack webhook payment lookup failed:", paymentError);
        return NextResponse.json({ error: "Unable to process Paystack webhook." }, { status: 500 });
      }
      if (payment?.provider === "PAYSTACK") orderId = payment.order_id;
    }
  }

  const safePayload = {
    event,
    data: {
      id: parsed.data.data.id ?? null,
      reference,
      amount: parsed.data.data.amount ?? null,
      currency: parsed.data.data.currency ?? null,
      status: parsed.data.data.status ?? null,
      metadata: { order_id: parsed.data.data.metadata?.order_id ?? null },
    },
  };
  const eventId = parsed.data.data.id === undefined
    ? reference
    : String(parsed.data.data.id).slice(0, 255);
  const { error: eventError } = await supabase.from("paystack_webhook_events").insert({
    provider: "PAYSTACK",
    event_name: event,
    event_id: eventId,
    provider_reference: reference,
    order_id: orderId,
    payload: safePayload,
  });
  if (eventError && eventError.code !== "23505") {
    console.error("Paystack webhook event could not be recorded:", eventError);
    return NextResponse.json({ error: "Unable to record Paystack webhook." }, { status: 500 });
  }

  if (event !== "charge.success") {
    return NextResponse.json({ received: true, status: "ignored" });
  }
  if (!reference || !transaction || !orderId || transaction.merchant_request_id === null) {
    return NextResponse.json({ received: true, status: "unmatched" }, { status: 202 });
  }

  try {
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("id,total,sales_channel,order_number")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.sales_channel !== "ONLINE" || order.order_number !== transaction.merchant_request_id) {
      return NextResponse.json({ received: true, status: "ignored" });
    }
    if (transaction.status !== "PENDING" && transaction.status !== "SUCCESS") {
      return NextResponse.json({ received: true, status: "already-processed" });
    }

    const verified = await createPaystackClient(secret).transaction.verify(reference);
    if (verified.status !== "success") {
      return NextResponse.json({ received: true, status: "pending" }, { status: 202 });
    }
    if (
      verified.reference !== reference ||
      verified.currency?.toUpperCase() !== "KES" ||
      verified.amount !== Math.round(Number(order.total) * 100) ||
      verified.metadata?.order_id !== order.id
    ) {
      console.error("Paystack webhook verification did not match the stored order.", {
        orderId: order.id,
        reference,
      });
      return NextResponse.json({ error: "Paystack webhook does not match the order." }, { status: 409 });
    }

    const { error: completionError } = await supabase.rpc("complete_online_paystack_payment", {
      target_order_id: order.id,
      target_provider_reference: reference,
      provider_amount: verified.amount,
      provider_payload: {
        provider: "PAYSTACK",
        reference: verified.reference,
        amount: verified.amount,
        currency: verified.currency,
        status: verified.status,
      },
    });
    if (completionError) {
      console.error("Verified Paystack webhook could not complete the order:", completionError);
      return NextResponse.json({ error: "Verified payment could not yet be recorded." }, { status: 500 });
    }
    return NextResponse.json({ received: true, status: "completed" });
  } catch (error) {
    if (error instanceof PaystackApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status ?? 502 });
    }
    console.error("Paystack webhook processing failed:", error);
    return NextResponse.json({ error: "Unable to process Paystack webhook." }, { status: 500 });
  }
}
