import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createPaystackClient, PaystackApiError } from "../../../../lib/payments/paystack";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";

export async function POST(request: Request) {
  try {
    await requireAuthorizedPermission("orders.create");
    const body = z.object({ reference: z.string().trim().min(1), orderId: z.string().uuid() }).safeParse(await request.json());
    if (!body.success) return NextResponse.json({ error: "Payment reference and order are required." }, { status: 400 });
    const { reference, orderId } = body.data;

    const paystackApiKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackApiKey) {
      return NextResponse.json(
        { error: "Paystack configuration missing" },
        { status: 500 }
      );
    }

    const paymentData = await createPaystackClient(paystackApiKey).transaction.verify(reference);
    if (paymentData.status !== "success") {
      return NextResponse.json(
        { error: "Payment was not completed successfully" },
        { status: 400 }
      );
    }

    if (
      paymentData.reference !== reference ||
      paymentData.currency !== "KES" ||
      paymentData.metadata?.order_id !== orderId
    ) {
      return NextResponse.json(
        { error: "Payment details do not match this order." },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const { data: order, error } = await supabase.rpc("complete_pos_paystack_payment", {
      target_order_id: orderId,
      target_provider_reference: reference,
      provider_amount: paymentData.amount,
      provider_payload: paymentData
    });
    if (error || !order) return NextResponse.json({ error: error?.message || "Unable to record verified payment." }, { status: 400 });

    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("product_name_snapshot,sku_snapshot,quantity,line_total,vat")
      .eq("order_id", orderId);
    if (itemsError) throw itemsError;
    const [{ data: confirmedOrder, error: confirmedOrderError }, { data: verifiedPayment, error: verifiedPaymentError }] = await Promise.all([
      supabase.from("orders").select("subtotal,discount,vat,delivery_fee,total,payment_status,created_at").eq("id", orderId).maybeSingle(),
      supabase.from("payments").select("method,status").eq("order_id", orderId).eq("status", "SUCCESS").order("created_at", { ascending: false }).limit(1).maybeSingle()
    ]);
    if (confirmedOrderError) throw confirmedOrderError;
    if (verifiedPaymentError) throw verifiedPaymentError;
    if (!confirmedOrder || confirmedOrder.payment_status !== "SUCCESS" || !verifiedPayment) {
      return NextResponse.json({ error: "The verified payment receipt is not yet available." }, { status: 409 });
    }

    return NextResponse.json(
      {
        success: true,
        message: "Payment verified and sale recorded successfully",
        orderId: order.id,
        orderNumber: order.order_number,
        receipt: {
          receiptNumber: order.order_number,
          currency: paymentData.currency,
          subtotal: Number(confirmedOrder.subtotal),
          discount: Number(confirmedOrder.discount),
          tax: Number(confirmedOrder.vat),
          delivery: Number(confirmedOrder.delivery_fee),
          total: Number(confirmedOrder.total),
          paymentMethod: verifiedPayment.method,
          date: confirmedOrder.created_at,
          items: (orderItems ?? []).map((item) => ({
            name: item.product_name_snapshot,
            sku: item.sku_snapshot,
            qty: item.quantity,
            total: Number(item.line_total) + Number(item.vat)
          }))
        },
        payment_data: {
          reference,
          amount: Number(order.total),
          customer: paymentData.customer,
          status: "COMPLETED"
        }
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Paystack verification failed:", error);
    if (error instanceof PaystackApiError) {
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: error.status && error.status >= 500 ? 502 : 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
