type DocumentLineAmount = { quantity: number; unitPrice: number };

export type BusinessDocumentAmounts = {
  lineTotals: number[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
};

export type BusinessDocumentAmountsResult =
  | { ok: true; amounts: BusinessDocumentAmounts }
  | { ok: false; error: string };

function roundToCents(value: number) {
  return Math.round((value + Number.EPSILON * Math.max(1, Math.abs(value))) * 100) / 100;
}

export function calculateBusinessDocumentAmounts(
  lineItems: DocumentLineAmount[],
  rawDiscount: number,
  rawTax: number,
): BusinessDocumentAmountsResult {
  const lineTotals = lineItems.map((item) => roundToCents(item.quantity * item.unitPrice));
  const subtotal = roundToCents(lineTotals.reduce((sum, lineTotal) => sum + lineTotal, 0));
  const discount = roundToCents(rawDiscount);
  const tax = roundToCents(rawTax);
  const total = roundToCents(subtotal - discount + tax);

  if (subtotal > 9999999999.99 || discount > 9999999999.99 || tax > 9999999999.99) {
    return { ok: false, error: "A document amount is above the supported limit." };
  }
  if (discount > subtotal) {
    return { ok: false, error: "Discount cannot exceed the line-item subtotal." };
  }
  if (!Number.isFinite(total) || total < 0 || total > 999999999.99) {
    return { ok: false, error: "Document total is above the supported limit." };
  }

  return {
    ok: true,
    amounts: {
      lineTotals,
      subtotal,
      discount,
      tax,
      total,
    },
  };
}
