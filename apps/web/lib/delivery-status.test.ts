import { describe, expect, it } from "vitest";
import { buildDeliveryStatusSummary } from "./delivery-status";

describe("buildDeliveryStatusSummary", () => {
  it("formats an active delivery in progress with tracking and ETA", () => {
    const summary = buildDeliveryStatusSummary({
      status: "OUT_FOR_DELIVERY",
      tracking_reference: "DT-DR-1042",
      scheduled_at: "2026-10-06T15:30:00.000Z",
      delivered_at: null,
      address: { city: "Nairobi", area: "Westlands" }
    });

    expect(summary.label).toBe("Out for delivery");
    expect(summary.tracking).toBe("DT-DR-1042");
    expect(summary.window).toContain("Westlands");
  });

  it("returns a completed delivery summary when the parcel is delivered", () => {
    const summary = buildDeliveryStatusSummary({
      status: "DELIVERED",
      tracking_reference: "DT-DR-1043",
      scheduled_at: null,
      delivered_at: "2026-10-05T10:00:00.000Z",
      address: { city: "Mombasa", area: "Nyali" }
    });

    expect(summary.label).toBe("Delivered");
    expect(summary.window).toContain("Nyali");
    expect(summary.proof).toContain("5 Oct");
  });
});
