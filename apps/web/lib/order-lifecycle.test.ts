import { describe, expect, it } from "vitest";
import { buildOrderLifecycleTimeline, getOrderLifecycleStages, getOrderStatusLabel } from "./order-lifecycle";

describe("order lifecycle", () => {
  it("uses a consistent lifecycle for order progress", () => {
    expect(getOrderStatusLabel("OUT_FOR_DELIVERY")).toBe("Out for delivery");
    expect(getOrderStatusLabel("READY_FOR_DELIVERY")).toBe("Ready for delivery");
    expect(getOrderLifecycleStages("DELIVERED")).toEqual([
      "PENDING",
      "PROCESSING",
      "READY_FOR_DELIVERY",
      "OUT_FOR_DELIVERY",
      "DELIVERED"
    ]);
  });

  it("tracks pickup orders through collection without a delivery dispatch stage", () => {
    expect(buildOrderLifecycleTimeline("READY_FOR_PICKUP", "pickup")).toEqual([
      { stage: "PENDING", label: "Order received", complete: true },
      { stage: "PROCESSING", label: "Processing", complete: true },
      { stage: "READY_FOR_PICKUP", label: "Ready for pickup", complete: true },
      { stage: "DELIVERED", label: "Delivered", complete: false }
    ]);
  });
});
