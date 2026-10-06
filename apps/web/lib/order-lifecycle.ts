export const ORDER_LIFECYCLE_STAGES = [
  "PENDING",
  "PROCESSING",
  "READY_FOR_DELIVERY",
  "OUT_FOR_DELIVERY",
  "DELIVERED"
] as const;

export type OrderLifecycleStage = typeof ORDER_LIFECYCLE_STAGES[number];

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: "Order received",
  PAYMENT_PENDING: "Payment pending",
  PAID: "Paid",
  PROCESSING: "Processing",
  READY_FOR_PICKUP: "Ready for pickup",
  READY_FOR_DELIVERY: "Ready for delivery",
  OUT_FOR_DELIVERY: "Out for delivery",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
  PARTIALLY_REFUNDED: "Partially refunded",
  FAILED: "Failed",
  PAYMENT_FAILED: "Payment failed",
  RETURNED: "Returned",
  RESCHEDULED: "Rescheduled"
};

export function getOrderStatusLabel(status: string | null | undefined): string {
  if (!status) return "Unknown status";
  return ORDER_STATUS_LABELS[status] ?? status.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeOrderStatus(status: string | null | undefined): string | null {
  if (!status) return null;
  if (status === "READY_FOR_PICKUP") return "READY_FOR_DELIVERY";
  return status;
}

export function getOrderLifecycleStages(currentStatus?: string | null): OrderLifecycleStage[] {
  const normalized = normalizeOrderStatus(currentStatus);
  if (!normalized) return [...ORDER_LIFECYCLE_STAGES];

  const currentIndex = ORDER_LIFECYCLE_STAGES.indexOf(normalized as OrderLifecycleStage);
  if (currentIndex === -1) {
    return [...ORDER_LIFECYCLE_STAGES];
  }

  return ORDER_LIFECYCLE_STAGES.slice(0, currentIndex + 1);
}

export function getCurrentOrderLifecycleIndex(currentStatus?: string | null): number {
  const normalized = normalizeOrderStatus(currentStatus);
  if (!normalized) return -1;
  return ORDER_LIFECYCLE_STAGES.indexOf(normalized as OrderLifecycleStage);
}

export function buildOrderLifecycleTimeline(currentStatus?: string | null) {
  const currentIndex = getCurrentOrderLifecycleIndex(currentStatus);

  return ORDER_LIFECYCLE_STAGES.map((stage, index) => ({
    stage,
    label: getOrderStatusLabel(stage),
    complete: currentIndex >= index
  }));
}
