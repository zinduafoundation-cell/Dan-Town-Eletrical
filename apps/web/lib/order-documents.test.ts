import { describe, expect, it } from "vitest";
import { buildOrderDocumentSummary } from "./order-documents";

describe("buildOrderDocumentSummary", () => {
  it("formats the latest receipt and invoice summary for a paid order", () => {
    const summary = buildOrderDocumentSummary({
      order_number: "DT-1004",
      total: 24500,
      payment_status: "PAID",
      order_status: "DELIVERED",
      created_at: "2026-10-01T08:00:00.000Z"
    });

    expect(summary.label).toBe("DT-1004");
    expect(summary.documentType).toBe("Invoice & receipt");
    expect(summary.amount).toBe("KSh 24,500");
    expect(summary.status).toBe("Delivered");
  });

  it("falls back to a pending receipt label when no invoice number is available", () => {
    const summary = buildOrderDocumentSummary({
      order_number: null,
      total: 0,
      payment_status: "PENDING",
      order_status: "PROCESSING",
      created_at: "2026-10-02T10:00:00.000Z"
    });

    expect(summary.label).toBe("Receipt pending");
    expect(summary.documentType).toBe("Receipt summary");
    expect(summary.status).toBe("Processing");
  });
});
