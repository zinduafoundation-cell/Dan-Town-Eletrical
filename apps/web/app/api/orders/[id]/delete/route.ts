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
      .select("id, created_by, order_number, order_status, created_at")
      .eq("id", id)
      .maybeSingle();

    if (lookupError || !order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isPrivileged = context.roles.includes("ADMIN") || context.roles.includes("SALES_MANAGER") || context.roles.includes("STORE_MANAGER") || context.permissions.includes("orders.update");
    if (!isPrivileged && context.userId !== order.created_by) {
      return NextResponse.json({ error: "You cannot delete this order." }, { status: 403 });
    }

    if (!isPrivileged && !isOrderModifiable(order.order_status, order.created_at)) {
      return NextResponse.json({ error: "This order is outside the edit window and cannot be deleted." }, { status: 403 });
    }

    await supabase.from("order_items").delete().eq("order_id", id);
    await supabase.from("payments").delete().eq("order_id", id);

    const { error: deleteError } = await supabase.from("orders").delete().eq("id", id);
    if (deleteError) {
      throw deleteError;
    }

    const { error: auditError } = await supabase.from("audit_logs").insert({
      user_id: context.userId === "dev-bypass-user" ? null : context.userId,
      action: isPrivileged ? "ORDER_DELETED_BY_ADMIN" : "ORDER_DELETED",
      resource_type: "order",
      resource_id: id,
      new_data: {
        order_number: order.order_number,
        deleted_by: context.userId,
        deleted_by_role: isPrivileged ? "admin" : "customer",
        reason: isPrivileged ? "admin_delete" : "customer_delete",
        deleted_at: new Date().toISOString()
      }
    });
    if (auditError) {
      console.error("ORDER DELETE AUDIT ERROR", auditError);
    }

    return NextResponse.json({ success: true, deleted: true });
  } catch (error) {
    console.error("ORDER DELETE ERROR", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete order." }, { status: 500 });
  }
}
