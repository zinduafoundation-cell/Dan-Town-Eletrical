import { NextResponse } from "next/server";

import { requireAuthorizedPermission } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAuthorizedPermission("orders.read");

    const supabase = createSupabaseServiceClient();
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: orders, error } = await supabase
      .from("orders")
      .select("id, order_number, order_status, created_at, total, customer_id")
      .in("order_status", ["PENDING", "PAYMENT_PENDING", "PAID", "PROCESSING"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Order attention query failed", error);
      return NextResponse.json({ error: "Unable to load order alerts." }, { status: 500 });
    }

    const customerIds = [...new Set((orders ?? []).map((order) => order.customer_id).filter(Boolean))] as string[];
    const customerMap = new Map<string, string>();

    if (customerIds.length) {
      const { data: customers, error: customerError } = await supabase
        .from("customers")
        .select("id, name")
        .in("id", customerIds);

      if (customerError) {
        console.error("Customer lookup for order alerts failed", customerError);
      } else {
        for (const customer of customers ?? []) {
          if (customer.id) customerMap.set(customer.id, customer.name ?? "Guest customer");
        }
      }
    }

    const friendlyOrders = (orders ?? []).map((order) => ({
      ...order,
      customer_name: order.customer_id ? customerMap.get(order.customer_id) ?? "Guest customer" : "Guest customer"
    }));

    return NextResponse.json({ orders: friendlyOrders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load order alerts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
