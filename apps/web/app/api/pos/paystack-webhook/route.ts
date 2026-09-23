import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { Json } from "@dantown/database";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const PAYSTACK_SIGNATURE_HEADER = "x-paystack-signature";

type JsonObject = { [key: string]: Json | undefined };

function isJsonObject(value: Json | undefined): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function resolveOrderIdFromReference(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  reference: string | null,
  metadataOrderId?: string | null
): Promise<string | null> {
  if (metadataOrderId) return metadataOrderId;
  if (!reference) return null;

  const { data: transaction, error: transactionError } = await supabase
    .from("payment_transactions")
    .select("payment_id")
    .eq("provider_reference", reference)
    .maybeSingle();

  if (transactionError || !transaction?.payment_id) {
    return null;
  }

  const { data: payment, error: paymentError } = await supabase
    .from("payments")
    .select("order_id")
    .eq("id", transaction.payment_id)
    .maybeSingle();

  if (paymentError || !payment?.order_id) {
    return null;
  }

  return payment.order_id;
}

export async function POST(request: Request) {
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY;

  if (!paystackSecret) {
    return NextResponse.json(
      { ok: false, error: "Paystack configuration missing" },
      { status: 500 }
    );
  }

  const signature = request.headers.get(PAYSTACK_SIGNATURE_HEADER);
  if (!signature) {
    return NextResponse.json(
      { ok: false, error: "Missing Paystack signature" },
      { status: 401 }
    );
  }

  const rawBody = await request.text();
  const expectedSignature = createHmac("sha512", paystackSecret)
    .update(rawBody)
    .digest("hex");

  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return NextResponse.json(
      { ok: false, error: "Invalid Paystack signature" },
      { status: 401 }
    );
  }

  let payload: JsonObject;
  try {
    const parsedPayload: unknown = JSON.parse(rawBody);
    if (!isJsonObject(parsedPayload as Json)) {
      return NextResponse.json(
        { ok: false, error: "Invalid webhook payload" },
        { status: 400 }
      );
    }
    payload = parsedPayload as JsonObject;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid webhook payload" },
      { status: 400 }
    );
  }

  const eventName = typeof payload.event === "string" ? payload.event : "unknown";
  const data = isJsonObject(payload.data) ? payload.data : {};
  const providerReference = typeof data.reference === "string" ? data.reference : null;
  const metadata = isJsonObject(data.metadata) ? data.metadata : {};
  const metadataOrderId = typeof metadata.order_id === "string" ? metadata.order_id : null;
  const eventId = typeof payload.id === "string" ? payload.id : null;

  const supabase = createSupabaseServiceClient();
  const resolvedOrderId = await resolveOrderIdFromReference(
    supabase,
    providerReference,
    metadataOrderId
  );

  const { error: eventInsertError } = await supabase
    .from("paystack_webhook_events")
    .insert({
      provider: "PAYSTACK",
      event_name: eventName,
      event_id: eventId,
      provider_reference: providerReference,
      order_id: resolvedOrderId,
      payload
    });

  if (eventInsertError && !String(eventInsertError.message).toLowerCase().includes("duplicate")) {
    console.error("Paystack webhook event persistence failed:", eventInsertError);
    return NextResponse.json(
      { ok: false, error: "Unable to record webhook event" },
      { status: 500 }
    );
  }

  if (eventName === "charge.success") {
    if (!providerReference || !resolvedOrderId) {
      return NextResponse.json(
        { ok: true, received: true, event: eventName },
        { status: 200 }
      );
    }

    const providerAmount = Number(data.amount ?? 0);
    const { data: orderResult, error: completionError } = await supabase.rpc(
      "complete_pos_paystack_payment",
      {
        target_order_id: resolvedOrderId,
        target_provider_reference: providerReference,
        provider_amount: providerAmount,
        provider_payload: data
      }
    );

    if (completionError && !orderResult) {
      const { data: existingOrder, error: lookupError } = await supabase
        .from("orders")
        .select("id, payment_status")
        .eq("id", resolvedOrderId)
        .maybeSingle();

      if (lookupError || !existingOrder) {
        console.error("Paystack webhook completion failed:", completionError);
        return NextResponse.json(
          { ok: false, error: "Failed to complete Paystack payment" },
          { status: 500 }
        );
      }

      if (existingOrder.payment_status === "SUCCESS") {
        return NextResponse.json(
          { ok: true, received: true, event: eventName, already_processed: true },
          { status: 200 }
        );
      }

      console.error("Paystack webhook completion failed:", completionError);
      return NextResponse.json(
        { ok: false, error: "Failed to complete Paystack payment" },
        { status: 500 }
      );
    }
  }

  if (eventName === "refund.processed" || eventName === "charge.dispute.create") {
    return NextResponse.json(
      {
        ok: true,
        received: true,
        event: eventName,
        order_id: resolvedOrderId,
        reference: providerReference
      },
      { status: 200 }
    );
  }

  return NextResponse.json(
    { ok: true, received: true, event: eventName },
    { status: 200 }
  );
}
