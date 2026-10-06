import { describe, expect, it } from "vitest";
import {
  closeCashSession,
  createCashSession,
  recordCashSale,
  summarizeCashSession
} from "./cash-session";

describe("POS cash session", () => {
  it("tracks the expected cash box total and variance", () => {
    let session = createCashSession(4000);
    session = recordCashSale(session, 1750);
    const summary = summarizeCashSession({
      ...session,
      countedCash: 5900
    });

    expect(session.cashSales).toBe(1750);
    expect(summary.expected).toBe(5750);
    expect(summary.variance).toBe(150);
    expect(summary.isHealthy).toBe(true);
  });

  it("marks the session as closed when the physical cash count is recorded", () => {
    const session = closeCashSession(createCashSession(2500), 5300, "Shift closed");
    expect(session.status).toBe("closed");
    expect(session.closedAt).not.toBeNull();
    expect(session.notes).toBe("Shift closed");
  });
});
