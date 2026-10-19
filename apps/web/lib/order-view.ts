export type OrderView = "all" | "pending" | "processing" | "completed" | "cancelled" | "returns";

export function matchesOrderView(order: { orderStatus: string }, view: OrderView) {
  if (view === "all") return true;
  if (view === "pending") return ["PENDING", "PAYMENT_PENDING"].includes(order.orderStatus);
  if (view === "processing") return ["PAID", "PROCESSING", "READY_FOR_PICKUP", "READY_FOR_DELIVERY", "OUT_FOR_DELIVERY"].includes(order.orderStatus);
  if (view === "completed") return order.orderStatus === "DELIVERED";
  if (view === "cancelled") return order.orderStatus === "CANCELLED";
  return ["REFUNDED", "PARTIALLY_REFUNDED"].includes(order.orderStatus);
}
