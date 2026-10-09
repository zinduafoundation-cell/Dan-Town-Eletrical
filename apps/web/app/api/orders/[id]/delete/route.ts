import { NextResponse } from "next/server";
import { requireAuthenticated } from "../../../../../lib/auth/server";
import { createSupabaseServiceClient } from "../../../../../lib/supabase/server";
import { isOrderModifiable } from "@/lib/order-edit-window";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const context = await requireAuthenticated();
    const { id } = await params;
    const supabase = createSupabaseServiceClient();

    const { data: order, error: lookupError } = await supabase
      .from("orders")
      .select("id, created_by, order_number, order_status, created_at, total, sales_channel")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      console.error("ORDER DELETE LOOKUP ERROR", lookupError);
      return NextResponse.json({ error: "Unable to verify this order before deletion." }, { status: 500 });
    }

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isPrivileged = context.roles.includes("ADMIN") || context.roles.includes("SALES_MANAGER") || context.roles.includes("STORE_MANAGER") || context.permissions.includes("orders.update");
    if (!isPrivileged && context.userId !== order.created_by) {
      return NextResponse.json({ error: "You cannot delete this order." }, { status: 403 });
    }

    if (!isPrivileged && !isOrderModifiable(order.order_status, order.created_at)) {
      return NextResponse.json({ error: "This order is outside the edit window and cannot be deleted." }, { status: 403 });
    }

    const { error: archiveError } = await supabase.rpc("archive_and_delete_order", {
      p_order_id: id,
      p_actor_user_id: context.userId === "dev-bypass-user" ? null : context.userId,
      p_action: isPrivileged ? "ORDER_DELETED_BY_ADMIN" : "ORDER_DELETED",
      p_metadata: {
        deleted_by: context.userId,
        deleted_by_role: isPrivileged ? "admin" : "customer",
        reason: isPrivileged ? "admin_delete" : "customer_delete",
        deleted_at: new Date().toISOString()
      }
    });
    if (archiveError) {
      console.error("ORDER DELETE AND ARCHIVE ERROR", archiveError);
      if (archiveError.message.includes("Order not found")) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }
      const hasProtectedReferences = archiveError.code === "23503";
      return NextResponse.json(
        {
          error: hasProtectedReferences
            ? "This order has linked payment or fulfillment records and cannot be deleted. No data was changed."
            : "Unable to archive and delete this order. No data was changed."
        },
        { status: hasProtectedReferences ? 409 : 500 }
      );
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("ORDER DELETE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete order." }, { status: 500 });
  }
}
