import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";

const OrderRequestSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  phoneNumber: z.string().min(1, "Phone number is required"),
  email: z.string().email().optional().nullable(),
  fulfillmentType: z.enum(["pickup", "delivery"]),
  shippingAddress: z.object({
    county: z.string(),
    town: z.string(),
    address: z.string(),
    googleAddress: z.string().nullable().optional(),
    distanceKm: z.number().nullable().optional(),
    durationMinutes: z.number().nullable().optional()
  }).nullable(),
  items: z.array(z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1),
  subtotal: z.number().min(0),
  deliveryFee: z.number().min(0),
  total: z.number().min(0)
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request
    const validatedData = OrderRequestSchema.parse(body);

    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    const supabase = createSupabaseServiceClient();
    const orderNumber = `DT-${Date.now().toString().slice(-8)}`;
    const { data: order, error: orderError } = await supabase.rpc("create_online_order", {
      order_number: orderNumber,
      buyer_user_id: user?.id ?? null,
      customer_name: validatedData.customerName,
      customer_phone: validatedData.phoneNumber,
      customer_email: validatedData.email ?? null,
      fulfillment_type: validatedData.fulfillmentType,
      shipping_details: validatedData.shippingAddress,
      delivery_fee: validatedData.deliveryFee,
      requested_items: validatedData.items.map((item) => ({ product_id: item.productId, quantity: item.quantity }))
    });
    if (orderError || !order) {
      console.error("Online order RPC failed:", orderError?.message || "No order returned");
      return NextResponse.json({ error: orderError?.message || "Unable to reserve stock and create order." }, { status: 400 });
    }

    if (user?.id) {
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: user.id,
        type: "PAYMENT",
        title: "Payment still needed",
        body: `Order ${order.order_number} is reserved and waiting for payment. Continue whenever you are ready.`,
        read_at: null,
        data: {
          order_id: order.id,
          order_number: order.order_number,
          total: order.total,
          href: `/payment?orderId=${order.id}&orderNumber=${order.order_number}&total=${order.total}`
        }
      });
      if (notificationError) {
        console.error("Payment reminder notification failed:", notificationError.message);
      }
    }

    return NextResponse.json({
      orderId: order.id,
      orderNumber: order.order_number,
      total: order.total,
      paymentStatus: order.payment_status,
      orderStatus: order.order_status
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request data", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Order creation error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
