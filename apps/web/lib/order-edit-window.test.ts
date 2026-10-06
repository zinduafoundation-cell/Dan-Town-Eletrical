import { describe, expect, it } from "vitest";
import {
  getCancelledOrderAutoDeleteWindow,
  getOrderEditWindow,
  isCancelledOrderReadyForDeletion,
  isOrderModifiable
} from "./order-edit-window";

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

  it("marks cancelled orders for automatic deletion only after six hours have elapsed", () => {
    const cancelledAt = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const expiredCancelledAt = new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString();

    expect(isCancelledOrderReadyForDeletion("CANCELLED", cancelledAt)).toBe(false);
    expect(isCancelledOrderReadyForDeletion("CANCELLED", expiredCancelledAt)).toBe(true);
    expect(isCancelledOrderReadyForDeletion("PENDING", cancelledAt)).toBe(false);
    expect(getCancelledOrderAutoDeleteWindow(cancelledAt)?.getTime()).toBeGreaterThan(Date.now() - 5 * 60 * 60 * 1000);
  });
});
