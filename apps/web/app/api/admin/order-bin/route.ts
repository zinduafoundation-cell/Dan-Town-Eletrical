import { NextResponse } from "next/server";

import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedPermission("orders.read");

    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, action, resource_id, created_at, new_data")
      .in("action", ["ORDER_DELETED", "ORDER_DELETED_BY_ADMIN", "ORDER_AUTO_DELETED"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("Order bin query failed", error);
      return NextResponse.json({ error: "Unable to load deleted-order archive." }, { status: 500 });
    }

    const archive = (data ?? []).map((entry) => {
      const payload = ((entry.new_data as Record<string, unknown>) ?? {}) as Record<string, unknown>;
      return {
        id: entry.id,
        orderId: entry.resource_id,
        orderNumber: String(payload.order_number ?? "Unknown order"),
        deletedAt: String(payload.deleted_at ?? entry.created_at ?? ""),
        deletedByRole: String(payload.deleted_by_role ?? "system"),
        reason: String(payload.reason ?? entry.action),
        channel: String(payload.sales_channel ?? "UNKNOWN"),
        total: Number(payload.total ?? 0),
      };
    });

    return NextResponse.json({ orders: archive });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load deleted-order archive.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
