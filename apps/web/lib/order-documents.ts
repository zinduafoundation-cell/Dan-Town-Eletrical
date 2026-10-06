export type OrderDocumentSummaryInput = {
  order_number: string | null;
  total: number | string | null;
  payment_status: string | null;
  order_status: string | null;
  created_at?: string | null;
};

export function buildOrderDocumentSummary(order: OrderDocumentSummaryInput) {
  const hasNumber = typeof order.order_number === "string" && order.order_number.trim().length > 0;
  const label = hasNumber ? order.order_number!.trim() : "Receipt pending";
  const status = order.order_status ? formatOrderStatus(order.order_status) : "Processing";
  const isPaid = (order.payment_status ?? "").toUpperCase() === "PAID";

  return {
    label,
    documentType: isPaid ? "Invoice & receipt" : "Receipt summary",
    amount: formatMoney(order.total),
    status,
    date: order.created_at ? new Date(order.created_at).toLocaleDateString("en-KE", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }) : "Date pending"
  };
}

function formatMoney(value: number | string | null) {
  const numericValue = Number(value ?? 0);
  return `KSh ${Number.isFinite(numericValue) ? numericValue.toLocaleString("en-KE") : "0"}`;
}

function formatOrderStatus(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("deliver")) return "Delivered";
  if (normalized.includes("cancel")) return "Cancelled";
  if (normalized.includes("ship")) return "Shipped";
  if (normalized.includes("process")) return "Processing";
  if (normalized.includes("out_for_delivery")) return "Out for delivery";
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
