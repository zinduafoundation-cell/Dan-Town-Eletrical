"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Truck } from "lucide-react";
import { getOrderStatusLabel } from "@/lib/order-lifecycle";

type FulfillmentStatus = "PROCESSING" | "READY_FOR_DELIVERY" | "OUT_FOR_DELIVERY" | "DELIVERED";

type FulfillmentType = "pickup" | "delivery";
type FulfillmentActionStatus = FulfillmentStatus | "READY_FOR_PICKUP";

const nextSteps: Record<FulfillmentType, Record<string, { status: FulfillmentActionStatus; label: string } | undefined>> = {
  delivery: {
    PENDING: { status: "PROCESSING", label: "Start processing" },
    PAID: { status: "PROCESSING", label: "Start processing" },
    PROCESSING: { status: "READY_FOR_DELIVERY", label: "Mark ready for delivery" },
    READY_FOR_DELIVERY: { status: "OUT_FOR_DELIVERY", label: "Dispatch order" },
    OUT_FOR_DELIVERY: { status: "DELIVERED", label: "Mark delivered" }
  },
  pickup: {
    PENDING: { status: "PROCESSING", label: "Start processing" },
    PAID: { status: "PROCESSING", label: "Start processing" },
    PROCESSING: { status: "READY_FOR_PICKUP", label: "Mark ready for pickup" },
    READY_FOR_PICKUP: { status: "DELIVERED", label: "Confirm customer pickup" }
  }
};

export function OrderFulfillmentActions({
  orderId,
  orderStatus,
  fulfillmentType,
  deliveryMethod,
  carrier,
  trackingReference,
  isAdmin
}: {
  orderId: string;
  orderStatus: string;
  fulfillmentType: FulfillmentType;
  deliveryMethod: string | null;
  carrier: string | null;
  trackingReference: string | null;
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [method, setMethod] = useState(deliveryMethod ?? "");
  const [carrierName, setCarrierName] = useState(carrier ?? "");
  const [tracking, setTracking] = useState(trackingReference ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const step = nextSteps[fulfillmentType][orderStatus];
  const needsDeliveryDetails = fulfillmentType === "delivery" && (
    step?.status === "READY_FOR_DELIVERY" || step?.status === "OUT_FOR_DELIVERY"
  );

  if (!isAdmin || !step) {
    return (
      <div className="order-delivery-summary">
        <Truck size={15} />
        <span>
          {deliveryMethod || "Transport not set"}
          {carrier ? ` · ${carrier}` : ""}
          {trackingReference ? ` · ${trackingReference}` : ""}
        </span>
      </div>
    );
  }

  async function advanceStatus() {
    try {
      setIsSaving(true);
      setError(null);
      setWarning(null);
      setMessage(null);
      const response = await fetch(`/api/orders/${orderId}/fulfillment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: step.status,
          deliveryMethod: method,
          carrier: carrierName,
          trackingReference: tracking
        })
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        throw new Error(result?.error || "Unable to update this order.");
      }
      setMessage(getOrderStatusLabel(step.status));
      setWarning(result.notificationWarning ?? null);
      router.refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to update this order.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="order-fulfillment-actions">
      {needsDeliveryDetails && (
        <div className="order-fulfillment-fields">
          <label>
            Transport method
            <input value={method} onChange={(event) => setMethod(event.target.value)} maxLength={80} placeholder="e.g. Dantown van or courier" />
          </label>
          <label>
            Carrier / driver
            <input value={carrierName} onChange={(event) => setCarrierName(event.target.value)} maxLength={120} placeholder="Carrier or driver name" />
          </label>
          <label>
            Tracking reference
            <input value={tracking} onChange={(event) => setTracking(event.target.value)} maxLength={160} placeholder="Optional tracking number" />
          </label>
        </div>
      )}
      <button
        className="button button-primary"
        type="button"
        onClick={advanceStatus}
        disabled={isSaving || (needsDeliveryDetails && (!method.trim() || !carrierName.trim()))}
      >
        {isSaving ? "Updating..." : step.label}
        {!isSaving && <ArrowRight size={15} />}
      </button>
      {message && <p className="order-action-message success" role="status">{message}</p>}
      {warning && <p className="order-action-message warning" role="status">{warning}</p>}
      {error && <p className="order-action-message error" role="alert">{error}</p>}
    </div>
  );
}
