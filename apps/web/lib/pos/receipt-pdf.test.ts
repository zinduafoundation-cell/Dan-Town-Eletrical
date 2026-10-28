import { describe, expect, it } from "vitest";
import { createReceiptPdf } from "./receipt-pdf";
import type { ReceiptEffectSale } from "./receipt-effect";

const receipt: ReceiptEffectSale = {
  receiptNumber: "DT-2026-1042",
  currency: "KES",
  items: [{ name: "Copper cable", sku: "CAB-01", qty: 2, total: 1200 }],
  subtotal: 1000,
  discount: 0,
  tax: 200,
  delivery: 0,
  total: 1200,
  paymentMethod: "MPESA",
  date: "2026-10-14T10:00:00.000Z"
};

describe("createReceiptPdf", () => {
  it("creates a PDF with the real receipt lines and amounts", async () => {
    const blob = createReceiptPdf(receipt);
    const content = await blob.text();
    expect(blob.type).toBe("application/pdf");
    expect(content).toContain("%PDF-1.4");
    expect(content).toContain("DT-2026-1042");
    expect(content).toContain("2 x Copper cable \\(CAB-01\\)");
    expect(content).toContain("KES 1,200.00");
    expect(content).toContain("startxref");
  });

  it("escapes PDF delimiters in customer-controlled product text", async () => {
    const blob = createReceiptPdf({
      ...receipt,
      items: [{ name: "Cable (blue) \\", qty: 1, total: 600 }]
    });
    const content = await blob.text();
    expect(content).toContain("Cable \\(blue\\) \\\\");
  });

  it("splits long receipts across pages and keeps totals on the last page", async () => {
    const blob = createReceiptPdf({
      ...receipt,
      items: Array.from({ length: 25 }, (_, index) => ({
        name: `Product ${index + 1}`,
        qty: 1,
        total: 100,
      })),
    });

    const content = await blob.text();
    expect(content).toContain("/Count 2");
    expect(content).toContain("Product 25");
    expect(content).toContain("Total: KES 1,200.00");
    expect(content.match(/\/Type \/Page \/Parent/g)).toHaveLength(2);
  });

  it("wraps long product descriptions within the printable page area", async () => {
    const blob = createReceiptPdf({
      ...receipt,
      items: [{ name: "Industrial cable ".repeat(12), qty: 1, total: 1200 }],
    });

    const content = await blob.text();
    const yPositions = [...content.matchAll(/1 0 0 1 48 (\d+) Tm/g)].map((match) => Number(match[1]));
    expect(yPositions.length).toBeGreaterThan(15);
    expect(Math.min(...yPositions)).toBeGreaterThanOrEqual(66);
    expect(content).toContain("KES 1,200.00");
  });
});
