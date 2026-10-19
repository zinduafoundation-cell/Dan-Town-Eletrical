import { describe, expect, it } from "vitest";
import { summarizeCashSession } from "./cash-session";

describe("POS cash session summary", () => {
  it("uses the server-reconciled expected amount and reports the count variance", () => {
    const summary = summarizeCashSession({
      openingFloat: 4000,
      cashSales: 1750,
      countedCash: 5700,
      expectedCash: 5600
    });

    expect(summary.expected).toBe(5600);
    expect(summary.variance).toBe(100);
    expect(summary.isHealthy).toBe(true);
  });

  it("computes a fallback estimate when no server-reconciled amount is available", () => {
    const summary = summarizeCashSession({
      openingFloat: 4000,
      cashSales: 1750,
      countedCash: 5500
    });

    expect(summary.expected).toBe(5750);
    expect(summary.variance).toBe(-250);
    expect(summary.isHealthy).toBe(false);
    expect(summary.message).toContain("Cash short");
  });
});
