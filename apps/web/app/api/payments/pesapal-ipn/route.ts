import { NextResponse } from "next/server";
import { getPesapalConfig } from "@/lib/payments/pesapal";
import { PesapalVerificationError, verifyPesapalPayment } from "@/lib/payments/pesapal-verification";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!getPesapalConfig()) {
    return NextResponse.json({ error: "Pesapal is not configured." }, { status: 503 });
  }
  const params = new URL(request.url).searchParams;
  const trackingId = params.get("OrderTrackingId") ?? params.get("orderTrackingId");
  const merchantReference = params.get("OrderMerchantReference") ?? params.get("orderMerchantReference");
  if (!trackingId || !merchantReference) {
    return NextResponse.json({ error: "Pesapal notification is missing transaction details." }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServiceClient();
    const { data: order, error } = await supabase
      .from("orders")
      .select("id")
      .eq("order_number", merchantReference)
      .maybeSingle();
    if (error) throw error;
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const result = await verifyPesapalPayment({
      supabase,
      orderId: order.id,
      trackingId,
      merchantReference,
    });
    return NextResponse.json({ received: true, status: result.success ? "completed" : result.pending ? "pending" : "failed" });
  } catch (error) {
    if (error instanceof PesapalVerificationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Pesapal IPN handling failed:", error);
    return NextResponse.json({ error: "Unable to process Pesapal notification." }, { status: 500 });
  }
}
