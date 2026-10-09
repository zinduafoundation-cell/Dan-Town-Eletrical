import { NextResponse } from "next/server";
import { z } from "zod";
import type { OrderStatus } from "@dantown/database";
import { requireAuthorizedPermission } from "@/lib/auth/server";
import { getOrderStatusLabel } from "@/lib/order-lifecycle";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

const fulfillmentSchema = z.object({
  status: z.enum(["PROCESSING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY", "DELIVERED"]),
  deliveryMethod: z.string().trim().min(1).max(80).optional(),
  carrier: z.string().trim().max(120).optional(),
  trackingReference: z.string().trim().max(160).optional()
});

const nextStatus: Record<"pickup" | "delivery", Record<string, string[]>> = {
  delivery: {
    PENDING: ["PROCESSING"],
    PAID: ["PROCESSING"],
    PROCESSING: ["READY_FOR_DELIVERY"],
    READY_FOR_DELIVERY: ["OUT_FOR_DELIVERY"],
    OUT_FOR_DELIVERY: ["DELIVERED"]
  },
  pickup: {
    PENDING: ["PROCESSING"],
    PAID: ["PROCESSING"],
    PROCESSING: ["READY_FOR_PICKUP"],
    READY_FOR_PICKUP: ["DELIVERED"]
  }
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuthorizedPermission("orders.update");
    const parsed = fulfillmentSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Choose a valid next order status." }, { status: 400 });
    }

    const { id } = await params;
    const supabase = await createSupabaseServerClient();
    const serviceClient = createSupabaseServiceClient();
    const { data: existing, error: lookupError } = await serviceClient
      .from("orders")
      .select("id,order_number,customer_id,order_status,payment_status,notes")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) throw lookupError;
    if (!existing) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    const fulfillmentType = String(existing.notes ?? "").toLowerCase().includes("pickup") ? "pickup" : "delivery";

    if (!(nextStatus[fulfillmentType][existing.order_status] ?? []).includes(parsed.data.status)) {
      return NextResponse.json(
        { error: `Cannot move an order from ${getOrderStatusLabel(existing.order_status)} to ${getOrderStatusLabel(parsed.data.status)}.` },
        { status: 409 }
      );
    }

    if (parsed.data.status === "PROCESSING" && existing.payment_status !== "SUCCESS") {
      return NextResponse.json(
        { error: "Confirm payment before processing this order." },
        { status: 409 }
      );
    }

    const deliveryMethod = parsed.data.deliveryMethod;
    const carrier = parsed.data.carrier?.trim() || null;
    const trackingReference = parsed.data.trackingReference?.trim() || null;
    if (fulfillmentType === "delivery" && parsed.data.status === "READY_FOR_DELIVERY" && (!deliveryMethod || !carrier)) {
      return NextResponse.json(
        { error: "Set the transport method and carrier before marking this order ready." },
        { status: 400 }
      );
    }
    if (fulfillmentType === "delivery" && parsed.data.status === "OUT_FOR_DELIVERY" && (!deliveryMethod || !carrier)) {
      return NextResponse.json(
        { error: "Transport method and carrier are required before dispatch." },
        { status: 400 }
      );
    }

    const update: {
      order_status: OrderStatus;
      delivery_method?: string;
      delivery_carrier?: string | null;
      delivery_tracking_reference?: string | null;
      delivered_at?: string;
    } = { order_status: parsed.data.status };
    if (deliveryMethod) update.delivery_method = deliveryMethod;
    if (carrier) update.delivery_carrier = carrier;
    if (trackingReference !== null) update.delivery_tracking_reference = trackingReference;
    if (parsed.data.status === "DELIVERED") update.delivered_at = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("orders")
      .update(update)
      .eq("id", id)
      .select("id,order_number,order_status,delivery_method,delivery_carrier,delivery_tracking_reference,delivered_at")
      .maybeSingle();
    if (updateError) throw updateError;
    if (!updated) {
      return NextResponse.json(
        { error: "Order was not updated. Check that you have order update access." },
        { status: 403 }
      );
    }

    let notificationWarning: string | null = null;
    try {
      const { data: customer, error: customerError } = existing.customer_id
        ? await serviceClient
            .from("customers")
            .select("user_id")
            .eq("id", existing.customer_id)
            .maybeSingle()
        : { data: null, error: null };
      if (customerError) throw customerError;

      if (customer?.user_id) {
        const statusLabel = getOrderStatusLabel(updated.order_status);
        const deliveryDetails = [
          updated.delivery_method,
          updated.delivery_carrier,
          updated.delivery_tracking_reference
        ].filter(Boolean).join(" · ");
        const { error: notificationError } = await serviceClient.from("notifications").insert({
          user_id: customer.user_id,
          type: parsed.data.status === "OUT_FOR_DELIVERY" || parsed.data.status === "DELIVERED" ? "DELIVERY" : "ORDER",
          title: `Order ${statusLabel.toLowerCase()}`,
          body: `Order ${updated.order_number}: ${statusLabel}.${deliveryDetails ? ` ${deliveryDetails}.` : ""}`,
          read_at: null,
          data: {
            order_id: id,
            order_number: updated.order_number,
            status: updated.order_status,
            href: `/account/orders/${id}`
          }
        });
        if (notificationError) throw notificationError;
      } else {
        notificationWarning = "No linked customer account was available for an in-app notification.";
      }
    } catch (notificationError) {
      console.error("Order status notification failed:", notificationError);
      notificationWarning = "Order status was updated, but the customer notification could not be saved.";
    }

    return NextResponse.json({ success: true, order: updated, notificationWarning });
  } catch (error) {
    console.error("ORDER FULFILLMENT UPDATE ERROR", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update order fulfillment." },
      { status: 500 }
    );
  }
}
