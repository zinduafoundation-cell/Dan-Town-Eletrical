"use client";

import { useMemo, useState } from "react";
import { Clock3, Trash2, XCircle } from "lucide-react";
import { clearPendingPaymentReminder } from "@/lib/pending-payment";
import { getOrderEditExpiryLabel, isOrderModifiable } from "@/lib/order-edit-window";

export function OrderManagementActions({
  orderId,
  orderStatus,
  createdAt,
  isAdmin = false,
  onUpdated,
}: {
  orderId: string;
  orderStatus: string | null;
  createdAt: string | null;
  isAdmin?: boolean;
  onUpdated?: () => void;
}) {
  const [isLoading, setIsLoading] = useState<"cancel" | "delete" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canModify = useMemo(() => isOrderModifiable(orderStatus, createdAt), [orderStatus, createdAt]);
  const expiryLabel = useMemo(() => getOrderEditExpiryLabel(createdAt), [createdAt]);

  async function runAction(path: string, action: "cancel" | "delete") {
    try {
      setIsLoading(action);
      setError(null);
      setMessage(null);

      const response = await fetch(path, {
        method: action === "cancel" ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: action === "cancel" ? JSON.stringify({ reason: "Customer requested cancellation" }) : undefined,
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Unable to ${action} this order.`);
      }

      if (action === "delete") {
        clearPendingPaymentReminder();
      }

      setMessage(action === "cancel" ? "Order cancelled." : "Order deleted.");
      onUpdated?.();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong.");
    } finally {
      setIsLoading(null);
    }
  }

  return (
    <div className="order-management-actions">
      <div className="order-management-meta">
        {canModify ? (
          <span className="order-edit-window"><Clock3 size={14} /> Editable until {expiryLabel}</span>
        ) : (
          <span className="order-edit-window locked">Edit window expired</span>
        )}
      </div>

      {message && <p className="order-action-message success">{message}</p>}
      {error && <p className="order-action-message error">{error}</p>}

      {(canModify || isAdmin) && (
        <div className="order-action-buttons">
          <button
            type="button"
            className="button secondary"
            onClick={() => runAction(`/api/orders/${orderId}/cancel`, "cancel")}
            disabled={isLoading !== null || (!canModify && !isAdmin)}
          >
            <XCircle size={15} /> {isLoading === "cancel" ? "Cancelling..." : "Cancel order"}
          </button>

          <button
            type="button"
            className="button danger"
            onClick={() => runAction(`/api/orders/${orderId}/delete`, "delete")}
            disabled={isLoading !== null || (!canModify && !isAdmin)}
          >
            <Trash2 size={15} /> {isLoading === "delete" ? "Deleting..." : "Delete order"}
          </button>
        </div>
      )}
    </div>
  );
}
