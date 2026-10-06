export type DeliveryStatusInput = {
  status: string | null;
  tracking_reference?: string | null;
  scheduled_at?: string | null;
  delivered_at?: string | null;
  address?: Record<string, unknown> | null;
};

export function buildDeliveryStatusSummary(delivery: DeliveryStatusInput) {
  const status = getDeliveryStatusLabel(delivery.status);
  const tracking = delivery.tracking_reference?.trim() || "Tracking pending";
  const window = getDeliveryWindow(delivery.address, delivery.scheduled_at, delivery.delivered_at, delivery.status);
  const proof = getProofOfDelivery(delivery.delivered_at, delivery.status);

  return {
    label: status,
    tracking,
    window,
    proof
  };
}

function getDeliveryStatusLabel(status: string | null) {
  if (!status) return "Delivery pending";
  const normalized = status.toUpperCase();
  if (normalized === "PENDING") return "Delivery pending";
  if (normalized === "ASSIGNED") return "Assigned";
  if (normalized === "PICKED_UP") return "Picked up";
  if (normalized === "OUT_FOR_DELIVERY") return "Out for delivery";
  if (normalized === "DELIVERED") return "Delivered";
  if (normalized === "FAILED") return "Delivery failed";
  if (normalized === "CANCELLED") return "Cancelled";
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getDeliveryWindow(address: Record<string, unknown> | null | undefined, scheduledAt?: string | null, deliveredAt?: string | null, status?: string | null) {
  const city = typeof address?.city === "string" ? address.city : "Your delivery address";
  const area = typeof address?.area === "string" ? address.area : typeof address?.town === "string" ? address.town : typeof address?.county === "string" ? address.county : "your area";

  if ((status ?? "").toUpperCase() === "DELIVERED") {
    const date = deliveredAt ? formatDate(deliveredAt) : "Delivered";
    return `${city}, ${area} · ${date}`;
  }

  if (scheduledAt) {
    return `${city}, ${area} · ETA ${formatDate(scheduledAt)}`;
  }

  return `${city}, ${area} · Awaiting dispatch`;
}

function getProofOfDelivery(deliveredAt?: string | null, status?: string | null) {
  if ((status ?? "").toUpperCase() !== "DELIVERED") {
    return "Proof of delivery pending";
  }

  return deliveredAt ? `Proof of delivery recorded on ${formatDate(deliveredAt)}` : "Proof of delivery recorded";
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-KE", { day: "2-digit", month: "short", year: "numeric" });
}
