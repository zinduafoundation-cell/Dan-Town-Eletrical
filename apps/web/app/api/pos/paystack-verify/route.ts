import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthorizedPermission } from "../../../../lib/auth/server";
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

    // Verify payment with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${paystackApiKey}`
        }
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyResponse.ok) {
      console.error("Paystack verification error:", verifyData);
      return NextResponse.json(
        { error: "Payment verification failed" },
        { status: 400 }
      );
    }

    // Check if payment was successful
    if (verifyData.data.status !== "success") {
      return NextResponse.json(
        { error: "Payment was not completed successfully" },
        { status: 400 }
      );
    }

    const paymentData = verifyData.data;
    const supabase = createSupabaseServiceClient();
    const { data: order, error } = await supabase.rpc("complete_pos_paystack_payment", {
      target_order_id: orderId,
      target_provider_reference: reference,
      provider_amount: paymentData.amount,
      provider_payload: paymentData
    });
    if (error || !order) return NextResponse.json({ error: error?.message || "Unable to record verified payment." }, { status: 400 });

    return NextResponse.json(
      {
        success: true,
        message: "Payment verified and sale recorded successfully",
        orderId: order.id,
        orderNumber: order.order_number,
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
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to verify payment" },
      { status: 500 }
    );
  }
}
