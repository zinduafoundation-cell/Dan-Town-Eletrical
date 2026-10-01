import { describe, expect, it } from "vitest";
import { parseCentreCommand } from "./command-parser";

describe("Dantown Centre command parsing", () => {
  it("maps safe operational questions to controlled read handlers", () => {
    expect(parseCentreCommand("What needs my attention today?").kind).toBe("attention");
    expect(parseCentreCommand("Show unpaid orders").kind).toBe("unpaid-orders");
    expect(parseCentreCommand("Find products below minimum stock").kind).toBe("low-stock");
    expect(parseCentreCommand("Show today’s sales").kind).toBe("sales");
  });

  it("holds data-changing language for a protected workspace", () => {
    expect(parseCentreCommand("Refund the latest order").kind).toBe("approval-required");
    expect(parseCentreCommand("Transfer stock to the shop").kind).toBe("approval-required");
  });
});
