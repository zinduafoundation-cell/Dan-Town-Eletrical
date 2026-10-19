import { describe, expect, it } from "vitest";
import { summarizePaymentRecords, type RefundSummaryRecord } from "./payment-summary";

describe("AI payment summary", () => {
  it("counts only successful transactions as received", () => {
    const refunds: RefundSummaryRecord[] = [{
      amount: 200,
      paymentId: "cash-one",
      status: "SUCCESS"
    }];
    const summary = summarizePaymentRecords([
      { amount: 300, method: "CASH", status: "PARTIALLY_REFUNDED" },
      { amount: "1200.00", method: "CASH", status: "SUCCESS" },
      { amount: "900.00", method: "MPESA", status: "PENDING" },
      { amount: "500.00", method: "CARD", status: "FAILED" }
    ], refunds, new Map([["cash-one", "CASH"]]));

    expect(summary.verifiedReceivedAmount).toBe(1500);
    expect(summary.verifiedRefundedAmount).toBe(200);
    expect(summary.netOfVerifiedRefunds).toBe(1300);
    expect(summary.verifiedReceivedCount).toBe(2);
    expect(summary.verifiedRefundCount).toBe(1);
    expect(summary.pendingAmount).toBe(900);
    expect(summary.otherUnverifiedCount).toBe(1);
  });

  it("marks a full result window as truncated", () => {
    const records = Array.from({ length: 100 }, () => ({
      amount: 1,
      method: "CASH",
      status: "SUCCESS"
    }));

    expect(summarizePaymentRecords(records).truncated).toBe(true);
  });
});
