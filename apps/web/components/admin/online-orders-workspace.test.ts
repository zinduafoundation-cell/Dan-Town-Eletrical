import { describe, expect, it } from "vitest";
import { matchesOrderView, type OrderView } from "../../lib/order-view";

describe("matchesOrderView", () => {
  const cases: Array<[OrderView, string, boolean]> = [
    ["all", "CANCELLED", true],
    ["pending", "PAYMENT_PENDING", true],
    ["pending", "PROCESSING", false],
    ["processing", "READY_FOR_DELIVERY", true],
    ["processing", "DELIVERED", false],
    ["completed", "DELIVERED", true],
    ["cancelled", "CANCELLED", true],
    ["cancelled", "REFUNDED", false],
    ["returns", "PARTIALLY_REFUNDED", true],
    ["returns", "FAILED", false],
  ];

  it.each(cases)("classifies %s view for %s as %s", (view, orderStatus, expected) => {
    expect(matchesOrderView({ orderStatus }, view)).toBe(expected);
  });
});
