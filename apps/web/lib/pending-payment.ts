export const PENDING_PAYMENT_STORAGE_KEY = "dantown-pending-payment";
const CLEAR_EVENT = "dantown:pending-payment-cleared";

export type PendingPaymentReminderData = {
  orderId: string;
  orderNumber: string;
  total: number;
  createdAt?: string;
  /** The signed-in account that created the order. Reminders are never shown to anyone else. */
  userId?: string | null;
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
  try {
    window.localStorage.removeItem(PENDING_PAYMENT_STORAGE_KEY);
    window.dispatchEvent(new Event(CLEAR_EVENT));
  } catch {
    // Storage can be unavailable in private browsing; nothing to clear then.
  }
}

/** Call on sign-out so nothing belonging to the previous account is left on the device. */
export function clearAccountScopedBrowserData() {
  if (typeof window === "undefined") return;
  clearPendingPaymentReminder();
  try {
    window.sessionStorage.removeItem("dantown-entry-seen-v1");
  } catch {
    // ignore
  }
}

export function onPendingPaymentCleared(listener: () => void) {
  window.addEventListener(CLEAR_EVENT, listener);
  return () => window.removeEventListener(CLEAR_EVENT, listener);
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
      userId: parsed.userId ?? null,
    };
  } catch {
    clearPendingPaymentReminder();
    return null;
  }
}
