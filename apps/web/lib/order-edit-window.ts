export const ORDER_EDIT_WINDOW_MINUTES = 30;
export const ORDER_EDIT_WINDOW_MS = ORDER_EDIT_WINDOW_MINUTES * 60 * 1000;

const TERMINAL_ORDER_STATUSES = new Set([
  "CANCELLED",
  "DELIVERED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "FAILED",
  "PAYMENT_FAILED",
  "RETURNED"
]);

export function getOrderEditWindow(createdAt: string | Date | null | undefined): Date | null {
  if (!createdAt) return null;

  const created = createdAt instanceof Date ? createdAt : new Date(createdAt);
  if (Number.isNaN(created.getTime())) return null;

  return new Date(created.getTime() + ORDER_EDIT_WINDOW_MS);
}

export function isOrderModifiable(status: string | null | undefined, createdAt: string | Date | null | undefined): boolean {
  if (!createdAt) return false;
  const normalized = status?.toUpperCase();
  if (!normalized || TERMINAL_ORDER_STATUSES.has(normalized)) return false;

  const expiresAt = getOrderEditWindow(createdAt);
  if (!expiresAt) return false;

  return Date.now() <= expiresAt.getTime();
}

export function getOrderEditExpiryLabel(createdAt: string | Date | null | undefined): string | null {
  const expiresAt = getOrderEditWindow(createdAt);
  if (!expiresAt) return null;
  return expiresAt.toLocaleString("en-KE", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}
