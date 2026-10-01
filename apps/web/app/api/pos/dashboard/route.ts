import { NextResponse } from "next/server";
import { getPermissionGuard } from "@/lib/auth/server";
import { createSupabaseServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const guard = await getPermissionGuard("orders.read");
    if (!guard.ok) {
      return NextResponse.json({ error: guard.message }, { status: guard.status });
    }

    const supabase = createSupabaseServiceClient();

    const today = new Date().toISOString().split("T")[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];

    // Get all orders from today
    const { data: ordersToday, error: ordersError } = await supabase
      .from("orders")
      .select("id, order_number, total, payment_status, created_at")
      .gte("created_at", `${today}T00:00:00Z`)
      .lt("created_at", `${tomorrow}T00:00:00Z`);

    if (ordersError) throw ordersError;

    const orderIds = (ordersToday ?? []).map((order) => order.id);
    const [{ data: paymentsToday, error: paymentsError }, { data: inventoryRows, error: inventoryError }] = await Promise.all([
      orderIds.length
        ? supabase.from("payments").select("order_id, amount, method, status").in("order_id", orderIds)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("inventory").select("quantity, reserved_quantity, reorder_level")
    ]);

    if (paymentsError) throw paymentsError;
    if (inventoryError) throw inventoryError;

    // Calculate metrics
    const todaysSales = (ordersToday ?? [])
      .filter((o) => o.payment_status === "SUCCESS")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);

    const successfulPayments = (paymentsToday ?? []).filter((payment) => payment.status === "SUCCESS");
    const cashSales = successfulPayments
      .filter((payment) => payment.method === "CASH")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const mPesaSales = successfulPayments
      .filter((payment) => payment.method === "MPESA")
      .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    const transactions = (ordersToday ?? []).filter((o) => o.payment_status === "SUCCESS").length;
    const averageSale = transactions > 0 ? Math.round(todaysSales / transactions) : 0;
    const pendingSync = 0; // Offline queue count (future)
    const recentSales = (ordersToday ?? [])
      .filter((order) => order.payment_status === "SUCCESS")
      .sort((first, second) => new Date(second.created_at).getTime() - new Date(first.created_at).getTime())
      .slice(0, 5)
      .map((order) => ({
        id: order.id,
        orderNumber: order.order_number,
        total: Math.round(Number(order.total || 0)),
        createdAt: order.created_at
      }));
    const lowStockCount = (inventoryRows ?? []).filter(
      (row) => Number(row.quantity || 0) - Number(row.reserved_quantity || 0) <= Number(row.reorder_level || 0)
    ).length;

    return NextResponse.json({
      todaysSales: Math.round(todaysSales),
      transactions,
      cashSales: Math.round(cashSales),
      mPesaSales: Math.round(mPesaSales),
      averageSale,
      pendingSync,
      lowStockCount,
      recentSales
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { error: "Failed to fetch dashboard metrics" },
      { status: 500 }
    );
  }
}
