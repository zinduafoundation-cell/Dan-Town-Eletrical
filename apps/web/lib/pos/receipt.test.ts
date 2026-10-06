import { describe, expect, it } from "vitest";
import { formatReceiptText } from "./receipt";

describe("POS receipt formatting", () => {
  it("formats a customer receipt with totals and payment details", () => {
    const text = formatReceiptText({
      receiptNumber: "POS-1042",
      customer: "Grace Muthoni",
      amount: 5950,
      items: 3,
      date: "2026-10-06 11:34",
      paymentMethod: "Cash",
      servedBy: "Alice",
      staffRole: "Cashier"
    });

    expect(text).toContain("DANTOWN ELECTRICAL");
    expect(text).toContain("POS-1042");
    expect(text).toContain("Grace Muthoni");
    expect(text).toContain("KSh 5,950");
    expect(text).toContain("Cash");
    expect(text).toContain("Served by: Alice");
  });
});
