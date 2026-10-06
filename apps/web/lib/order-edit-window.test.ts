import { describe, expect, it } from "vitest";
import { getOrderEditWindow, isOrderModifiable } from "./order-edit-window";

describe("order edit window", () => {
  it("keeps pending orders modifiable within the customer action window", () => {
    const createdAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    expect(isOrderModifiable("PENDING", createdAt)).toBe(true);
    expect(getOrderEditWindow(createdAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("locks the order once the edit window ends or the order is no longer actionable", () => {
    const createdAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();

    expect(isOrderModifiable("PENDING", createdAt)).toBe(false);
    expect(isOrderModifiable("DELIVERED", createdAt)).toBe(false);
  });
});
