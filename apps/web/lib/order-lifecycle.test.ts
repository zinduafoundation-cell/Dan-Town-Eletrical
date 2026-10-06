import { describe, expect, it } from "vitest";
import { getOrderLifecycleStages, getOrderStatusLabel } from "./order-lifecycle";

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
});
