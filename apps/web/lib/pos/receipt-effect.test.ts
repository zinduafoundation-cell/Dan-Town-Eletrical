import { afterEach, describe, expect, it, vi } from "vitest";
import { showPOSReceiptEffect, subscribePOSReceiptEffect, type ReceiptEffectSale } from "./receipt-effect";

const sale: ReceiptEffectSale = {
  receiptNumber: "DT-1042",
  currency: "KES",
  items: [{ name: "LED lamp", qty: 2, total: 500 }],
  subtotal: 500,
  discount: 0,
  tax: 0,
  delivery: 0,
  total: 500,
  paymentMethod: "M-Pesa",
  date: "2026-10-14T10:00:00.000Z",
};

afterEach(() => vi.unstubAllGlobals());

describe("receipt effect notifications", () => {
  it("keeps a verified receipt until the root effect subscribes", () => {
    vi.stubGlobal("window", {});
    showPOSReceiptEffect(sale);

    const onReceipt = vi.fn();
    const unsubscribe = subscribePOSReceiptEffect(onReceipt);

    expect(onReceipt).toHaveBeenCalledExactlyOnceWith(sale);
    unsubscribe();
  });

  it("notifies an already-mounted root effect immediately", () => {
    vi.stubGlobal("window", {});
    const onReceipt = vi.fn();
    const unsubscribe = subscribePOSReceiptEffect(onReceipt);

    showPOSReceiptEffect(sale);

    expect(onReceipt).toHaveBeenCalledExactlyOnceWith(sale);
    unsubscribe();
  });
});
