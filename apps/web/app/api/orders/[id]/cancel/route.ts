import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuthenticated } from "../../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/server";
import { isOrderModifiable } from "@/lib/order-edit-window";

const bodySchema = z.object({ reason: z.string().trim().max(240).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticated();
    const { id } = await params;
    const body = bodySchema.safeParse(await request.json().catch(() => ({})));
    if (!body.success) return NextResponse.json({ error: "Invalid cancellation reason." }, { status: 400 });

    const supabase = createSupabaseServiceClient();
    const { data: order, error: lookupError } = await supabase.from("orders").select("id,created_by,sales_channel,order_status,created_at").eq("id", id).maybeSingle();
    if (lookupError || !order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const isPrivileged = context.roles.includes("ADMIN") || context.roles.includes("SALES_MANAGER") || context.roles.includes("STORE_MANAGER") || context.permissions.includes("orders.update");
    if (!isPrivileged && context.userId !== order.created_by) return NextResponse.json({ error: "You cannot cancel this order." }, { status: 403 });
    if (!isPrivileged && !isOrderModifiable(order.order_status, order.created_at)) {
      return NextResponse.json({ error: "This order is outside the edit window and can no longer be cancelled." }, { status: 403 });
    }

    const { data: cancelled, error } = await supabase.rpc("release_online_order", { order_id: id, release_reason: body.data.reason || "Order cancelled by customer" });
    if (error || !cancelled) return NextResponse.json({ error: error?.message || "Unable to cancel order." }, { status: 400 });

    const { error: auditError } = await supabase.from("audit_logs").insert({
      user_id: context.userId === "dev-bypass-user" ? null : context.userId,
      action: isPrivileged ? "ORDER_CANCELLED_BY_ADMIN" : "ORDER_CANCELLED",
      resource_type: "order",
      resource_id: id,
      new_data: {
        order_number: cancelled.order_number ?? order.id,
        cancelled_by: context.userId,
        release_reason: body.data.reason || "Order cancelled by customer",
        cancelled_at: new Date().toISOString()
      }
    });
    if (auditError) {
      console.error("ORDER CANCEL AUDIT ERROR", auditError);
    }

    if (order.created_by) {
      const notificationTitle = "Order status updated";
      const notificationBody = `Your order ${cancelled.order_number ?? order.id} has been cancelled. It will be removed automatically after 6 hours.`;
      const { error: notificationError } = await supabase.from("notifications").insert({
        user_id: order.created_by,
        type: "ORDER",
        title: notificationTitle,
        body: notificationBody,
        read_at: null,
        data: {
          order_id: id,
          order_number: cancelled.order_number ?? order.id,
          status: "CANCELLED",
          href: `/account/orders/${id}`
        }
      });

      if (notificationError) {
        console.error("Order cancellation notification failed", notificationError.message);
      }
    }

    return NextResponse.json({ success: true, order: cancelled });
  } catch (error) {
    console.error("ORDER CANCELLATION ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to cancel order." }, { status: 500 });
  }
}
