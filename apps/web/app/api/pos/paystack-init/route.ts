import { NextResponse } from "next/server";
import { z } from "zod";
import { getStaffIdentity, requireAuthorizedPermission } from "../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../lib/supabase/server";

const initSchema = z.object({
  customerId: z.string().uuid().nullable().optional(),
  customerName: z.string().trim().min(1).max(160),
  email: z.string().email(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().positive() })).min(1)
});

export async function POST(request: Request) {
  try {
    const context = await requireAuthorizedPermission("orders.create");
    const parsed = initSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Please check the payment details." }, { status: 400 });
    const staff = await getStaffIdentity(context);
    const supabase = createSupabaseServiceClient();
    const { data: order, error: orderError } = await supabase.rpc("create_pos_paystack_order", {
      sale_customer_id: parsed.data.customerId ?? null,
      sale_customer_name: parsed.data.customerName,
      sale_staff_user_id: staff.userId,
      sale_staff_name: staff.name,
      sale_staff_role: staff.role,
      sale_items: parsed.data.items
    });
    if (orderError || !order) return NextResponse.json({ error: orderError?.message || "Unable to prepare payment." }, { status: 400 });

    const paystackApiKey = process.env.PAYSTACK_SECRET_KEY;
    if (!paystackApiKey) {
      return NextResponse.json(
        { error: "Paystack configuration missing" },
        { status: 500 }
      );
    }

    // Initialize Paystack transaction
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email: parsed.data.email,
        amount: Math.round(Number(order.total) * 100),
        callback_url: `${new URL(request.url).origin}/pos/paystack-callback?orderId=${encodeURIComponent(order.id)}`,
        metadata: {
          order_id: order.id,
          customer_name: parsed.data.customerName
        }
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok) {
      console.error("Paystack error:", paystackData);
      return NextResponse.json(
        { error: "Failed to initialize Paystack payment" },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
        order_id: order.id,
        amount: order.total
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json(
      { error: "Failed to initialize payment" },
      { status: 500 }
    );
  }
}
