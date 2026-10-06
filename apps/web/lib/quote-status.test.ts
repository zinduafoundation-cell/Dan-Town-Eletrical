import { describe, expect, it } from "vitest";
import { buildQuoteStatusSummary } from "./quote-status";

describe("buildQuoteStatusSummary", () => {
  it("returns a polished public-facing summary for an approved quote", () => {
    const summary = buildQuoteStatusSummary({
      status: "APPROVED",
      total: 54000,
      valid_until: "2026-11-30T00:00:00.000Z"
    });

    expect(summary.label).toBe("Approved");
    expect(summary.amount).toBe("KSh 54,000");
    expect(summary.validity).toContain("30 Nov");
  });

  it("falls back cleanly when the quote is still pending", () => {
    const summary = buildQuoteStatusSummary({
      status: null,
      total: null,
      valid_until: null
    });

    expect(summary.label).toBe("Pending review");
    expect(summary.amount).toBe("KSh 0");
    expect(summary.validity).toBe("No validity date yet");
  });
});
