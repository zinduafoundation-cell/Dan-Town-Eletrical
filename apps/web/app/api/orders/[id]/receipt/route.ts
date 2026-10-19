import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyOrderPaymentAccessToken } from "@/lib/payments/order-payment-access";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { loadBusinessConfiguration } from "@/lib/settings/business-configuration";

const requestSchema = z.object({
  paymentToken: z.string().min(40).max(100).optional(),
  paymentId: z.string().uuid().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const orderId = (await params).id;
  if (!z.string().uuid().safeParse(orderId).success) {
    return NextResponse.json({ error: "Order receipt not found." }, { status: 404 });
  }

  let input: z.infer<typeof requestSchema> = {};
  try {
    const body = await request.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Receipt access could not be verified." }, { status: 400 });
    input = parsed.data;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
  }

  const service = createSupabaseServiceClient();
  const { data: order, error: orderError } = await service
    .from("orders")
    .select("id,order_number,customer_id,subtotal,discount,vat,delivery_fee,total,payment_status,payment_access_token_hash,created_at")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) {
    console.error("Unable to load order for receipt.", orderError);
    return NextResponse.json({ error: "Unable to load this receipt." }, { status: 500 });
  }
  if (!order) return NextResponse.json({ error: "Order receipt not found." }, { status: 404 });

  let authorized = Boolean(input.paymentToken && verifyOrderPaymentAccessToken(input.paymentToken, order.payment_access_token_hash));
  let actorUserId: string | null = null;
  if (!authorized && order.customer_id) {
    const auth = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await auth.auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError") throw authError;
    if (user) {
      actorUserId = user.id;
      const { data: customer, error: customerError } = await service
        .from("customers")
        .select("user_id")
        .eq("id", order.customer_id)
        .maybeSingle();
      if (customerError) throw customerError;
      authorized = customer?.user_id === user.id;
    }
  }
  if (!authorized) return NextResponse.json({ error: "Sign in to the account that placed this order, or open the original payment link." }, { status: 403 });

  const [{ data: payments, error: paymentsError }, { data: customer, error: customerError }, configuration] = await Promise.all([
    service.from("payments").select("id,method,status,amount,currency,created_at")
      .eq("order_id", order.id)
      .in("status", ["SUCCESS", "PARTIALLY_REFUNDED", "REFUNDED"])
      .order("created_at", { ascending: false }),
    order.customer_id
      ? service.from("customers").select("name,phone,tax_number").eq("id", order.customer_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    loadBusinessConfiguration(),
  ]);
  if (paymentsError) throw paymentsError;
  if (customerError) throw customerError;
  if (!payments?.length) {
    return NextResponse.json({ error: "No verified payment is available for this receipt." }, { status: 409 });
  }
  const payment = input.paymentId
    ? payments.find((candidate) => candidate.id === input.paymentId)
    : payments[0];
  if (!payment) return NextResponse.json({ error: "This verified payment does not belong to the order." }, { status: 404 });
  let receiptNumber: string;
  if (payment.status === "SUCCESS") {
    const { data: receiptDocument, error: receiptError } = await service.rpc("issue_verified_payment_receipt", {
      target_payment_id: payment.id,
      actor_user_id: actorUserId,
    });
    if (receiptError || !receiptDocument) {
      console.error("Unable to issue verified payment receipt.", receiptError);
      return NextResponse.json({ error: "The verified payment receipt could not be issued." }, { status: 500 });
    }
    receiptNumber = receiptDocument.document_number;
  } else {
    const { data: receiptDocument, error: receiptError } = await service.from("business_documents")
      .select("document_number")
      .eq("document_type", "RECEIPT")
      .eq("related_reference", `PAYMENT:${payment.id}`)
      .maybeSingle();
    if (receiptError) throw receiptError;
    if (!receiptDocument) {
      return NextResponse.json({ error: "The original receipt was not recorded before this payment was refunded." }, { status: 409 });
    }
    receiptNumber = receiptDocument.document_number;
  }
  const paymentAmount = Number(payment.amount);

  return NextResponse.json({
    receipt: {
      receiptNumber,
      paymentId: payment.id,
      paymentAmount,
      orderNumber: order.order_number,
      date: payment.created_at,
      customer: customer?.name ?? null,
      customerContact: customer?.phone ?? null,
      taxPin: customer?.tax_number ?? null,
      paymentMethod: payment.method,
      payments: payments.map((record) => ({
        id: record.id,
        method: record.method,
        amount: Number(record.amount),
        currency: record.currency,
        date: record.created_at,
      })),
      lines: [{
        name: `Payment received for order ${order.order_number}`,
        quantity: 1,
        total: paymentAmount,
      }],
      subtotal: paymentAmount,
      discount: 0,
      tax: 0,
      delivery: 0,
      total: paymentAmount,
    },
    settings: configuration.documentSettings,
  });
}
