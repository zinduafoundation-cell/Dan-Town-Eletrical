import { describe, expect, it } from "vitest";
import { calculateBusinessDocumentAmounts } from "./business-document-amounts";

describe("business document amount calculations", () => {
  it("rounds decimal half-cent line amounts consistently before summing", () => {
    expect(calculateBusinessDocumentAmounts([
      { quantity: 3, unitPrice: 0.335 },
      { quantity: 2, unitPrice: 0.335 },
    ], 0, 0)).toEqual({
      ok: true,
      amounts: { lineTotals: [1.01, 0.67], subtotal: 1.68, discount: 0, tax: 0, total: 1.68 },
    });
  });

  it("rejects discounts above subtotal and totals over the supported limit", () => {
    expect(calculateBusinessDocumentAmounts([{ quantity: 1, unitPrice: 10 }], 10.01, 0)).toEqual({
      ok: false,
      error: "Discount cannot exceed the line-item subtotal.",
    });
    expect(calculateBusinessDocumentAmounts([{ quantity: 1, unitPrice: 1000000000 }], 0, 0)).toEqual({
      ok: false,
      error: "Document total is above the supported limit.",
    });
  });

  it("allows zero-line documents when their type does not require line items", () => {
    expect(calculateBusinessDocumentAmounts([], 0, 0)).toEqual({
      ok: true,
      amounts: { lineTotals: [], subtotal: 0, discount: 0, tax: 0, total: 0 },
    });
  });
});
