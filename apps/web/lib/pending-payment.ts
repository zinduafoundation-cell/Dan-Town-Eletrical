export const PENDING_PAYMENT_STORAGE_KEY = "dantown-pending-payment";

export type PendingPaymentReminderData = {
  orderId: string;
  orderNumber: string;
  total: number;
  createdAt?: string;
};

export function savePendingPaymentReminder(payload: PendingPaymentReminderData) {
  if (typeof window === "undefined") return;

  try {
    const nextValue = {
      ...payload,
      total: Number(payload.total ?? 0),
      createdAt: payload.createdAt ?? new Date().toISOString(),
    };
    window.localStorage.setItem(PENDING_PAYMENT_STORAGE_KEY, JSON.stringify(nextValue));
  } catch {
    window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
  }
}

export function clearPendingPaymentReminder() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
}

export function readPendingPaymentReminder(): PendingPaymentReminderData | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PENDING_PAYMENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PendingPaymentReminderData>;
    if (!parsed.orderId || !parsed.orderNumber) {
      clearPendingPaymentReminder();
      return null;
    }

    const createdAt = parsed.createdAt ? new Date(parsed.createdAt).getTime() : 0;
    if (createdAt && Date.now() - createdAt > 12 * 60 * 60 * 1000) {
      clearPendingPaymentReminder();
      return null;
    }

    return {
      orderId: parsed.orderId,
      orderNumber: parsed.orderNumber,
      total: Number(parsed.total ?? 0),
      createdAt: parsed.createdAt ?? new Date().toISOString(),
    };
  } catch {
    clearPendingPaymentReminder();
    return null;
  }
}
